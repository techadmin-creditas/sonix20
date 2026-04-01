'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type BotState = 'idle' | 'listening' | 'processing' | 'speaking' | 'interrupted' | 'error';

interface Transcript {
  id: string;
  text: string;
  role: 'user' | 'bot';
  isFinal: boolean;
  timestamp: number;
}

export function useVoiceBot(botId?: string) {
  const [state, setState] = useState<BotState>('idle');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBotName, setActiveBotName] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize session
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setState('idle');

      // 1. Create session via REST API
      const res = await fetch('http://localhost:8000/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId }),
      });
      
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      const sid = data.session_id;
      setSessionId(sid);

      // 2. Connect WebSocket with bot_id
      const botParam = botId ? `&bot_id=${botId}` : '';
      const wsUrl = `ws://localhost:8000/ws/voice/${sid}?language=en${botParam}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('VoiceBot connected');
        startAudioCapture();
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          handleTextData(msg);
        } else {
          // Binary audio from bot
          handleAudioData(event.data);
        }
      };

      ws.onerror = (e) => {
        console.error('WS Error:', e);
        setError('Connection error');
        setState('error');
      };

      ws.onclose = () => {
        console.log('WS Closed');
        stopAudioCapture();
        setState('idle');
      };

    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  }, []);

  const [metrics, setMetrics] = useState<any>(null);

  const handleTextData = (msg: any) => {
    switch (msg.type) {
      case 'status':
        setState(msg.state as BotState);
        if (msg.state === 'bot_switched' && msg.bot) {
          setActiveBotName(msg.bot);
        }
        break;
      case 'metrics':
        setMetrics(msg);
        break;
      case 'transcript':
        updateTranscript(msg.text, 'user', msg.is_final);
        break;
      case 'bot_transcript':
        updateTranscript(msg.text, 'bot', msg.is_final);
        break;
      case 'error':
        console.error('Backend Error:', msg.message);
        setError(msg.message);
        setState('error');
        stopAudioCapture();
        break;
      case 'audio_interrupt':
        // Invalidate any in-flight arrayBuffer() promises so they discard their result.
        interruptGenRef.current++;
        // Stop the currently playing node and drain the queue so no stale
        // audio plays after the user interrupted the bot.
        try { currentSourceRef.current?.stop(); } catch (_) { /* already ended */ }
        currentSourceRef.current = null;
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        break;
      case 'pong':
        // console.log('Pong received');
        break;
    }
  };

  const updateTranscript = (text: string, role: 'user' | 'bot', isFinal: boolean) => {
    setTranscripts((prev: Transcript[]) => {
      const last = prev[prev.length - 1];

      // If the last entry is the same role AND still a partial, update it in place
      // This handles BOTH: new partial chunks growing the bubble, AND the final
      // emission upgrading the bubble from partial → final (no duplicate!)
      if (last && last.role === role && !last.isFinal) {
        return [...prev.slice(0, -1), { ...last, text, isFinal }];
      }

      // No existing partial to merge into — add a fresh entry
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        text,
        role,
        isFinal,
        timestamp: Date.now()
      }];
    });
  };

  // 🔊 Audio Out — Receive and Play
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Incremented on every audio_interrupt; blobs that resolve after the increment are stale.
  const interruptGenRef = useRef(0);

  const handleAudioData = async (data: Blob) => {
    const gen = interruptGenRef.current;     // capture generation before the async gap
    const buffer = await data.arrayBuffer();
    if (gen !== interruptGenRef.current) return; // interrupt fired while we were awaiting — discard
    const pcm = new Int16Array(buffer);
    audioQueueRef.current.push(pcm);

    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    
    // Play PCM using browser AudioContext
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    const buffer = audioCtx.createBuffer(1, pcmData.length, 16000); // 16kHz
    const nowBuffering = buffer.getChannelData(0);
    
    // Convert Int16 to Float32 [-1.0, 1.0]
    for (let i = 0; i < pcmData.length; i++) {
      nowBuffering[i] = pcmData[i] / 32768.0;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    currentSourceRef.current = source;
    source.onended = () => playNextInQueue();
    source.start();
  };

  // 🎤 Audio In — Capture and Send
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }

        // Send binary data if WS is open
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

    } catch (err: any) {
      console.error('Audio Capture Error:', err);
      setError('Microphone access denied');
    }
  };

  const stopAudioCapture = () => {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
  };

  const switchBot = useCallback((newBotId?: string, newBotName?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'switch_bot',
      bot_id: newBotId,
      bot_name: newBotName,
    }));
  }, []);

  const endSession = useCallback(async () => {
    wsRef.current?.send(JSON.stringify({ type: 'end' }));
    wsRef.current?.close();
    stopAudioCapture();
  }, []);

  const interrupt = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  return {
    state,
    transcripts,
    error,
    sessionId,
    activeBotName,
    startSession,
    endSession,
    interrupt,
    switchBot,
    metrics,
  };
}

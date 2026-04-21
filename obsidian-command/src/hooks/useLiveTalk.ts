import { useState, useEffect, useRef, useCallback } from 'react';
import { api, getVoiceWebSocketUrl } from '../lib/api';

export type LiveTalkStatus = 'standby' | 'connecting' | 'active' | 'error';

export function useLiveTalk(botId?: string) {
  const [status, setStatus] = useState<LiveTalkStatus>('standby');
  const [micActivity, setMicActivity] = useState(0);
  const [lastUserTranscript, setLastUserTranscript] = useState('');
  const [lastBotTranscript, setLastBotTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamsRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);

  // Playback Refs
  const nextScheduledTimeRef = useRef(0);
  const botPcmAccumRef = useRef<Uint8Array | null>(null);
  const botPlaybackPrimedRef = useRef(false);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const activeGainsRef = useRef<GainNode[]>([]);
  const botPcmIdleFlushRef = useRef<number | null>(null);

  const BOT_LOOKAHEAD_BYTES_MIN = 3200;
  const BOT_FLUSH_MIN_BYTES = 4096;
  const BOT_IDLE_FLUSH_MS = 72;

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      nextScheduledTimeRef.current = audioCtxRef.current.currentTime;
      const analyzer = audioCtxRef.current.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const stopAudio = useCallback(() => {
    if (botPcmIdleFlushRef.current) {
       window.clearTimeout(botPcmIdleFlushRef.current);
       botPcmIdleFlushRef.current = null;
    }
    scheduledSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch (e) {} });
    scheduledSourcesRef.current = [];
    activeGainsRef.current.forEach(g => { try { g.disconnect(); } catch (e) {} });
    activeGainsRef.current = [];
    
    if (streamsRef.current) {
      streamsRef.current.getTracks().forEach(t => t.stop());
      streamsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
       const ctx = audioCtxRef.current;
       audioCtxRef.current = null;
       ctx.close().catch(() => {});
    }
    setMicActivity(0);
  }, []);

  const resetCoalesce = () => {
    botPcmAccumRef.current = null;
    botPlaybackPrimedRef.current = false;
    const now = audioCtxRef.current ? audioCtxRef.current.currentTime : 0;
    activeGainsRef.current.forEach(g => {
        try {
            g.gain.cancelScheduledValues(now);
            g.gain.linearRampToValueAtTime(0, now + 0.01);
        } catch(e) {}
    });
    setTimeout(() => {
        scheduledSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e) {} });
        scheduledSourcesRef.current = [];
    }, 15);
    nextScheduledTimeRef.current = audioCtxRef.current ? audioCtxRef.current.currentTime : 0;
  };

  const schedulePcmBuffer = (arrayBuffer: ArrayBuffer) => {
    if (!audioCtxRef.current) return;
    const evenLen = arrayBuffer.byteLength - (arrayBuffer.byteLength % 2);
    if (evenLen < 2) return;

    try {
      const slice = arrayBuffer.slice(0, evenLen);
      const float32Array = new Float32Array(slice.byteLength / 2);
      const int16Array = new Int16Array(slice);
      for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768.0;

      const audioBuffer = audioCtxRef.current.createBuffer(1, float32Array.length, 16000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = audioCtxRef.current.createGain();
      const startTime = Math.max(nextScheduledTimeRef.current, audioCtxRef.current.currentTime);

      gainNode.connect(audioCtxRef.current.destination);
      source.connect(gainNode);
      if (analyzerRef.current) source.connect(analyzerRef.current);

      scheduledSourcesRef.current.push(source);
      activeGainsRef.current.push(gainNode);

      source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
        activeGainsRef.current = activeGainsRef.current.filter(g => g !== gainNode);
      };

      source.start(startTime);
      nextScheduledTimeRef.current = startTime + audioBuffer.duration;
    } catch (e) {
      console.error('Playback Error:', e);
    }
  };

  const flushBotPcmAccum = () => {
    const acc = botPcmAccumRef.current;
    if (!acc || acc.length === 0) return;
    schedulePcmBuffer(acc.slice().buffer);
    botPcmAccumRef.current = new Uint8Array(0);
  };

  const playAudioChunk = (arrayBuffer: ArrayBuffer) => {
    if (botPcmIdleFlushRef.current) window.clearTimeout(botPcmIdleFlushRef.current);
    const u8 = new Uint8Array(arrayBuffer);
    const prev = botPcmAccumRef.current;
    if (!prev || prev.length === 0) {
      botPcmAccumRef.current = new Uint8Array(u8);
    } else {
      const merged = new Uint8Array(prev.length + u8.length);
      merged.set(prev, 0);
      merged.set(u8, prev.length);
      botPcmAccumRef.current = merged;
    }

    const acc = botPcmAccumRef.current!;
    const threshold = botPlaybackPrimedRef.current ? BOT_FLUSH_MIN_BYTES : BOT_LOOKAHEAD_BYTES_MIN;

    if (acc.byteLength >= threshold) {
      const copy = acc.slice().buffer;
      botPcmAccumRef.current = new Uint8Array(0);
      botPlaybackPrimedRef.current = true;
      schedulePcmBuffer(copy);
    }
    botPcmIdleFlushRef.current = window.setTimeout(() => {
        botPcmIdleFlushRef.current = null;
        flushBotPcmAccum();
    }, BOT_IDLE_FLUSH_MS);
  };

  const startSession = async () => {
    if (status === 'connecting' || status === 'active') return;
    
    setStatus('connecting');
    setErrorMessage(null);
    setLastUserTranscript('');
    setLastBotTranscript('');

    try {
      initAudio();
      const res = await api.createSession(botId || 'bolt', 'websocket', undefined, true);
      const { websocket_url } = res;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = stream;
      
      await audioCtxRef.current!.audioWorklet.addModule('/audio-processors/vocal-processor.js');
      const micNode = new AudioWorkletNode(audioCtxRef.current!, 'vocal-processor');
      const source = audioCtxRef.current!.createMediaStreamSource(stream);
      source.connect(micNode);
      micNode.connect(analyzerRef.current!);
      processorRef.current = micNode;

      const socket = new WebSocket(getVoiceWebSocketUrl(websocket_url));
      socket.binaryType = 'arraybuffer';
      wsRef.current = socket;

      socket.onopen = () => {
        resetCoalesce();
        setStatus('active');
        micNode.port.onmessage = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(e.data.audio);
            setMicActivity(e.data.rms * 100);
          }
        };
      };

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcript') setLastUserTranscript(msg.text);
          if (msg.type === 'bot_transcript') setLastBotTranscript(msg.text);
          if (msg.type === 'audio_interrupt') resetCoalesce();
          if (msg.type === 'session_ended') endSession();
        } else {
          playAudioChunk(event.data);
        }
      };

      socket.onclose = () => endSession();
      socket.onerror = () => setStatus('error');

    } catch (err) {
      console.error('LiveTalk failed:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Microphone or Connection Error');
      stopAudio();
    }
  };

  const endSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAudio();
    setStatus('standby');
  }, [stopAudio]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      stopAudio();
    };
  }, [stopAudio]);

  return {
    status,
    micActivity,
    lastUserTranscript,
    lastBotTranscript,
    errorMessage,
    startSession,
    endSession
  };
}

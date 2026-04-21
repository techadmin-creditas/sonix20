import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, PhoneOff, Loader2, Zap, AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, getVoiceWebSocketUrl } from '../lib/api';

/** Simple interactive "Click and Talk" block for the home page. */
const NLPSpiderGraph = ({ status }: { status: string }) => {
  // Define 10 semi-random nodes
  const nodes = [
    { x: 15, y: 20 }, { x: 80, y: 15 }, { x: 50, y: 45 },
    { x: 20, y: 80 }, { x: 85, y: 85 }, { x: 45, y: 10 },
    { x: 10, y: 50 }, { x: 90, y: 40 }, { x: 60, y: 75 },
    { x: 35, y: 65 }
  ];

  // Define connections (edges)
  const edges = [
    [0, 2], [0, 5], [0, 6], [1, 2], [1, 7], [2, 5], [2, 8], [2, 9],
    [3, 6], [3, 9], [3, 8], [4, 7], [4, 8], [6, 9], [7, 8]
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Draw Edges */}
        {edges.map(([startIdx, endIdx], i) => {
          const start = nodes[startIdx];
          const end = nodes[endIdx];
          return (
            <g key={`edge-${i}`}>
              <line
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
                stroke="currentColor"
                strokeWidth="0.1"
                className="text-primary/30"
              />
              {/* Edge Particle traveling along the line - Faster when active */}
              <motion.circle
                r="0.3"
                fill="currentColor"
                className="text-primary"
                animate={{
                  cx: [start.x, end.x],
                  cy: [start.y, end.y],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: (status === 'active' ? 1 : 2) + Math.random() * 2,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 2
                }}
              />
            </g>
          );
        })}

        {/* Draw Nodes */}
        {nodes.map((node, i) => (
          <motion.circle
            key={`node-${i}`}
            cx={node.x}
            cy={node.y}
            r="0.6"
            fill="currentColor"
            className="text-primary/60"
            animate={{
              r: [0.6, 1, 0.6],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </svg>
    </div>
  );
};

const VoiceParticles = ({ activity }: { activity: number }) => {
  const count = Math.min(Math.floor(activity / 8), 12);
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {[...Array(count)].map((_, i) => (
          <motion.div
            key={`${i}-${Date.now()}`}
            className="absolute left-1/2 top-1/2 size-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]"
            initial={{ x: '-50%', y: '-50%', scale: 0, opacity: 1 }}
            animate={{ 
                x: `${(Math.random() - 0.5) * 300}px`, 
                y: `${(Math.random() - 0.5) * 300}px`,
                scale: [0, 1.5, 0],
                opacity: [1, 0.8, 0] 
            }}
            transition={{ duration: 1.2, ease: "circOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default function LiveTalk({ className }: { className?: string }) {
  const [status, setStatus] = useState<'standby' | 'connecting' | 'active' | 'error'>('standby');
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
      audioCtxRef.current.close().then(() => { audioCtxRef.current = null; });
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
    setStatus('connecting');
    setErrorMessage(null);
    setLastUserTranscript('');
    setLastBotTranscript('');

    try {
      initAudio();
      // 1. Get session (no bot_id -> pick default)
      const res = await api.createSession(undefined as any, 'websocket');
      const { session_id, websocket_url } = res;

      // 2. Start Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = stream;
      
      await audioCtxRef.current!.audioWorklet.addModule('/audio-processors/vocal-processor.js');
      const micNode = new AudioWorkletNode(audioCtxRef.current!, 'vocal-processor');
      const source = audioCtxRef.current!.createMediaStreamSource(stream);
      source.connect(micNode);
      micNode.connect(analyzerRef.current!);
      processorRef.current = micNode;

      // 3. Connect Socket
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

  return (
    <div className={cn("relative flex flex-col items-center justify-center p-8 max-h-[550px] w-full", className)}>
      <NLPSpiderGraph status={status} />
      
      <AnimatePresence mode="wait">
        {status === 'active' ? (
          <motion.div 
            key="active"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex flex-col items-center gap-8 z-10 w-full"
          >
            {/* 3D-ish Visualizer Circle */}
            <div className="relative size-60 flex items-center justify-center">
              <VoiceParticles activity={micActivity} />
              {/* Dynamic Aura Waves */}
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full bg-primary/10 border border-primary/20 blur-sm"
                  animate={{
                    scale: [1, 1.3 + (micActivity / 40), 1],
                    opacity: [0.4, 0.1, 0.4],
                    rotate: i * 45,
                  }}
                  transition={{
                    duration: 1 + (i * 0.2), // Sped up from 2 + (i * 0.4)
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}

              {/* Orbital Rings - Sped up */}
              <motion.div 
                className="absolute size-[90%] rounded-full border border-primary/50 border-dashed opacity-50"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }} // Sped up from 10s
              />

              <button 
                onClick={endSession}
                className="relative size-36 rounded-full bg-primary text-on-primary-fixed shadow-[0_0_50px_rgba(var(--primary-rgb),0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all group overflow-hidden border-4 border-white/20"
              >
                <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-white/10" />
                <motion.div 
                  className="absolute inset-0 bg-primary/20"
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div className="flex flex-col items-center gap-1 z-10">
                  <PhoneOff className="size-10" />
                  <span className="text-[10px] font-black uppercase tracking-widest">End Call</span>
                </div>
              </button>
            </div>

            <div className="text-center space-y-4 max-w-sm">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Neural Link Active
                </div>
                
                <div className="min-h-20 flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    {lastBotTranscript ? (
                      <motion.div
                        key="bot"
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -5, opacity: 0 }}
                        className="bg-primary/5 border border-primary/10 rounded-2xl p-4 backdrop-blur-md"
                      >
                        <p className="text-sm font-semibold text-on-surface italic leading-relaxed">
                          "{lastBotTranscript}"
                        </p>
                      </motion.div>
                    ) : lastUserTranscript ? (
                       <motion.p 
                        key="user"
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 0.7 }} 
                        className="text-xs font-bold text-on-surface-variant uppercase tracking-widest"
                       >
                         Listening: {lastUserTranscript}...
                       </motion.p>
                    ) : (
                      <p className="text-xs text-outline uppercase tracking-[0.3em] font-black opacity-30">Waiting for input</p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="standby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-8 text-center z-10 w-full"
          >
            <div className="relative">
              {/* Massive 3D Background Glow */}
              <motion.div 
                className="absolute -inset-10 bg-primary/10 rounded-full blur-[60px]"
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                  rotate: [0, 90, 180, 270, 360] 
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />

              <button 
                onClick={status === 'connecting' ? undefined : startSession}
                disabled={status === 'connecting'}
                className={cn(
                  "relative size-44 rounded-full flex items-center justify-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 group overflow-hidden border-2 border-white/10",
                  status === 'connecting' ? "bg-primary/5" : "bg-[#0a0a0a] hover:scale-110 active:scale-95"
                )}
              >
                {/* 3D Bevel/Highlight */}
                <div className="absolute inset-0 bg-linear-to-tr from-black/60 via-transparent to-white/10" />
                
                {status === 'connecting' ? (
                  <div className="relative flex items-center justify-center">
                    {/* High-speed spin rings for "Linking" */}
                    <motion.div 
                        className="absolute size-32 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div 
                        className="absolute size-24 border-2 border-primary/30 border-t-transparent border-b-transparent rounded-full"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="flex flex-col items-center gap-1 z-10">
                      <Zap className="size-8 text-primary animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Neural Link</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 ember-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="flex flex-col items-center gap-2 text-on-primary-fixed relative z-10">
                      <div className="relative">
                        <Mic className="size-14 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                        <motion.div 
                            className="absolute -inset-2 bg-primary/20 rounded-full blur-md"
                            animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.3em] group-hover:tracking-[0.4em] transition-all">Talk Now</span>
                    </div>
                  </>
                )}
                
                {/* Internal scan line */}
                <motion.div 
                  className="absolute inset-0 w-full h-1 bg-primary/20 blur-sm pointer-events-none"
                  animate={{ top: ['-10%', '110%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              </button>
            </div>

            <div className="max-w-xs space-y-6">
              <div className="space-y-2">
                 <h3 className="text-3xl font-black text-on-surface tracking-tighter">
                   <motion.span
                     animate={status === 'connecting' ? { opacity: [1, 0.5, 1] } : {}}
                     transition={{ duration: 0.5, repeat: Infinity }}
                   >
                     {status === 'connecting' ? 'Connecting...' : 'Click and Talk'}
                   </motion.span>
                 </h3>
                 <p className="text-sm font-semibold text-on-surface-variant leading-relaxed">
                   Experience ultra-low latency AI voice. No forms, no config, just pure conversation.
                 </p>
              </div>
              
              {status === 'error' && (
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex items-center gap-3 p-4 rounded-3xl bg-red-500/10 text-red-400 border border-red-500/10 text-[11px] font-bold"
                >
                  <AlertCircle className="size-5 shrink-0" />
                  <span className="text-left leading-tight">{errorMessage || "Neural link failed. Verify mic permissions."}</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

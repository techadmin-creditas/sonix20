import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import {
  Activity,
  Settings2,
  Download,
  Terminal,
  StopCircle,
  XCircle,
  Search,
  ChevronDown,
  Bot as BotIcon,
  X,
  Check,
  Loader2,
  Volume2,
  Zap,
  ShieldCheck,
  Cpu,
  UserCircle2,
  Tags,
  Brain,
  Languages,
  Users,
  Star,
  Zap as ZapIcon,
  ArrowRight,
  Sparkles,
  UserRound,
  Edit2,
  Trash2,
  Activity as ActivityIcon,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Room as LiveKitRoom, createLocalAudioTrack } from 'livekit-client';
import { api, Bot, getVoiceWebSocketUrl, AiPersona } from '../lib/api';
import { TelemetryCharts } from '../components/TelemetryCharts';


type SentimentLabel = 'positive' | 'neutral' | 'negative';
interface Entity { key: string; value: string; }
interface TranscriptEntry {
  role: string;
  text: string;
  time: string;
  isFinal: boolean;
  sentiment?: SentimentLabel;
}

const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ta', name: 'Tamil' },
  { code: 'bn', name: 'Bengali' },
];

export default function SessionControl() {
  const [availableBots, setAvailableBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [availablePersonas, setAvailablePersonas] = useState<AiPersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<AiPersona | null>(null);
  const [isBotSelectorOpen, setIsBotSelectorOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Real-time state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState('Standby');
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<'neural' | 'tools' | 'vitals' | 'entities'>('neural');
  const [metrics, setMetrics] = useState({ stt: 0, llm: 0, tts: 0, total: 0 });
  const [infra, setInfra] = useState({
    redis: 'unavailable',
    stt: 'unavailable',
    llm: 'unavailable',
    tts: 'unavailable',
    uptime: '--',
    stt_provider: 'STT',
    llm_provider: 'LLM',
    tts_provider: 'TTS',
  });
  const [tokenPulse, setTokenPulse] = useState(false);
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0, total: 0 });
  const [historicalMetrics, setHistoricalMetrics] = useState<any[]>([]);

  const [modelLimits, setModelLimits] = useState<any[]>([]);
  const [toolSuccessRate, setToolSuccessRate] = useState(100.0);

  // Caller identity & cross-session memory
  const [userId, setUserId] = useState('');
  // Live sentiment
  const [currentSentiment, setCurrentSentiment] = useState<SentimentLabel>('neutral');
  const [negativeSentimentCount, setNegativeSentimentCount] = useState(0);
  // Entity extraction
  const [entities, setEntities] = useState<Entity[]>([]);

  // User selection (for Caller ID)
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);

  // Translation
  const [targetLanguage, setTargetLanguage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalTranscripts, setOriginalTranscripts] = useState<TranscriptEntry[]>([]);
  const [translationCache, setTranslationCache] = useState<Record<string, TranscriptEntry[]>>({});
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const transcriptRef = React.useRef<HTMLDivElement>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  const livekitRoomRef = React.useRef<LiveKitRoom | null>(null);

  // [PERFORMANCE] Memoized transcription list (capped at last 50 for DOM stability)
  const optimizedTranscripts = React.useMemo(() => {
    return transcripts.slice(-50);
  }, [transcripts]);

  const optimizedLogs = React.useMemo(() => {
    return logs.slice(-100);
  }, [logs]);

  // Session Config State
  const [config, setConfig] = useState({
    autoRecording: true,
    noiseSuppression: true,
    latencyMode: 'ultra-low',
    temperature: 0.7,
    maxDuration: 30,
    testInterruption: false
  });

  const personaRef = React.useRef<HTMLDivElement>(null);
  const botRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Use a small delay for bot selector to avoid immediate close when clicking the toggle button
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) {
        setIsPersonaSelectorOpen(false);
      }
      if (botRef.current && !botRef.current.contains(e.target as Node)) {
        setIsBotSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    api.getBots().then(bots => {
      setAvailableBots(bots);
      if (bots.length > 0) setSelectedBot(bots[0]);
    });

    api.listAiPersonas().then(personas => {
      setAvailablePersonas(personas);
      if (personas.length > 0) setSelectedPersona(personas[0]);
    });
    // Fetch real-time model capability data
    api.getModels()
      .then(models => setModelLimits(models || []))
      .catch(err => console.error("Failed to load model specs:", err));

    api.listUsers().then(users => {
      setAvailableUsers(prev => {
        const merged = [...prev];
        users.forEach(u => {
          if (!merged.find(m => m.id === u.id)) {
            merged.push({ id: u.id, username: u.username, source: 'auth' });
          }
        });
        return merged;
      });
    }).catch(() => { });

    api.getTestCustomers().then(customers => {
      setAvailableUsers(prev => {
        const merged = [...prev];
        customers.forEach(c => {
          // Use customer_name and account_number
          if (!merged.find(m => m.id === c.account_number)) {
            merged.push({
              id: c.account_number,
              username: `${c.customer_name} (Lead)`,
              source: 'db'
            });
          }
        });
        return merged;
      });
    }).catch(err => {
      console.warn("Failed to load test customers:", err);
      // Fallback only if both fail and list is empty
      setAvailableUsers(prev => prev.length > 0 ? prev : [
        { id: 'vaibhav', username: 'Vaibhav (Lead)' },
        { id: 'rahul', username: 'Rahul (Test)' },
        { id: 'priya', username: 'Priya (Customer)' },
      ]);
    });

    // Cleanup on page exit: Ensure all session handles are closed immediately
    return () => {
      console.log("Cleanup: User navigating away, terminating active voice sessions...");
      if (wsRef.current) {
        wsRef.current.close(1000, "User navigated away");
        wsRef.current = null;
      }
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
      // Re-use existing audio stop logic (don't close context to avoid React strict mode issues, just disconnect)
      if (processorRef.current) processorRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Audio Processing Refs
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const analyzerRef = React.useRef<AnalyserNode | null>(null);
  const nextScheduledTimeRef = React.useRef<number>(0);
  /** Coalesce small PCM frames and add lookahead before first play to reduce underruns/gaps. */
  const botPcmAccumRef = React.useRef<Uint8Array | null>(null);
  const botPlaybackPrimedRef = React.useRef(false);
  /** Track scheduled sources to allow immediate cancellation on interrupt. */
  const scheduledSourcesRef = React.useRef<AudioBufferSourceNode[]>([]);
  /** Flush tail PCM after a short idle gap (binary stopped) so samples are not held until the next segment. */
  const botPcmIdleFlushRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const BOT_LOOKAHEAD_BYTES_MIN = 3200; // ~100ms
  const BOT_LOOKAHEAD_BYTES_MAX = 9600; // ~300ms
  const dynamicLookaheadRef = React.useRef(4800); // Start at 150ms
  /** Larger post-prime chunks → fewer scheduled AudioBufferSource nodes → less scheduling jitter. */
  const BOT_FLUSH_MIN_BYTES = 4096; // ~128ms @ 16kHz mono int16
  const BOT_IDLE_FLUSH_MS = 72;
  const [sessionTransport, setSessionTransport] = useState<'websocket' | 'webrtc'>('websocket');
  const [livekitHint, setLivekitHint] = useState<string | null>(null);
  const [isHandoffAnimating, setIsHandoffAnimating] = useState(false);
  /** Stable reference to the active socket for cleanup on unmount/page exit. */
  const wsRef = React.useRef<WebSocket | null>(null);
  const activeGainsRef = React.useRef<GainNode[]>([]);

  // Audio Player Logic
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      nextScheduledTimeRef.current = audioContextRef.current.currentTime;

      // Create analyzer for visualization
      const analyzer = audioContextRef.current.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const clearBotPcmIdleFlush = () => {
    if (botPcmIdleFlushRef.current !== null) {
      clearTimeout(botPcmIdleFlushRef.current);
      botPcmIdleFlushRef.current = null;
    }
  };

  const resetBotPlaybackCoalesce = () => {
    clearBotPcmIdleFlush();
    botPcmAccumRef.current = null;
    botPlaybackPrimedRef.current = false;

    // Stop and clear all currently scheduled audio sources with micro-fades to prevent pops
    const now = audioContextRef.current ? audioContextRef.current.currentTime : 0;

    activeGainsRef.current.forEach(gain => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        // [MICRO-FADE] 10ms ramp to 0 to eliminate DC offset pops
        gain.gain.linearRampToValueAtTime(0, now + 0.01);
      } catch (e) { /* already disconnected */ }
    });

    // Short delay before stopping/disconnecting to allow the ramp to execute
    const sourcesToStop = [...scheduledSourcesRef.current];
    const gainsToClear = [...activeGainsRef.current];

    setTimeout(() => {
      sourcesToStop.forEach(source => {
        try { source.stop(); source.disconnect(); } catch (e) { }
      });
      gainsToClear.forEach(g => {
        try { g.disconnect(); } catch (e) { }
      });
    }, 15);

    scheduledSourcesRef.current = [];
    activeGainsRef.current = [];

    if (audioContextRef.current) {
      nextScheduledTimeRef.current = audioContextRef.current.currentTime;
    } else {
      nextScheduledTimeRef.current = 0;
    }
  };

  const schedulePcmBuffer = (arrayBuffer: ArrayBuffer, options: { fadeInMs?: number } = {}) => {
    if (!audioContextRef.current) {
      initAudio();
    }
    const evenLen = arrayBuffer.byteLength - (arrayBuffer.byteLength % 2);
    if (evenLen < 2) return;

    try {
      const slice = arrayBuffer.slice(0, evenLen);
      const float32Array = new Float32Array(slice.byteLength / 2);
      const int16Array = new Int16Array(slice);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current!.createBuffer(1, float32Array.length, 16000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioContextRef.current!.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContextRef.current!.createGain();

      const startTime = Math.max(nextScheduledTimeRef.current, audioContextRef.current!.currentTime);

      // [NEURAL SHIFT] Crossfade optimization: Linear fadeIn for incoming real response
      if (options.fadeInMs) {
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + (options.fadeInMs / 1000));
      }

      gainNode.connect(audioContextRef.current!.destination);
      source.connect(gainNode);

      if (analyzerRef.current) {
        source.connect(analyzerRef.current);
      }

      // Track source and gain for potential cancellation or crossfade
      scheduledSourcesRef.current.push(source);
      activeGainsRef.current.push(gainNode);

      source.onended = () => {
        // [DYNAMIC JITTER BUFFER] Detect underrun
        const now = audioContextRef.current?.currentTime || 0;
        if (nextScheduledTimeRef.current <= now + 0.02) {
          // If we finished playing and the next chunk isn't ready or just barely ready,
          // increase lookahead to prevent the next gap.
          dynamicLookaheadRef.current = Math.min(BOT_LOOKAHEAD_BYTES_MAX, dynamicLookaheadRef.current + 800);
        } else {
          // Gradually decay back to minimum for best latency
          dynamicLookaheadRef.current = Math.max(BOT_LOOKAHEAD_BYTES_MIN, dynamicLookaheadRef.current - 160);
        }

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
    clearBotPcmIdleFlush();
    const acc = botPcmAccumRef.current;
    if (!acc || acc.length === 0) return;
    if (!audioContextRef.current) initAudio();
    schedulePcmBuffer(acc.slice().buffer);
    botPcmAccumRef.current = new Uint8Array(0);
  };

  const playAudioChunk = async (arrayBuffer: ArrayBuffer) => {
    clearBotPcmIdleFlush();
    if (!audioContextRef.current) {
      initAudio();
    }
    // Some browsers can suspend AudioContext after tab focus changes or
    // autoplay policy transitions. Ensure playback context is resumed before
    // scheduling bot PCM, otherwise transcript updates continue but audio is silent.
    if (audioContextRef.current?.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
      }
    }
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
    const primed = botPlaybackPrimedRef.current;

    // Use the dynamic lookahead for the first chunk to ensure stable start
    const threshold = primed ? BOT_FLUSH_MIN_BYTES : dynamicLookaheadRef.current;

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

  const startMic = async (socket: WebSocket) => {
    try {
      initAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // [GEMINI-GRADE] AudioWorklet Migration
      // Offloads mic processing to a separate high-priority thread to avoid UI main-thread jank.
      await audioContextRef.current!.audioWorklet.addModule('/audio-processors/vocal-processor.js');
      const micWorkletNode = new AudioWorkletNode(audioContextRef.current!, 'vocal-processor');

      const source = audioContextRef.current!.createMediaStreamSource(stream);
      source.connect(micWorkletNode);

      // Connect to analyzer for mic visualization
      micWorkletNode.connect(analyzerRef.current!);

      micWorkletNode.port.onmessage = (e) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const { audio, rms } = e.data;
        socket.send(audio);
        // setMicActivity is removed as high-frequency state updates cause Infinite Re-renders
      };

      processorRef.current = micWorkletNode; // Store it for cleanup
    } catch (err) {
      console.error('Mic access failed:', err);
    }
  };

  const stopAudio = () => {
    clearBotPcmIdleFlush();
    flushBotPcmAccum();
    resetBotPlaybackCoalesce();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
      });
    }
  };

  const handleTranslate = async (langName: string) => {
    if (!langName) {
      setTargetLanguage('');
      if (originalTranscripts.length > 0) {
        setTranscripts(originalTranscripts);
      }
      return;
    }

    if (!sessionId) {
      alert('Start a session first to translate.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cached = translationCache[langName];
    // Only use cache if the length matches (live session transcripts might have grown)
    if (cached && cached.length === transcripts.length) {
      setTargetLanguage(langName);
      setTranscripts(cached);
      return;
    }

    setTargetLanguage(langName);
    setIsTranslating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Keep a copy of originals if not already kept
    if (originalTranscripts.length === 0) {
      setOriginalTranscripts(transcripts);
    }

    try {
      const translatedRaw = await api.translateSession(sessionId, langName, controller.signal);
      let translatedTexts: string[] = [];
      try {
        const cleanJson = translatedRaw.replace(/```json|```/g, '').trim();
        translatedTexts = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error("Translation JSON parse failed", parseErr, translatedRaw);
        translatedTexts = translatedRaw.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-\*\s]+/, '').trim());
      }

      if (Array.isArray(translatedTexts)) {
        let translatedIdx = 0;
        const newTranscripts = transcripts.map((t) => {
          // In live sessions, we filter manually during translation prep in backend
          const role = t.role.toLowerCase();
          if (['user', 'bot', 'assistant'].includes(role) && translatedIdx < translatedTexts.length) {
            const newText = translatedTexts[translatedIdx];
            translatedIdx++;
            return { ...t, text: newText };
          }
          return t;
        });
        setTranslationCache(prev => ({ ...prev, [langName]: newTranscripts }));
        setTranscripts(newTranscripts);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Translation cancelled.');
        return;
      }
      console.error(e);
      alert('Translation failed.');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsTranslating(false);
        abortControllerRef.current = null;
      }
    }
  };

  const cancelTranslate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTranslating(false);
      setTargetLanguage('');
    }
  };

  const startSession = async (isTestModeArg: any = false) => {
    const isTestMode = isTestModeArg === true;
    if (!selectedBot) return;
    setIsConnecting(true);
    setStatus('Initializing...');
    setTranscripts([]);
    setLogs([]);
    setMetrics({ stt: 0, llm: 0, tts: 0, total: 0 });
    setCurrentSentiment('neutral');
    setNegativeSentimentCount(0);
    setEntities([]);
    setTranslationCache({});
    setTargetLanguage('');

    const handleIncomingMessage = async (msg: any) => {
      if (msg.type === 'status') {
        setStatus(msg.state || msg.message);
      } else if (msg.type === 'transcript' || msg.type === 'bot_transcript') {
        if (!msg.text || msg.text.trim() === '') return;

        const role = msg.type === 'transcript' ? 'User' : 'Bot';

        setTranscripts(prev => {
          const last = prev[prev.length - 1];
          const isUpdate = last && last.role === role && !last.isFinal;

          if (isUpdate) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              text: msg.text,
              isFinal: msg.is_final
            };
            return updated;
          } else {
            return [...prev, {
              role,
              text: msg.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              isFinal: msg.is_final
            }];
          }
        });
        if (msg.type === 'bot_transcript' && msg.is_final) {
          clearBotPcmIdleFlush();
          flushBotPcmAccum();
        }
      } else if (msg.type === 'sentiment') {
        const label = msg.label as SentimentLabel;
        setCurrentSentiment(label);
        // Tag the most recent User transcript with this sentiment
        setTranscripts(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'User') {
              updated[i] = { ...updated[i], sentiment: label };
              break;
            }
          }
          return updated;
        });
        if (label === 'negative') {
          setNegativeSentimentCount(c => c + 1);
        } else {
          setNegativeSentimentCount(0);
        }
      } else if (msg.type === 'tool_call') {
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
          tag: '[TOOL]',
          content: `calling ${msg.name}(${JSON.stringify(msg.arguments)})`,
          color: 'text-indigo-400'
        }]);
      } else if (msg.type === 'tool_result') {
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
          tag: '[RESULT]',
          content: `${msg.name} returned: ${msg.result}`,
          color: 'text-green-400'
        }]);
      } else if (msg.type === 'log') {
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
          tag: msg.tag,
          content: msg.message,
          color: msg.color
        }]);
        // Parse entity extraction log messages
        if (msg.tag === '[ENTITY]' && msg.message) {
          const match = msg.message.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            setEntities(prev => {
              const exists = prev.find(e => e.key === match[1].trim());
              if (exists) return prev.map(e => e.key === match[1].trim() ? { key: e.key, value: match[2].trim() } : e);
              return [...prev, { key: match[1].trim(), value: match[2].trim() }];
            });
          }
        }
      } else if (msg.type === 'infra_status') {
        setInfra({
          redis: msg.redis || 'offline',
          stt: msg.stt || 'offline',
          llm: msg.llm || 'offline',
          tts: msg.tts || 'offline',
          uptime: msg.uptime || '100%',
          stt_provider: msg.stt_provider,
          llm_provider: msg.llm_provider,
          tts_provider: msg.tts_provider
        });
      } else if (msg.type === 'metrics') {
        setMetrics({
          stt: msg.stt || 0,
          llm: msg.llm || 0,
          tts: msg.tts || 0,
          total: msg.total || 0
        });

        // 📈 [TELEMETRY] Append to historical timeline
        setHistoricalMetrics((prev: any[]) => [...prev, {
          turn: prev.length + 1,
          stt: msg.stt || 0,
          llm: msg.llm || 0,
          tts: msg.tts || 0,
          total: msg.total || 0,
          sentiment: msg.sentiment_score ?? 0,
          interruptType: msg.interrupt_type
        }]);

        if (msg.tool_success_rate !== undefined) {
          setToolSuccessRate(msg.tool_success_rate);
        }

        // Handle Token Consumption (Cognitive Load)
        if (msg.tokens_output > 0 || msg.tokens_input > 0) {
          setTokenPulse(true);
          setTimeout(() => setTokenPulse(false), 2000); // 2s glow duration
          setSessionTokens(prev => ({
            input: msg.session_tokens_input || (prev.input + msg.tokens_input),
            output: msg.session_tokens_output || (prev.output + msg.tokens_output),
            total: msg.session_tokens_total || (prev.total + msg.tokens_total)
          }));
        }
      } else if (msg.type === 'session_ended') {
        setStatus(`Call ended${msg.reason ? ` · ${msg.reason}` : ''}`);
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            tag: '[SESSION]',
            content: `Session ended: ${msg.reason || 'completed'}`,
            color: 'text-primary',
          },
        ]);

        // Special alert for inactivity timeout
        if (msg.reason === 'inactivity_timeout') {
          setLogs((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              tag: '[SYSTEM]',
              content: 'DISCONNECT: 10 seconds of silence detected. Session terminated to preserve tokens.',
              color: 'text-red-400 font-bold animate-pulse',
            },
          ]);
        }

        setIsLive(false);
        stopAudio();
        setWs(null);
      } else if (msg.type === 'audio_interrupt') {
        // Backend confirmed interruption — flush any pre-scheduled audio immediately.
        resetBotPlaybackCoalesce();
      } else if (msg.type === 'audio_handoff') {
        // Trigger smooth volume ramp-down of any currently playing "filler" audio
        if (audioContextRef.current) {
          const now = audioContextRef.current.currentTime;
          setIsHandoffAnimating(true);
          setTimeout(() => setIsHandoffAnimating(false), 800);

          activeGainsRef.current.forEach(gain => {
            // Quick 250ms fade-out to hand over to the real response
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
          });
          // Note: we don't clear the array, onended will handle it.
          // Adjust next scheduled time to minimize gap during handoff
          nextScheduledTimeRef.current = now + 0.15;
        }
      } else if (msg.type === 'error') {
        setStatus('Neural Error');
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          tag: '[FATAL]',
          content: msg.message,
          color: 'text-error font-bold'
        }]);
        setIsLive(false);
        setIsConnecting(false);
      }
    };

    try {
      setLivekitHint(null);
      const res = await api.createSession(
        selectedBot.id,
        sessionTransport === 'webrtc' ? 'webrtc' : 'websocket',
        userId.trim() || undefined
      );
      const { session_id, websocket_url } = res;
      setSessionId(session_id);
      if (sessionTransport === 'webrtc') {
        if (!res.livekit?.token || !res.livekit?.url) {
          setIsConnecting(false);
          setStatus('LiveKit unavailable');
          setLivekitHint(res.livekit_error || 'Configure LIVEKIT_* on the voicebot server and install livekit-api.');
          return;
        }

        const room = new LiveKitRoom();
        livekitRoomRef.current = room;
        try {
          await room.connect(res.livekit.url, res.livekit.token);

          // Use high-quality constraints for the microphone
          const micTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          await room.localParticipant.publishTrack(micTrack);

          room.on('dataReceived', (payload) => {
            const decoder = new TextDecoder();
            const text = decoder.decode(payload);
            try {
              const msg = JSON.parse(text);
              handleIncomingMessage(msg);
            } catch (e) {
              console.error('Failed to parse data channel message:', e);
            }
          });

          // CRITICAL: Attach remote tracks to play audio!
          room.on('trackSubscribed', (track) => {
            if (track.kind === 'audio') {
              track.attach();
            }
          });
        } catch (lkErr) {
          livekitRoomRef.current = null;
          try { await room.disconnect(); } catch { }
          throw lkErr;
        }
        setIsLive(true);
        setIsConnecting(false);
        setStatus(`LiveKit · ${res.livekit.room_name}`);
        return;
      }

      const wsUrl = userId.trim()
        ? `${websocket_url}${websocket_url.includes('?') ? '&' : '?'}user_id=${encodeURIComponent(userId.trim())}`
        : websocket_url;
      const socket = new WebSocket(getVoiceWebSocketUrl(wsUrl));
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        resetBotPlaybackCoalesce();
        setIsLive(true);
        setIsConnecting(false);
        setStatus('Connecting...');
        startMic(socket);
        if (isTestMode && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'test_interruption' }));
        }
      };

      socket.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          handleIncomingMessage(msg);
        } else {
          playAudioChunk(event.data);
        }
      };

      socket.onclose = (event) => {
        setIsLive(false);
        setIsConnecting(false);
        if (event.code === 4000) {
          setStatus('Initialization Failed');
        } else if (event.code !== 1000 && event.code !== 1005) {
          setStatus('Connection Lost');
          setLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            tag: '[WARN]',
            content: `WebSocket closed abnormally (code: ${event.code})`,
            color: 'text-yellow-400'
          }]);
        } else {
          setStatus('Disconnected');
        }
        setWs(null);
        wsRef.current = null;
        stopAudio();
      };

      setWs(socket);
      wsRef.current = socket;
    } catch (err) {
      console.error('Failed to start session:', err);
      setIsConnecting(false);
      setStatus('Start Failed');
      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tag: '[FATAL]',
        content: err instanceof Error ? err.message : 'Failed to create session on backend.',
        color: 'text-error font-bold'
      }]);
    }
  };
  // Auto-scroll transcripts
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs, activeLogTab]);

  const endSession = () => {
    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (ws) {
      ws.close();
    }
    stopAudio();
    setIsLive(false);
    setStatus('Standby');
  };

  const sendInterrupt = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  };

  const handleExportLogs = () => {
    setIsExporting(true);
    // Simulate log generation and download
    setTimeout(() => {
      const logs = [
        { time: "14:22:01.442", tag: "[TOOL]", content: "calling search_knowledge..." },
        { time: "14:22:01.581", tag: "[RESULT]", content: "Hours are 9-6, Mon-Fri" },
        { time: "14:22:01.590", tag: "[PROMPT]", content: "Synthesizing TTS response..." },
        { time: "14:22:01.810", tag: "[STREAM]", content: "Audio chunks pushing to client_id: 8842" }
      ];
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_logs_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExporting(false);
    }, 1500);
  };
  return (
    <div className="flex-1 flex flex-col  relative">
      <Header
        title={selectedBot ? `Session Control: ${selectedBot.name}` : 'Session Control'}
        subtitle={isLive ? 'Live Operations • Session Active' : 'Standby Mode'}
        hideGlass={isPersonaSelectorOpen}
        className={isPersonaSelectorOpen ? "bg-white" : ""}
        actions={
          <>
            {/* ── Bot Selector ────────────────────────────────── */}
            <div className="relative" ref={botRef}>
              <button
                onClick={() => setIsBotSelectorOpen(!isBotSelectorOpen)}
                disabled={isConnecting || isLive}
                className="bg-surface-high text-on-surface pl-3 pr-2.5 py-2 rounded-xl font-semibold text-sm hover:bg-surface-highest transition-all flex items-center gap-1.5 border border-outline-variant/10 shadow-sm disabled:opacity-70 max-w-[160px] w-90 sm:max-w-none"
              >
                <BotIcon className="size-4 text-primary shrink-0" />
                <span className="truncate hidden xs:inline sm:inline">{selectedBot?.name || 'Select Agent'}</span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-outline transition-transform", isBotSelectorOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isBotSelectorOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-110 bg-black/2 backdrop-blur-[2px] pointer-events-none"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute top-full right-0 mt-4 max-w-[60vw] bg-white rounded-[40px] p-10 z-120 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] border border-outline-variant/10 overflow-hidden"
                    >
                      {/* Ambient Background Glows */}
                      <div className="absolute -top-24 -left-24 size-96 bg-primary/5 blur-[100px] pointer-events-none" />
                      <div className="absolute -bottom-24 -left-24 size-96 bg-violet-500/5 blur-[100px] pointer-events-none" />

                      <div className="relative flex items-center justify-between mb-8 px-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-primary animate-pulse" />
                            <h4 className="text-2xl font-headline font-black text-on-surface tracking-tighter uppercase">Bot <span className="text-primary">Factory</span></h4>
                          </div>
                          <p className="text-[10px] text-outline uppercase tracking-[0.3em] font-black opacity-60">Deployed Neural Voice Agents</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-2xl">
                            <div className="size-2 rounded-full bg-primary animate-ping" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{availableBots.filter(b => b.is_active).length} Active Nodes</span>
                          </div>
                        </div>
                      </div>

                      <div className="relative group/slider">
                        <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory custom-scrollbar-horizontal select-none">
                          {availableBots.map((bot) => (
                            <motion.div
                              key={bot.id}
                              whileHover={{ y: -6 }}
                              className={cn(
                                "flex flex-col p-6 rounded-[32px] min-w-[320px] snap-center transition-all duration-500 text-left overflow-hidden bg-white border border-outline-variant/10 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)]",
                                selectedBot?.id === bot.id && "ring-2 ring-primary/10"
                              )}
                            >
                              {/* Card Header */}
                              <div className="flex justify-between items-center mb-4 border-b border-outline-variant/4 pb-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-12 shrink-0 rounded-[18px] bg-surface-low border border-outline-variant/5 flex items-center justify-center text-primary/40 shadow-inner group-hover:bg-primary/5 transition-colors">
                                    <BotIcon className="size-6" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-headline font-black text-on-surface tracking-tight leading-tight">{bot.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.12em]">{bot.default_language?.toUpperCase() || 'EN'}</p>
                                      {bot.is_active && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                          <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest leading-none">Active</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                {/* <p className="text-[11px] font-bold text-outline/60 tracking-tight">{bot.role}</p> */}

                                <div className="p-4 rounded-[20px] bg-surface-low/50 border border-outline-variant/5 transition-colors h-20 overflow-hidden">
                                  <p className="text-xs leading-relaxed italic text-on-surface-variant font-medium line-clamp-3">
                                    &ldquo;{bot.description || bot.persona}&rdquo;
                                  </p>
                                </div>


                                <button
                                  onClick={() => {
                                    setSelectedBot(bot);
                                    setIsBotSelectorOpen(false);
                                    if (ws?.readyState === WebSocket.OPEN) {
                                      ws.send(JSON.stringify({ type: 'switch_bot', bot_id: bot.id }));
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group/btn border",
                                    selectedBot?.id === bot.id
                                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                      : "bg-surface-low hover:bg-primary text-primary hover:text-white border-outline-variant/5"
                                  )}
                                >
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Select Bot</span>
                                  {selectedBot?.id === bot.id ? (
                                    <Check className="size-3.5" />
                                  ) : (
                                    <ChevronRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                                  )}
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Slider Overlay Navigation Hints */}
                        <div className="absolute inset-y-0 -left-4 w-12 bg-linear-to-r from-white to-transparent pointer-events-none z-10" />
                        <div className="absolute inset-y-0 -right-4 w-12 bg-linear-to-l from-white to-transparent pointer-events-none z-10" />
                      </div>

                      <div className="mt-2 flex items-center justify-between px-2">
                        <div className="flex items-center gap-6">
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map(i => (
                              <div key={i} className={cn("size-1.5 rounded-full transition-all duration-300", i === 0 ? "w-4 bg-primary" : "bg-outline-variant/30")} />
                            ))}
                          </div>
                          <p className="text-[9px] font-bold text-outline uppercase tracking-widest">Swipe to explore bot profiles</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* ── Persona Selector ────────────────────────────── */}
            <div className="relative" ref={personaRef}>
              <button
                onClick={() => setIsPersonaSelectorOpen(!isPersonaSelectorOpen)}
                className="bg-surface-high text-on-surface pl-3 pr-2.5 py-2 rounded-xl font-semibold text-sm hover:bg-surface-highest transition-all flex items-center gap-1.5 border border-outline-variant/10 shadow-sm"
              >
                <Users className="size-4 text-primary shrink-0" />
                <span className="truncate hidden xs:inline sm:inline">
                  {selectedPersona ? `${selectedPersona.name} (${selectedPersona.language})` : 'Personas'}
                </span>
                <ChevronDown className={cn("size-3.5 shrink-0 text-outline transition-transform", isPersonaSelectorOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isPersonaSelectorOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-110 bg-black/2 backdrop-blur-[2px] pointer-events-none"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute top-full right-0 mt-4 max-w-[70vw] bg-white rounded-[40px] p-10 z-120 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] border border-outline-variant/10 overflow-hidden"
                    >
                      {/* Ambient Background Glows */}
                      <div className="absolute -top-24 -left-24 size-96 bg-primary/5 blur-[100px] pointer-events-none" />
                      <div className="absolute -bottom-24 -right-24 size-96 bg-violet-500/5 blur-[100px] pointer-events-none" />

                      <div className="relative flex items-center justify-between mb-8 px-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-primary animate-pulse" />
                            <h4 className="text-2xl font-headline font-black text-on-surface tracking-tighter uppercase">Persona <span className="text-primary">Library</span></h4>
                          </div>
                          <p className="text-[10px] text-outline uppercase tracking-[0.3em] font-black opacity-60">High-fidelity Neural Identity Profiles</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-2xl">
                            <div className="size-2 rounded-full bg-primary animate-ping" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{availablePersonas.filter(p => p.isDeployed).length} Active Nodes</span>
                          </div>
                        </div>
                      </div>

                      <div className="relative group/slider">
                        <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory custom-scrollbar-horizontal select-none">
                          {availablePersonas.filter(p => p.isDeployed).map((p) => (
                            <motion.div
                              key={p.id}
                              whileHover={{ y: -6 }}
                              className={cn(
                                "flex flex-col p-6 rounded-[32px] min-w-[320px] snap-center transition-all duration-500 text-left overflow-hidden bg-white border border-outline-variant/10 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)]",
                                selectedPersona?.id === p.id && "ring-2 ring-primary/10"
                              )}
                            >
                              {/* Card Header */}
                              <div className="flex justify-between items-center mb-4 border-b border-outline-variant/4 pb-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-12 shrink-0 rounded-[18px] bg-surface-low border border-outline-variant/5 flex items-center justify-center text-primary/40 shadow-inner group-hover:bg-primary/5 transition-colors">
                                    <UserRound className="size-6" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-headline font-black text-on-surface tracking-tight leading-tight">{p.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.12em]">{p.language.toUpperCase()}</p>
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest leading-none">Active</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* <div className="flex gap-2">
                                  <button className="p-2.5 rounded-xl bg-surface-low hover:bg-surface-high text-outline transition-all border border-outline-variant/10">
                                    <Edit2 className="size-4" />
                                  </button>
                                  <button className="p-2.5 rounded-xl bg-surface-low hover:bg-error/10 text-outline hover:text-error transition-all border border-outline-variant/10">
                                    <Trash2 className="size-4" />
                                  </button>
                                </div> */}
                              </div>

                              <div className="space-y-4">
                                <p className="text-[11px] font-bold text-outline/60 tracking-tight">{p.tone} · {p.useCase}</p>

                                <div className="p-4 rounded-[20px] bg-surface-low/50 border border-outline-variant/5 transition-colors">
                                  <p className="text-xs leading-relaxed italic text-on-surface-variant font-medium">
                                    &ldquo;{p.psychology || p.emotion}&rdquo;
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 rounded-xl bg-surface-low/50 border border-outline-variant/5">
                                    <p className="text-[7px] font-black text-outline uppercase mb-1.5 flex items-center gap-1 opacity-60">
                                      <ActivityIcon className="size-2.5" /> Urgency
                                    </p>
                                    <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${p.urgency}%` }}
                                        className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.2)] transition-all"
                                      />
                                    </div>
                                  </div>
                                  <div className="p-3 rounded-xl bg-surface-low/50 border border-outline-variant/5">
                                    <p className="text-[7px] font-black text-outline uppercase mb-1.5 flex items-center gap-1 opacity-60">
                                      <Sparkles className="size-2.5" /> Empathy
                                    </p>
                                    <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${p.empathy}%` }}
                                        className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedPersona(p);
                                    setIsPersonaSelectorOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group/btn border",
                                    selectedPersona?.id === p.id
                                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                      : "bg-surface-low hover:bg-primary text-primary hover:text-white border-outline-variant/5"
                                  )}
                                >
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Use Persona</span>
                                  {selectedPersona?.id === p.id ? (
                                    <Check className="size-3.5" />
                                  ) : (
                                    <ChevronRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                                  )}
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Slider Overlay Navigation Hints */}
                        <div className="absolute inset-y-0 -left-4 w-12 bg-linear-to-r from-white to-transparent pointer-events-none z-10" />
                        <div className="absolute inset-y-0 -right-4 w-12 bg-linear-to-l from-white to-transparent pointer-events-none z-10" />
                      </div>

                      <div className="mt-2 flex items-center justify-between px-2">
                        <div className="flex items-center gap-6">
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map(i => (
                              <div key={i} className={cn("size-1.5 rounded-full transition-all duration-300", i === 0 ? "w-4 bg-primary" : "bg-outline-variant/30")} />
                            ))}
                          </div>
                          <p className="text-[9px] font-bold text-outline uppercase tracking-widest">Swipe to explore neural nodes</p>
                        </div>
                        {/* <button
                          onClick={() => setIsPersonaSelectorOpen(false)}
                          className="group relative flex items-center gap-2 bg-on-surface text-surface-lowest px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/10 active:scale-95 overflow-hidden"
                        >
                          <span className="relative z-10">Access Console</span>
                          <ArrowRight className="size-3 relative z-10 group-hover:translate-x-1 transition-transform" />
                          <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button> */}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* ── Pre-live: setup controls ─────────────────────── */}
            {!isLive ? (
              <>
                {/* Caller ID + Transport — grouped as a pill pair on sm+, stacked on xs */}
                {/* <div className="hidden sm:flex items-center gap-1.5 bg-surface-high border border-outline-variant/20 rounded-xl px-1 relative">
                  <UserCircle2 className="size-3.5 text-on-surface-variant ml-2 shrink-0" />
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Caller ID"
                      value={userId}
                      onChange={e => setUserId(e.target.value)}
                      onFocus={() => setIsUserSelectorOpen(true)}
                      onBlur={() => setTimeout(() => setIsUserSelectorOpen(false), 200)}
                      disabled={isConnecting}
                      title="Enables cross-session memory. Leave blank for anonymous session."
                      className="bg-transparent text-on-surface py-2 text-sm font-medium w-28 lg:w-36 disabled:opacity-60 outline-none placeholder:text-outline/50"
                    />

                    {isUserSelectorOpen && availableUsers.length > 0 && !isLive && (
                      <div className="absolute top-full left-0 mt-2 w-56 glass-panel rounded-xl p-1.5 z-110 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between px-2 py-1 mb-1">
                          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Select User</span>
                          <button onClick={() => setIsUserSelectorOpen(false)} className="text-outline hover:text-on-surface">
                            <X className="size-3" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                          {availableUsers.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setUserId(u.id);
                                setIsUserSelectorOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 text-left transition-colors group"
                            >
                              <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold group-hover:bg-primary/20">
                                {(u.username || u.id).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-on-surface">
                                  {u.username || u.id}
                                </span>
                                <span className="text-[9px] text-outline truncate">{u.id}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-px h-5 bg-outline-variant/20 mx-0.5 shrink-0" />
                  <select
                    value={sessionTransport}
                    onChange={(e) => setSessionTransport(e.target.value as 'websocket' | 'webrtc')}
                    disabled={isConnecting}
                    title="WebSocket: full voice bot. WebRTC: LiveKit room only."
                    className="bg-transparent text-on-surface py-2 pr-2 text-sm font-semibold outline-none cursor-pointer disabled:opacity-60"
                  >
                    <option value="websocket">WS</option>
                    <option value="webrtc">WebRTC</option>
                  </select>
                </div>
                <button
                  onClick={() => setIsConfigOpen(true)}
                  title="Session Config"
                  className="bg-surface-high text-on-surface px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-highest transition-all flex items-center gap-2 border border-outline-variant/10"
                >
                  <Settings2 className="size-4 shrink-0" />
                  <span className="hidden md:inline">Config</span>
                </button> */}

                {/* Initialize Bridge CTA */}
                <button
                  onClick={() => startSession()}
                  disabled={!selectedBot || isConnecting}
                  className="ember-gradient text-on-primary-fixed px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span className="hidden sm:inline">Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      <span className="hidden sm:inline">Initialize Session</span>
                      <span className="sm:hidden">Init</span>
                    </>
                  )}
                </button>
                {config.testInterruption && sessionTransport === 'websocket' && (
                  <button
                    onClick={() => startSession(true)}
                    disabled={!selectedBot || isConnecting}
                    className="ml-2 bg-primary/10 text-primary border border-primary/20 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Zap className="size-4" />
                    <span className="hidden sm:inline">Test Interruption</span>
                    <span className="sm:hidden">Test</span>
                  </button>
                )}
              </>
            ) : (
              /* ── Live: session controls ──────────────────────── */
              <>
                <button
                  onClick={() => setIsConfigOpen(true)}
                  title="Session Config"
                  className="bg-surface-high text-on-surface px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-highest transition-all flex items-center gap-2 border border-outline-variant/10"
                >
                  <Settings2 className="size-4 shrink-0" />
                  <span className="hidden md:inline">Config</span>
                </button>
                <button
                  onClick={handleExportLogs}
                  disabled={isExporting}
                  title="Export Logs"
                  className="bg-surface-highest text-on-surface px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-sm border border-white/10 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4 shrink-0" />}
                  <span className="hidden md:inline">Logs</span>
                </button>
                <button
                  onClick={endSession}
                  title="Terminate Session"
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-sm border border-red-500/20 transition-all flex items-center gap-2"
                >
                  <XCircle className="size-4 shrink-0" />
                  <span className="hidden md:inline">Terminate</span>
                </button>
              </>
            )}
          </>
        }
      />
      {livekitHint && (
        <div className="px-10 py-2 text-xs text-on-surface-variant bg-primary/5 border-b border-outline-variant/10">
          {livekitHint}
        </div>
      )}

      <AnimatePresence>
        {isConfigOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface-low border-l border-outline-variant/10 z-201 shadow-2xl p-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="font-headline text-2xl font-extrabold text-on-surface">Session <span className="text-primary">Config</span></h2>
                  <p className="text-xs text-outline uppercase tracking-widest mt-1">Runtime Parameters</p>
                </div>
                <button
                  onClick={() => setIsConfigOpen(false)}
                  className="size-10 rounded-full hover:bg-surface-highest flex items-center justify-center transition-all"
                >
                  <X className="size-6" />
                </button>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                <ConfigToggle
                  icon={ShieldCheck}
                  label="Auto-Recording"
                  description="Save audio stream to cloud storage"
                  active={config.autoRecording}
                  onToggle={() => setConfig(prev => ({ ...prev, autoRecording: !prev.autoRecording }))}
                />

                <ConfigToggle
                  icon={Volume2}
                  label="Noise Suppression"
                  description="Filter background noise in real-time"
                  active={config.noiseSuppression}
                  onToggle={() => setConfig(prev => ({ ...prev, noiseSuppression: !prev.noiseSuppression }))}
                />

                <ConfigToggle
                  icon={Zap}
                  label="Test Interruption"
                  description="Enable barge-in testing button in logs"
                  active={config.testInterruption}
                  onToggle={() => setConfig(prev => ({ ...prev, testInterruption: !prev.testInterruption }))}
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-on-surface">
                    <Zap className="size-5 text-primary" />
                    <span className="font-bold text-sm uppercase tracking-widest">Latency Mode</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['ultra-low', 'balanced'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setConfig(prev => ({ ...prev, latencyMode: mode }))}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all",
                          config.latencyMode === mode
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-surface-highest border-outline-variant/10 text-outline hover:border-primary/30"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-on-surface">
                      <Cpu className="size-5 text-primary" />
                      <span className="font-bold text-sm uppercase tracking-widest">Temperature</span>
                    </div>
                    <span className="text-primary font-mono font-bold">{config.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-surface-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-outline font-bold uppercase tracking-tighter">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-10">
                <button
                  onClick={() => setIsConfigOpen(false)}
                  className="w-full py-4 rounded-2xl ember-gradient text-on-primary-fixed font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Apply Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 flex flex-col min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 sm:gap-6 lg:gap-8 flex-1 min-h-0">
          {/* Left Panel */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 min-h-0">
            <div className="glass-panel rounded-3xl p-6 sm:p-10 lg:p-12 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px] lg:min-h-[460px] relative overflow-hidden">
              {/* Voice Orb Animation */}
              <div className="absolute inset-0 bg-primary/5 blur-[100px]"></div>

              <div className="relative size-48 sm:size-56 lg:size-64 flex items-center justify-center">
                {/* [SENTIMENT-AWARE] Glow logic: Cyan (positive), Red (negative), Amber (neutral) */}

                {isLive && (
                  <>
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        borderColor: currentSentiment === 'positive' ? 'rgba(52, 211, 153, 0.4)' :
                          currentSentiment === 'negative' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(251, 191, 36, 0.4)'
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 border rounded-full blur-xs"
                    />
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        borderColor: currentSentiment === 'positive' ? 'rgba(52, 211, 153, 0.6)' :
                          currentSentiment === 'negative' ? 'rgba(248, 113, 113, 0.6)' : 'rgba(251, 191, 36, 0.6)'
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      className="absolute inset-10 border rounded-full"
                    />
                  </>
                )}

                <motion.div
                  animate={{
                    boxShadow: currentSentiment === 'positive' ? '0 0 60px rgba(52, 211, 153, 0.5)' :
                      currentSentiment === 'negative' ? '0 0 60px rgba(248, 113, 113, 0.5)' : '0 0 40px rgba(251, 191, 36, 0.3)',
                    scale: isLive ? 1 : 0.9,
                    rotate: isLive ? 360 : 0
                  }}
                  transition={{
                    boxShadow: { duration: 1 },
                    rotate: isLive ? { duration: 20, repeat: Infinity, ease: "linear" } : 0
                  }}
                  className={cn(
                    "size-32 sm:size-36 lg:size-40 rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden",
                    currentSentiment === 'positive' ? "bg-linear-to-tr from-emerald-900 via-teal-800 to-emerald-600" :
                      currentSentiment === 'negative' ? "bg-linear-to-tr from-red-900 via-rose-800 to-red-600 shadow-red-500/20" :
                        "bg-linear-to-tr from-indigo-900 via-cyan-800 to-indigo-600"
                  )}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                  <Activity className="size-10 sm:size-12 lg:size-16 text-white relative z-10" />
                </motion.div>
              </div>

              <div className="mt-8 text-center z-10">
                <h3 className="font-headline text-2xl font-bold text-on-surface uppercase tracking-widest">
                  {status}
                </h3>
                {isHandoffAnimating && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2"
                  >
                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/30">
                      Neural Shift
                    </span>
                  </motion.div>
                )}
                <p className={cn(
                  "font-label text-xs uppercase tracking-[0.2em] mt-2",
                  isLive ? "text-primary animate-pulse" : "text-outline"
                )}>
                  {isLive ? 'Neural Bridge Active' : 'System Standby'}
                </p>
              </div>

              {isLive && (
                <div className="mt-6 sm:mt-10 flex flex-wrap justify-center gap-3 z-10 animate-in fade-in slide-in-from-bottom-4">
                  <button
                    onClick={sendInterrupt}
                    className="bg-red-900/40 hover:bg-red-800/60 text-red-100 border border-red-500/30 px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold transition-all backdrop-blur-md flex items-center gap-2 sm:gap-3 active:scale-95 text-sm"
                  >
                    <StopCircle className="size-4 sm:size-5" />
                    Interrupt
                  </button>
                  <button
                    onClick={endSession}
                    className="bg-surface-highest/60 hover:bg-surface-highest text-on-surface border border-outline-variant/20 px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold transition-all backdrop-blur-md flex items-center gap-2 sm:gap-3 active:scale-95 text-sm"
                  >
                    <XCircle className="size-4 sm:size-5" />
                    End Session
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard label="STT Latency" value={metrics.stt.toString()} unit="ms" color="border-primary/40" />
              <MetricCard label="LLM TTFT" value={metrics.llm.toString()} unit="ms" color="border-cyan-500/40" />
              <MetricCard label="TTS Latency" value={metrics.tts.toString()} unit="ms" color="border-indigo-500/40" />
              <MetricCard label="Total RTT" value={metrics.total.toString()} unit="ms" color="border-white/20" highlight />
            </div>

            {/* Real-time Performance Visualization */}
            <div className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <TelemetryCharts data={historicalMetrics} />
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col gap-4 sm:gap-5 min-h-0">
            <div className="surface-high rounded-3xl p-4 sm:p-6 border border-outline-variant/10 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Infrastructure</h4>
                <span className="text-[10px] text-outline">UPTIME: {infra.uptime}</span>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <StatusBadge label="Redis" status={infra.redis} />
                <StatusBadge label={infra.stt_provider || "STT"} status={infra.stt} />
                <StatusBadge label={infra.llm_provider || "LLM"} status={infra.llm} />
                <StatusBadge label={infra.tts_provider || "TTS"} status={infra.tts} />
              </div>
            </div>

            {/* Cognitive Load Widget */}
            {/* <div className={cn(
              "glass-panel rounded-3xl p-4 sm:p-6 transition-all duration-700 shrink-0",
              tokenPulse ? "border-primary/50 shadow-[0_0_40px_rgba(251,140,0,0.15)] ring-1 ring-primary/30" : "border-outline-variant/10"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className={cn("size-4 transition-colors", tokenPulse ? "text-primary" : "text-on-surface-variant")} />
                  <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cognitive Load</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <AnimatePresence>
                    {tokenPulse && (
                      <motion.span 
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[10px] font-black text-primary px-1.5 py-0.5 rounded bg-primary/10"
                      >
                         PULSED
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="text-[10px] text-outline font-mono">LIVE CONSUMPTION</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-outline tracking-tighter opacity-70">Session Input</p>
                  <p className="text-xl font-headline font-black text-on-surface">
                    {sessionTokens.input.toLocaleString()}
                    <span className="text-[10px] font-normal text-outline/50 ml-1">tokens</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-outline tracking-tighter opacity-70">Session Output</p>
                  <p className={cn("text-xl font-headline font-black transition-colors", tokenPulse ? "text-primary" : "text-on-surface")}>
                     {sessionTokens.output.toLocaleString()}
                     <span className="text-[10px] font-normal text-outline/50 ml-1">tokens</span>
                  </p>
                </div>
              </div> */}

            {/* <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-outline uppercase tracking-widest">Efficiency</span>
                        <span className={cn("text-xs font-bold transition-colors", toolSuccessRate < 90 ? "text-amber-400" : "text-emerald-400")}>
                          {toolSuccessRate}% Precision
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-outline uppercase tracking-widest">Total cost</span>
                        <span className="text-xs font-bold text-on-surface">
                          ${(() => {
                            const model = modelLimits.find(m => m.id === (selectedBot?.llm_model || 'llama-3.3-70b-versatile'));
                            const rate = model?.cost_per_1k || 0.002;
                            return ((sessionTokens.total / 1000) * rate).toFixed(4);
                          })()}
                        </span>
                    </div>
                 </div> */}

            {/* Token Headroom / Context Window Progress */}
            {/* {(() => {
                    const model = modelLimits.find(m => m.id === (selectedBot?.llm_model || 'llama-3.3-70b-versatile'));
                    if (!model) return null;
                    const percent = Math.min(100, (sessionTokens.total / (model.context_window || 128000)) * 100);
                    return (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] uppercase font-black tracking-widest text-outline">
                          <span>Context Headroom</span>
                          <span>{sessionTokens.total.toLocaleString()} / {(model.context_window || 128000).toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-surface-highest rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className={cn(
                              "h-full transition-all duration-1000",
                              percent > 80 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : 
                              percent > 50 ? "bg-amber-500" : "bg-primary"
                            )}
                          />
                        </div>
                      </div>
                    );
                 })()}
              </div> */}
            {/* </div> */}

            <div className="glass-panel rounded-3xl p-4 sm:p-6 flex flex-col flex-1 min-h-[320px] max-h-[calc(100vh-250px)] overflow-hidden">
              {/* Transcript Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Live Transcript</h4>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                  {isLive && (
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "size-2 rounded-full",
                        currentSentiment === 'positive' ? "bg-emerald-400" :
                          currentSentiment === 'negative' ? "bg-red-400 animate-pulse" : "bg-yellow-400"
                      )} />
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        currentSentiment === 'positive' ? "text-emerald-400" :
                          currentSentiment === 'negative' ? "text-red-400" : "text-yellow-400"
                      )}>{currentSentiment}</span>
                    </div>
                  )}
                  {isLive && (
                    <div className="flex items-center gap-1.5 bg-surface-highest/30 px-2 py-1 rounded-lg ghost-border">
                      {isTranslating ? (
                        <Loader2 className="size-3 text-primary animate-spin" />
                      ) : (
                        <Languages className="size-3 text-outline" />
                      )}
                      <select
                        value={targetLanguage}
                        onChange={(e) => handleTranslate(e.target.value)}
                        disabled={isTranslating}
                        className="bg-transparent border-none text-[9px] font-bold uppercase tracking-wider outline-none focus:ring-0 cursor-pointer"
                      >
                        <option value="" className="bg-surface-low text-on-surface">Original</option>
                        {SUPPORTED_LANGUAGES.map(l => (
                          <option key={l.code} value={l.name} className="bg-surface-low text-on-surface">{l.name}</option>
                        ))}
                      </select>
                      {isTranslating && (
                        <button
                          onClick={cancelTranslate}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-0.5 rounded transition-all ml-1"
                          title="Cancel Translation"
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {isLive && (
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] text-primary font-bold uppercase hidden sm:inline">Real-time STT</span>
                      <span className="text-[10px] text-primary font-bold uppercase sm:hidden">STT</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sentiment Alert Banner */}
              {negativeSentimentCount >= 3 && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 animate-pulse shrink-0">
                  <div className="size-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Sentiment Alert — Caller distress detected</span>
                </div>
              )}

              {/* Scrollable transcript body — min-h-0 is required for overflow-y to engage in a flex column */}
              <div
                ref={transcriptRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 sm:pr-2 custom-scrollbar scroll-smooth"
              >
                {transcripts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-40">
                    <div className="size-14 rounded-full bg-surface-highest flex items-center justify-center mb-3">
                      <Terminal className="size-7 text-outline" />
                    </div>
                    <p className="text-sm font-medium">Waiting for communication...</p>
                  </div>
                ) : (
                  optimizedTranscripts.map((t, i) => (
                    <div key={i} className={cn(
                      "flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300",
                      t.role === 'User' ? "items-end pl-6 sm:pl-10" : "items-start pr-6 sm:pr-10"
                    )}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-widest",
                          t.role === 'User' ? "text-outline order-2" : "text-primary ml-1"
                        )}>
                          {t.role === 'Bot' ? (selectedBot?.name || 'Bot') : 'YOU'}
                        </span>
                        <span className="text-[8px] text-outline/40 font-mono">
                          {t.time}
                        </span>
                        {t.sentiment && (
                          <div
                            className={cn(
                              "size-1.5 rounded-full",
                              t.sentiment === 'positive' ? "bg-emerald-400" :
                                t.sentiment === 'negative' ? "bg-red-400" : "bg-yellow-400"
                            )}
                            title={`Sentiment: ${t.sentiment}`}
                          />
                        )}
                      </div>

                      <div className={cn(
                        "px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-sm shadow-sm transition-all relative",
                        t.role === 'User'
                          ? "bg-surface-highest text-on-surface rounded-tr-none border border-white/5"
                          : "bg-primary/10 border border-primary/20 text-on-surface rounded-tl-none"
                      )}>
                        {t.text}
                        {!t.isFinal && <span className="inline-block ml-1 opacity-40 animate-pulse">...</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Simulator text input */}
              {isLive && (
                <div className="mt-3 pt-3 border-t border-white/5 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('query') as HTMLInputElement;
                      if (input.value && ws) {
                        ws.send(JSON.stringify({ type: 'text_query', text: input.value }));
                        input.value = '';
                      }
                    }}
                    className="relative"
                  >
                    <input
                      name="query"
                      type="text"
                      placeholder="Type a message (Simulator Mode)..."
                      className="w-full bg-surface-highest border border-white/5 rounded-xl py-2.5 pl-4 pr-11 text-sm focus:outline-none focus:border-primary/40 transition-all text-on-surface"
                    />
                    <button type="submit" className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all">
                      <Zap className="size-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="surface-lowest rounded-3xl p-4 sm:p-6 font-mono text-[10px] h-[220px] sm:h-[260px] lg:h-[300px] flex flex-col shrink-0 border border-outline-variant/5">
              <div className="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-2">
                <div className="flex items-center gap-3">
                  <Terminal className="size-4 text-primary" />
                  <span className="uppercase tracking-widest font-bold text-on-surface-variant">Neural Logs</span>
                  {isLive && config.testInterruption && sessionTransport === 'websocket' && (
                    <button
                      onClick={() => ws?.send(JSON.stringify({ type: 'test_interruption' }))}
                      className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center gap-1 shadow-sm"
                      title="Test barge-in logic without LLM latency"
                    >
                      <Zap className="size-2.5" />
                      Test Interruption
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <TabButton active={activeLogTab === 'neural'} onClick={() => setActiveLogTab('neural')}>Pathway</TabButton>
                  <TabButton active={activeLogTab === 'tools'} onClick={() => setActiveLogTab('tools')}>Tool Engine</TabButton>
                  <TabButton active={activeLogTab === 'vitals'} onClick={() => setActiveLogTab('vitals')}>Vitals</TabButton>
                  <TabButton active={activeLogTab === 'entities'} onClick={() => setActiveLogTab('entities')}>
                    <span className="flex items-center gap-1">Entities{entities.length > 0 && <span className="bg-primary/20 text-primary px-1 rounded">{entities.length}</span>}</span>
                  </TabButton>
                </div>
              </div>

              <div
                ref={logRef}
                className="flex-1 overflow-y-auto space-y-1 custom-scrollbar"
              >
                {activeLogTab === 'vitals' ? (
                  <div className="py-2 flex flex-col items-center justify-center h-full text-outline/30 space-y-2">
                    <Zap className="size-8 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center">
                      Telemetry Active<br />
                      <span className="font-normal normal-case">Charts moved to primary status display</span>
                    </p>
                  </div>
                ) : activeLogTab === 'entities' ? (
                  entities.length === 0 ? (
                    <div className="text-outline/40 italic flex items-center justify-center h-full pt-10">
                      {isLive ? 'Listening for entities...' : 'No entities extracted yet'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {entities.map((e, i) => (
                        <div key={i} className="bg-surface-container-highest rounded-lg px-3 py-1.5 flex items-center gap-2">
                          <span className="text-[9px] uppercase font-bold text-on-surface-variant">{e.key}:</span>
                          <span className="text-xs text-secondary font-semibold">{e.value}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  (() => {
                    const filtered = optimizedLogs.filter(log => {
                      if (activeLogTab === 'neural') return ['[STATE]', '[BRAIN]', '[VOICE]', '[EARS]', '[THINKING]'].includes(log.tag);
                      if (activeLogTab === 'tools') return ['[TOOL]', '[RESULT]', '[PLAN]'].includes(log.tag);
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-outline/40 italic flex items-center justify-center h-full pt-10">
                          {isLive ? `Monitoring ${activeLogTab} activity...` : 'Bridge Disconnected'}
                        </div>
                      );
                    }

                    return filtered.map((log, i) => (
                      <LogLine
                        key={i}
                        time={log.time}
                        tag={log.tag}
                        content={log.content}
                        color={log.color}
                      />
                    ));
                  })()
                )}
                {isLive && activeLogTab !== 'entities' && <div className="animate-pulse text-primary pt-1">_</div>}
              </div>
            </div>
          </div>
        </div>
      </main >
    </div >
  );
}

function MetricCard({ label, value, unit, color, highlight }: any) {
  return (
    <div className={cn("bg-surface-low rounded-2xl p-6 border-l-2 transition-all duration-300", color, "hover:bg-surface-high")}>
      <p className="text-[10px] uppercase tracking-wider text-outline/60 mb-1.5 font-bold">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <motion.span
          key={value}
          initial={{ scale: 1.15, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn("text-2xl font-headline font-black", highlight ? "text-primary" : "text-on-surface")}
        >
          {value}
        </motion.span>
        <span className="text-xs font-bold text-outline uppercase tracking-tighter">{unit}</span>
      </div>
    </div>
  );
}

function StatusBadge({ label, status = 'online' }: any) {
  const cfg: Record<string, { dot: string; border: string; pill: string; hint: string }> = {
    online: { dot: 'bg-green-500', border: 'border-green-500/20', pill: '', hint: 'Online' },
    offline: { dot: 'bg-red-500', border: 'border-red-500/30', pill: 'bg-red-500/10 text-red-400', hint: 'Offline' },
    simulator: { dot: 'bg-yellow-400', border: 'border-yellow-400/30', pill: 'bg-yellow-400/10 text-yellow-400', hint: 'Simulator' },
    degraded: { dot: 'bg-orange-400', border: 'border-orange-400/30', pill: 'bg-orange-400/10 text-orange-400', hint: 'Degraded' },
    unavailable: { dot: 'bg-zinc-500', border: 'border-zinc-500/20', pill: 'bg-zinc-500/10 text-zinc-400', hint: 'N/A' },
  };
  const s = cfg[status] ?? cfg.offline;
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-lg border transition-colors',
        s.border,
        s.pill,
      )}
      title={`${label}: ${s.hint}`}
    >
      <div className={cn(
        'size-1.5 rounded-full shrink-0',
        s.dot,
        status === 'online' && 'animate-pulse',
      )} />
      <span className="text-xs font-medium">{label}</span>
      {status !== 'online' && (
        <span className="text-[10px] opacity-70 font-mono">{s.hint}</span>
      )}
    </div>
  );
}

function LogLine({ time, tag, content, color }: any) {
  return (
    <div className="flex gap-3 leading-tight mb-1">
      <span className="text-outline/40 shrink-0">{time}</span>
      <span className={cn("shrink-0 min-w-[60px]", color)}>{tag}</span>
      <span className="text-on-surface/80 break-all">{content}</span>
    </div>
  );
}

function TabButton({ active, children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tighter transition-all",
        active ? "bg-primary/20 text-primary" : "text-outline hover:bg-surface-highest"
      )}
    >
      {children}
    </button>
  );
}

function ConfigToggle({ icon: Icon, label, description, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className={cn(
          "size-10 rounded-xl flex items-center justify-center transition-all",
          active ? "bg-primary/10 text-primary" : "bg-surface-highest text-outline"
        )}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface">{label}</p>
          <p className="text-[10px] text-outline uppercase tracking-wider">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all",
          active ? "bg-primary" : "bg-surface-highest"
        )}
      >
        <motion.div
          animate={{ x: active ? 24 : 4 }}
          className="absolute top-1 size-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}

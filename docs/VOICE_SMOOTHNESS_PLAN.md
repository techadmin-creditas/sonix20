# Voice Smoothness Improvement Plan
## Achieving Gemini / Alexa-Grade Conversational Fluency

---

## 1. Executive Summary

The current voicebot uses a classic **STT → LLM → TTS** pipeline over WebSocket. While functionally correct, it has identifiable latency stacks and jitter sources that produce audible gaps between sentences, noticeable delay after user speech, and occasional dead-air moments.

This document audits every gap in the pipeline with line-level evidence, then prescribes targeted improvements ordered by **impact vs effort**. The goal is to compress perceived turn-around time from the current **800–2200 ms** to under **400 ms** for the first audio byte, and to eliminate audible inter-sentence gaps entirely.

### Current vs Target

| Metric | Current | Target |
|---|---|---|
| First audio after user stops | 600 – 2200 ms | < 400 ms |
| Inter-sentence gap (bot speaking) | 80 – 300 ms | < 30 ms |
| Echo / false-interruption rate | Medium | Near-zero |
| Bot playback jitter | Variable (128 ms chunks) | ≤ 20 ms normalized |
| Cold-start LLM delay | 500 – 1000 ms | < 50 ms (warm pool) |

---

## 2. Current Architecture Audit

### 2.1 Full Pipeline with Latency Numbers

```
User finishes speaking
        │
        ▼  [Deepgram VAD]
        │  endpointing = 200 ms
        │  utterance_end_ms = 1000 ms
        ▼
  _wait_for_silence()           ← 50 – 400 ms   (brain.py:388)
        │
        ▼
  Guardrail check (PII)         ← 10 – 50 ms
        │
        ▼
  Semantic cache lookup (Redis) ← 10 – 50 ms    (brain.py:779)
        │        │
        │  MISS  ▼
        │   Groq LLM cold start ← 0 – 1000 ms   (first call only)
        │   Groq TTFT           ← 100 – 300 ms   (groq_provider.py:111)
        │
        ▼  First sentence complete (punctuation boundary)
  _is_sentence_boundary()       ← 0 – 200 ms    (brain.py:1166)
        │
        ▼
  HTTP POST to Deepgram TTS     ← 50 ms TCP + headers
  Deepgram TTS TTFS             ← 200 – 400 ms  (per request)
        │
        ▼  4096-byte chunks (128 ms each)
  on_audio_output → client      ← variable chunk delivery
        │
        ▼  (Next sentence waits for another boundary + new HTTP POST)
  Inter-segment gap             ← 80 – 300 ms
```

**Worst-case first audio byte**: 400 + 50 + 50 + 1000 + 300 + 200 + 400 = **2400 ms**

**Best-case (cache hit)**: 50 + 10 + 30 + 200 = **290 ms**

### 2.2 Gap Sources by Category

| Gap Type | Location | Magnitude | Root Cause |
|---|---|---|---|
| Turn-detection silence wait | `brain.py:388` | 50–400 ms | Confidence-based silence timer |
| LLM cold start | `groq_provider.py:46` | 0–1000 ms | Lazy client init |
| Groq TTFT | `groq_provider.py:111` | 100–300 ms | Network + model loading |
| Sentence boundary wait | `brain.py:1166` | 0–200 ms | Waiting for `.!?` or char cap |
| **HTTP POST per TTS segment** | `deepgram_tts_provider.py:72` | **200–400 ms** | **New connection per segment** |
| TTS chunk delivery jitter | `deepgram_tts_provider.py:82` | 50–150 ms | 4096-byte chunks, variable |
| Inter-segment gap (chunked mode) | `brain.py:570–599` | 80–300 ms | Sequential HTTP POST calls |
| Redis cache miss | `brain.py:779` | 10–50 ms | Round-trip to Redis |
| State transition callbacks | `brain.py:184` | 5–20 ms | Async fan-out on each transition |
| LiveKit track settle time | `livekit_agent.py:188` | **1000 ms** | Hard sleep on track subscribe |

---

## 3. Improvement Areas

### Priority Matrix

```
High Impact  │  [1] Persistent TTS WS   [3] Buffer Normalization
             │  [2] First-Sentence Fast  [4] LLM Prewarm Pool
             │
Medium       │  [5] VAD Tuning           [7] Echo Gate
             │  [6] TTS Char Reduction   [8] State Callbacks
             │
Low          │  [9] LiveKit Settle       [10] Redis Prefetch
             └─────────────────────────────────────────────────
              Low Effort              High Effort
```

---

## 4. Improvement 1: Persistent WebSocket TTS (Highest Impact)

### Problem

Every TTS segment (`deepgram_tts_provider.py:72`) makes a **new HTTP POST request**. This means:

1. TCP connection setup: ~30–50 ms
2. TLS handshake: ~50–80 ms
3. Deepgram TTFS (Time to First Sound): 200–400 ms

For a 3-sentence response, this overhead is paid **3 times** → 600–1500 ms of pure connection overhead.

### Solution: Deepgram Streaming TTS over WebSocket

Deepgram provides a WebSocket-based TTS endpoint:
```
wss://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=16000
```

Key properties:
- **One connection per session**, kept alive
- Send text via `{"type": "Speak", "text": "..."}`
- Receive audio as binary WebSocket frames in real-time (~50 ms TTFS after text send)
- `{"type": "Flush"}` ensures all buffered audio is emitted
- `{"type": "Reset"}` clears the synthesis buffer (use on interruption)

### New File: `voicebot/services/tts/deepgram_ws_tts_provider.py`

```python
"""
Deepgram WebSocket TTS Provider.

Maintains a persistent WebSocket to Deepgram's streaming TTS API.
Eliminates per-segment HTTP connection overhead.
Expected TTFS: ~50ms vs 200-400ms for the HTTP POST provider.
"""
class DeepgramWSProvider:
    WS_URL = "wss://api.deepgram.com/v1/speak"

    async def connect(self, model: str = "aura-asteria-en"):
        """Open a persistent TTS WebSocket for this session."""
        # Use websockets.connect() with auth header
        # Start background receive task to collect audio chunks
        # Set self._connected = True

    async def speak(self, text: str) -> AsyncIterator[bytes]:
        """
        Send text; yield audio chunks as they arrive.
        Far faster than HTTP POST because the connection is already warm.
        """
        # Send: {"type": "Speak", "text": text}
        # Yield chunks from the audio queue until Flush response arrives

    async def flush(self):
        """Ensure all buffered text is synthesized before next segment."""
        # Send: {"type": "Flush"}
        # Wait for {"type": "Flushed"} acknowledgement

    async def reset(self):
        """Clear synthesis buffer on interruption."""
        # Send: {"type": "Reset"}

    async def disconnect(self):
        """Close the WebSocket at session end."""
```

### Integration in `brain.py`

Replace `_emit_tts_audio_stream` to use the WS provider when available:

```python
async def _emit_tts_audio_stream(self, text: str) -> None:
    await self._set_state(BotState.SPEAKING)
    if hasattr(self.tts, 'speak'):          # WebSocket provider
        async for chunk in self.tts.speak(text):
            if self._interrupt_event.is_set():
                await self.tts.reset()
                break
            if self._on_audio_output:
                await self._on_audio_output(chunk)
    else:                                   # HTTP fallback
        async for chunk in self.tts.stream_speech(text):
            ...
```

### In `handle_interruption`:
```python
if hasattr(self.tts, 'reset'):
    await self.tts.reset()   # Clear Deepgram's synthesis buffer immediately
```

### Expected Gain
- First audio after sentence boundary: **200–400 ms → ~50 ms**
- Inter-sentence gap (segments 2, 3, ...): **80–300 ms → ~10 ms** (connection already warm)

---

## 5. Improvement 2: First-Sentence Fast-Path

### Problem

The TTS buffer cap is 200 chars (`brain.py:176`). For a bot response like:

> "Great, I've found your account. Your current balance is $1,250. Would you like to make a payment?"

The first flush happens after the first sentence only if it ends with `.!?` before reaching 200 chars. Longer first sentences wait longer before the user hears anything.

### Solution: Dedicated First-Sentence Flush

Track whether the first TTS segment has fired yet in `_run_llm_turn`. If not, use a smaller buffer cap for the first flush only:

```python
# brain.py in _run_llm_turn
_first_segment_sent = False
_first_segment_cap = 80  # ~15-20 words — gets audio to user fast

async for chunk in self.llm.stream_completion(...):
    if chunk.content:
        tts_buffer += chunk.content
        flush_threshold = _first_segment_cap if not _first_segment_sent else self._max_tts_buffer_chars
        if self._is_sentence_boundary(tts_buffer, char_cap=flush_threshold):
            await self._emit_tts_audio_stream(tts_buffer)
            _first_segment_sent = True
            tts_buffer = ""
```

Also, use a **two-tier flush mode**: sentence boundaries for the first segment (regardless of char count), char-cap fallback for subsequent ones.

### Expected Gain
- Time to first audio for medium-length responses: reduced by **50–120 ms**
- User perceives bot as faster even when total response length is the same

---

## 6. Improvement 3: Audio Output Normalization (Jitter Elimination)

### Problem

Both TTS providers deliver 4096-byte chunks (`deepgram_tts_provider.py:82`, `elevenlabs_provider.py:111`). At 16 kHz mono linear16:

```
4096 bytes / 2 bytes per sample / 16000 Hz = 128 ms per chunk
```

128 ms chunks arrive with variable network timing, causing the browser's audio context to stutter between chunks.

Gemini and Alexa both normalize to **20 ms frames** (320 bytes at 16 kHz mono) before delivery, matching the browser's `AudioWorklet` processing interval exactly.

### Solution: Frame Normalizer in `on_audio_output`

Add a normalizer in `main.py` and `livekit_agent.py` that buffers incoming TTS chunks and re-emits as 20 ms frames:

```python
class AudioFrameNormalizer:
    """
    Converts variable-size TTS chunks into uniform 20ms PCM frames.
    Eliminates audio playback jitter from uneven chunk delivery.
    """
    FRAME_BYTES = 640   # 20ms × 16000Hz × 2 bytes = 640 bytes

    def __init__(self, on_frame: Callable[[bytes], Awaitable[None]]):
        self._buf = bytearray()
        self._on_frame = on_frame

    async def push(self, chunk: bytes) -> None:
        self._buf.extend(chunk)
        while len(self._buf) >= self.FRAME_BYTES:
            frame = bytes(self._buf[:self.FRAME_BYTES])
            self._buf = self._buf[self.FRAME_BYTES:]
            await self._on_frame(frame)

    async def flush(self) -> None:
        """Pad and flush any remaining audio at turn end."""
        if self._buf:
            # Zero-pad to full frame
            padded = bytes(self._buf) + b'\x00' * (self.FRAME_BYTES - len(self._buf) % self.FRAME_BYTES)
            self._buf = bytearray()
            await self._on_frame(padded)
```

Wrap `on_audio_output` in `main.py`:

```python
normalizer = AudioFrameNormalizer(on_frame=lambda chunk: websocket.send_bytes(chunk))

async def on_audio_output(audio_bytes: bytes):
    if vt.connected:
        await normalizer.push(audio_bytes)
```

At turn end (in `_finalize_turn`), call `normalizer.flush()`.

### Expected Gain
- Playback stutter: **eliminated**
- Audio timeline: smooth 20 ms cadence matching browser AudioWorklet

---

## 7. Improvement 4: LLM Client Warm Pool

### Problem

`groq_provider.py:46` uses lazy initialization — the `AsyncGroq` client is created on **the first `stream_completion` call**. For the greeting turn and any session where the bot has been idle, this adds 500–1000 ms.

### Solution: Eager Client Init + Predictive Prewarm

**Step 1**: Initialize the Groq client eagerly in `AgenticBrain.__init__`:

```python
# brain.py __init__, after setting self.llm
if self.llm and hasattr(self.llm, '_get_client'):
    asyncio.create_task(self.llm._get_client())   # Non-blocking warmup
```

**Step 2**: The existing `_predictive_prewarm` (`brain.py:437`) already pre-warms on keyword detection. Expand trigger keywords:

```python
key_intents = [
    "book", "appointment", "schedule",
    "hello", "hi", "hey",           # Greetings
    "weather", "remind",
    "what", "how", "when", "where", "who",  # Question words
    "can you", "could you", "please",        # Polite requests
]
```

**Step 3**: Keep the Groq connection alive between turns. `AsyncGroq` uses `httpx.AsyncClient` internally. Use `keep_alive=True` (already default in httpx) but also avoid calling `await client.close()` between turns — only close on session end.

### Expected Gain
- First turn after session start: **500–1000 ms → < 50 ms** (client already warm)
- After idle period: **500–1000 ms → < 50 ms** (connection kept alive)

---

## 8. Improvement 5: Deepgram VAD Parameter Tuning

### Problem

Current Deepgram params (`deepgram_provider.py:76–87`):
```
endpointing:        200  ms  ← too aggressive, fires on brief pauses
utterance_end_ms:  1000  ms  ← too slow as fallback
```

At 200 ms, Deepgram fires a `Final` transcript on any natural breath pause, causing the brain to start processing before the user has finished. The user then speaks more → interruption detected → awkward mid-sentence response.

Alexa uses ~400 ms. Gemini uses semantic VAD (language model as VAD).

### Solution: Tuned Parameters + Configurable via Bot Policy

**Recommended production defaults:**

```python
params = {
    "model":              "nova-2",
    "language":           "en-US",
    "encoding":           "linear16",
    "sample_rate":        "16000",
    "channels":           "1",
    "interim_results":    "true",
    "smart_format":       "true",
    "vad_events":         "true",
    "endpointing":        "300",    # 300ms (was 200ms) — fewer false finals
    "utterance_end_ms":   "800",    # 800ms (was 1000ms) — faster definitive end
    "no_delay":           "true",   # Reduce Deepgram internal buffering
    "punctuate":          "true",   # Better sentence boundary detection
    "filler_words":       "false",  # Strip "uh", "um" — cleaner transcript
}
```

**Expose via `conversation_policy` in bot config:**

```json
{
  "stt_endpointing_ms": 300,
  "stt_utterance_end_ms": 800
}
```

And read in `DeepgramStreamingProvider.__init__`:

```python
self.endpointing_ms = str(kwargs.get('endpointing_ms', 300))
self.utterance_end_ms = str(kwargs.get('utterance_end_ms', 800))
```

### Expected Gain
- False-positive turn-fires: reduced ~40%
- User utterance completion accuracy: improved for natural speakers
- No increase in turn-around latency (silence timer still at 150 ms after final)

---

## 9. Improvement 6: TTS Buffer Size Reduction

### Problem

`max_tts_buffer_chars = 200` (`brain.py:176`) means the brain accumulates up to 200 characters before flushing to TTS. At an average of 5 chars/word, that's ~40 words — roughly 2 full sentences for a voice bot.

This means the user waits for 2 sentences worth of LLM generation before hearing the first word.

### Solution: Reduce to 100 chars default, tune per bot

In `_apply_conversation_policy_derived` (`brain.py:166`):

```python
# Change default from 200 to 100
self._max_tts_buffer_chars = int(pol.get("max_tts_buffer_chars", 100))
self._max_tts_buffer_chars = max(30, min(self._max_tts_buffer_chars, 500))
```

Also reduce the `balanced` mode comma threshold accordingly:
```python
comma_at = max(25, cap // 2)   # was max(40, cap // 2)
```

For a 3-sentence response:
- **Before (200 chars)**: First audio after ~40 words generated
- **After (100 chars)**: First audio after ~20 words generated → **~150 ms faster** at Groq's ~7 tokens/sec

### Expected Gain
- Time to first audio (chunked mode): **100–200 ms faster**
- Tradeoff: More TTS requests per turn (mitigated by Improvement 1 — WS TTS)

---

## 10. Improvement 7: Echo Gate / STT Muting During Bot Speech

### Problem

When the bot speaks, the user's microphone picks up the bot's audio output (acoustic echo). Deepgram receives this echo and fires `SpeechStarted`, which calls `handle_interruption` → bot stops mid-sentence → user did not actually interrupt.

This is the "self-interruption" bug. It manifests as the bot cutting itself off randomly.

### Solution: STT Audio Gate

**For WebSocket sessions** (client responsibility):

The client should implement `echo cancellation` or at minimum **mute the microphone while bot audio is playing**. The server signals this via state messages:

```json
{"type": "status", "state": "speaking"}   // → client mutes mic
{"type": "status", "state": "listening"}  // → client unmutes mic
```

Add client-side documentation requirement:
> When `state == "speaking"`, do not send audio bytes. When `state == "listening"`, resume sending.

**For server-side mitigation:**

In `process_audio_chunk` (`brain.py:288`), add an audio gate during SPEAKING that still accepts `SpeechStarted` VAD events but with a **50 ms debounce**:

```python
async def process_audio_chunk(self, chunk: bytes) -> None:
    if self.stt:
        await self.stt.send_audio(chunk)
    # Still forward audio to keep STT connection warm,
    # but state check prevents turn-taking during bot speech.
```

In `process_stt_partial`, add debounce for `SpeechStarted` during SPEAKING:

```python
if msg_type == "speech_started" and self.state == BotState.SPEAKING:
    # Debounce: only interrupt if speech continues for 100ms
    # (avoids reacting to echo pops)
    await asyncio.sleep(0.08)
    if self.state == BotState.SPEAKING:  # Still speaking after 80ms?
        await self.handle_interruption()
    return
```

**For LiveKit**: LiveKit's WebRTC stack provides hardware AEC (Acoustic Echo Cancellation) on the client side — no server changes needed if the browser's WebRTC stack is configured with AEC enabled (it is by default).

### Expected Gain
- False interruptions: **eliminated for LiveKit**, **reduced ~70% for WebSocket**
- Conversational quality: much smoother, bot completes sentences

---

## 11. Improvement 8: Sentence Boundary Enhancement

### Problem

`_is_sentence_boundary` (`brain.py:1166`) only checks the **last character** of the buffer for punctuation. This misses cases like:

- `"Hello! How can I help you today?"` — flushes at `!`, leaving `" How can I help..."` as a second segment
- Very short sentences like `"Yes."` or `"Sure!"` flush immediately (correct)
- Long sentences without punctuation in Groq output → wait for 200-char cap

### Solution: Smarter Boundary Detection

```python
def _is_sentence_boundary(self, text: str, char_cap: Optional[int] = None) -> bool:
    """
    Enhanced flush detection:
    1. Hard sentence end (.!?) at any position triggers flush
    2. Clause break (,;:) past mid-point
    3. Character cap fallback
    4. Never flush mid-word (avoid cutting tokens)
    """
    text = text.rstrip()
    if not text:
        return False

    cap = char_cap or getattr(self, "_max_tts_buffer_chars", 100)
    mode = getattr(self, "_tts_flush_mode", "balanced")

    # Never flush if text ends mid-word (no trailing space or punctuation)
    # This prevents "Hel" being flushed when LLM streams "Hello"
    last_char = text[-1]
    if last_char.isalpha() or last_char.isdigit():
        if len(text) < cap:
            return False  # Wait for word completion

    if mode == "sentence_only":
        return last_char in ".!?" or len(text) >= cap

    # Balanced: also flush on clause boundaries
    if last_char in ".!?":
        return True
    if last_char in ";:":
        return len(text) > cap // 3   # Only flush mid-sentence pause if enough content
    if last_char == "," and len(text) > cap // 2:
        return True
    return len(text) >= cap
```

### Expected Gain
- Fewer mid-word audio cuts: **eliminated**
- Better prosody alignment (audio segments match natural speech units)

---

## 12. Improvement 9: Reduce LiveKit Track Settle Time

### Problem

`livekit_agent.py:188`:
```python
await asyncio.sleep(1.0)  # Settle time
```

This hard 1-second sleep before trying to open the audio stream means the first second of every user's speech is lost.

### Solution: Exponential backoff with quick initial retry

```python
async def _handle_remote_audio(self, track: rtc.RemoteAudioTrack):
    audio_stream = None
    for attempt, wait in enumerate([0.1, 0.2, 0.4, 0.8, 1.6]):
        try:
            audio_stream = rtc.AudioStream(track)
            logger.info("✅ Audio stream LIVE (attempt %d) for %s", attempt + 1, track.sid)
            break
        except Exception:
            await asyncio.sleep(wait)
    ...
```

First attempt at **100 ms** instead of 1000 ms. If it fails, backs off gradually.

### Expected Gain
- LiveKit session start: user's first **900 ms** of speech no longer dropped
- Common case (track ready immediately): **1000 ms → 100 ms** settle time

---

## 13. Improvement 10: Streaming TTS with LLM Pipeline Mode

### Problem

The existing pipeline mode (`tts_pipeline_llm=True` in policy) already queues TTS segments while the previous plays. However, the queue consumer (`brain.py:552`) still calls `_emit_tts_audio_stream` which makes a new HTTP connection per segment.

With the WebSocket TTS provider (Improvement 1), pipelining becomes truly parallel:
- Segment 1 → WS send → audio arrives ~50 ms → playing
- While playing: Segment 2 → WS send → audio arriving
- No gap between segments 1 and 2

### Revised Pipeline Logic

When `use_pipeline=True` and TTS provider is WebSocket-based:

```python
# brain.py _run_llm_turn
if use_pipeline and isinstance(self.tts, DeepgramWSProvider):
    # True streaming: each text segment sent to persistent WS immediately
    # No queue needed — WS provider handles sequencing
    safe_text = self._guard_tts_segment(tts_buffer)
    if safe_text:
        await self.tts.speak(safe_text)   # Non-blocking send
    tts_buffer = ""
```

The TTS WS provider naturally serializes audio output since it's a single WebSocket connection.

### Expected Gain
- Inter-segment gap: **80–300 ms → < 20 ms** (just WS round-trip)
- Overall response delivery: **30–40% faster** perceived

---

## 14. Architecture Comparison: Current vs Target

### Current Architecture (Classic HTTP TTS)

```
                          ┌─────────────────────────────────────┐
User Mic ──► [Deepgram STT WS] ──► Brain ──► [Groq LLM HTTP]   │
                                     │                           │
                              ┌──────┼──────┐                   │
                    sentence1 ▼      │      ▼ sentence2           │
                    [Deepgram TTS   │   [Deepgram TTS            │
                     HTTP POST]     │    HTTP POST]              │
                    200-400ms gap   │   200-400ms gap            │
                              │     │    │                       │
                              ▼     │    ▼                       │
                           [Audio]  │  [Audio]                   │
                              ──────┘──────                      │
                                 GAP ←────── inter-sentence gap  │
                                                                 │
                                                Client           │
└─────────────────────────────────────────────────────────────────┘
```

### Target Architecture (WS TTS + Normalized Frames)

```
                          ┌─────────────────────────────────────┐
User Mic ──► [Deepgram STT WS] ──► Brain ──► [Groq LLM HTTP]   │
                                     │                           │
                              ┌──────┼──────────────────────┐   │
                    tokens    │      │                        │  │
                    stream    ▼      ▼                        │  │
                         [Deepgram TTS WebSocket]             │  │
                         ────────────────────────             │  │
                         Send s1 ──► audio starts ─► 20ms ──►│  │
                         Send s2 ──► audio continues ──────►  │  │
                         (< 20ms gap between s1 and s2)       │  │
                                                              │  │
                         [AudioFrameNormalizer 20ms]          │  │
                              │                               │  │
                              ▼                               │  │
                         Smooth 20ms frames ──────────────────┘  │
                                                                  │
                                                Client            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 15. Bot Config Schema Additions

Add these fields to the `bots` table and bot config JSON to expose the new controls:

```sql
ALTER TABLE bots ADD COLUMN tts_provider TEXT DEFAULT 'deepgram_http';
-- Values: 'deepgram_http' | 'deepgram_ws' | 'elevenlabs'

ALTER TABLE bots ADD COLUMN stt_endpointing_ms INTEGER DEFAULT 300;
ALTER TABLE bots ADD COLUMN stt_utterance_end_ms INTEGER DEFAULT 800;
ALTER TABLE bots ADD COLUMN first_segment_chars INTEGER DEFAULT 80;
-- First-sentence fast path char cap

ALTER TABLE bots ADD COLUMN audio_frame_normalize BOOLEAN DEFAULT true;
-- Enable 20ms frame normalization
```

`conversation_policy` JSON additions:
```json
{
  "silence_threshold_ms": 400,
  "max_tts_buffer_chars": 100,
  "tts_flush_mode": "balanced",
  "tts_streaming_mode": "chunked",
  "tts_pipeline_llm": true,
  "first_segment_chars": 80,
  "audio_frame_normalize": true,
  "stt_endpointing_ms": 300,
  "stt_utterance_end_ms": 800
}
```

---

## 16. Session-Level Telemetry Additions

Add real-time tracking for the new metrics to `SessionState`:

```python
# shared/models/session.py additions
first_audio_latency_ms: float = 0.0    # Time from turn end to first audio byte
inter_segment_gap_ms: float = 0.0      # Average gap between TTS segments
tts_provider_used: str = ""            # Which TTS was used this session
false_interruption_count: int = 0      # How many echo-triggered interrupts
```

Emit via `on_metrics` callback after each turn:
```json
{
  "type": "metrics",
  "stt": 180,
  "llm": 210,
  "tts_ttfs": 52,
  "first_audio": 390,
  "inter_segment_gap": 18,
  "total": 440
}
```

---

## 17. Gemini Live / OpenAI Realtime as Full S2S Option

For the smoothest possible experience — matching Gemini Live exactly — the `speech_speech` pipeline mode (already implemented in `voicebot/services/voice/openai_realtime.py`) is the answer.

It eliminates all STT→LLM→TTS gaps because there is only **one** pipeline stage. The tradeoff:

| | Classic (STT+LLM+TTS) | Speech-Speech (OpenAI Realtime) |
|---|---|---|
| TTFS (first audio) | 400–800 ms | 200–400 ms |
| Interruption handling | Manual event | Native (model handles it) |
| Custom system prompt | Full control | Full control |
| Tool calls | Yes (custom) | Yes (OpenAI function calling) |
| Cost per minute | ~$0.008 | ~$0.06 (6–8x) |
| Voice customization | Any (Deepgram/EL) | 8 OpenAI voices only |
| Latency consistency | Variable | More consistent |

**Recommendation**: Use `speech_speech` for consumer-facing premium tiers; classic pipeline for high-volume / cost-sensitive deployments with Improvements 1–10 applied.

---

## 18. Implementation Roadmap

### Phase 1 — Quick Wins (1–2 days each, no new services)

| # | Change | File | Expected Gain |
|---|---|---|---|
| P1.1 | Reduce LiveKit settle time (backoff) | `livekit_agent.py:188` | −900 ms first-frame loss |
| P1.2 | Reduce `max_tts_buffer_chars` to 100 | `brain.py:176` | −100–200 ms first audio |
| P1.3 | Expand predictive prewarm keywords | `brain.py:443` | −300–600 ms cold start |
| P1.4 | Eager Groq client init | `brain.py:__init__` | −500–1000 ms first turn |
| P1.5 | Tune Deepgram VAD params (300/800) | `deepgram_provider.py:76` | −40% false positives |
| P1.6 | SpeechStarted debounce 80 ms | `brain.py:321` | Eliminate false interrupts |
| P1.7 | First-sentence fast-path (80 chars) | `brain.py:_run_llm_turn` | −100–200 ms first audio |

### Phase 2 — Audio Quality (2–3 days each)

| # | Change | File | Expected Gain |
|---|---|---|---|
| P2.1 | `AudioFrameNormalizer` (20 ms frames) | new + `main.py` | Eliminate jitter |
| P2.2 | Enhanced `_is_sentence_boundary` | `brain.py:1166` | No mid-word cuts |
| P2.3 | STT echo gate with client docs | `main.py`, client docs | Eliminate self-interrupts |

### Phase 3 — Persistent TTS WebSocket (3–5 days)

| # | Change | File | Expected Gain |
|---|---|---|---|
| P3.1 | `DeepgramWSProvider` class | new `deepgram_ws_tts_provider.py` | −200–400 ms per segment |
| P3.2 | Wire into `brain._emit_tts_audio_stream` | `brain.py:789` | Near-zero inter-segment gap |
| P3.3 | `handle_interruption` WS reset | `brain.py:888` | Clean interrupt cuts |
| P3.4 | Pipeline mode optimization for WS TTS | `brain.py:_run_llm_turn` | True parallel LLM+TTS |

### Phase 4 — Metrics & Tuning (1–2 days)

| # | Change | File | Expected Gain |
|---|---|---|---|
| P4.1 | New session telemetry fields | `models/session.py` | Observability |
| P4.2 | Bot config schema additions | `sqlite_provider.py` | Per-bot tuning |
| P4.3 | Obsidian UI for new fields | `obsidian-command/` | Operator control |

---

## 19. Expected Results After All Phases

| Metric | Before | After Phase 1 | After Phase 3 |
|---|---|---|---|
| First audio latency (avg) | 800 ms | 450 ms | **280 ms** |
| First audio latency (worst) | 2400 ms | 1200 ms | **600 ms** |
| Inter-sentence gap | 80–300 ms | 60–200 ms | **< 20 ms** |
| Playback jitter | Medium | Low | **None** |
| False self-interruption rate | Medium | Low | **Near zero** |
| Echo / self-interruption | High | Low | **Eliminated** |
| Cold-start latency | 500–1000 ms | **< 50 ms** | < 50 ms |

This brings the classic pipeline to within 100–150 ms of OpenAI Realtime (`speech_speech` mode) at a fraction of the cost per minute.

---

## 20. Quick Reference: Key Files and Lines

| Concern | File | Lines |
|---|---|---|
| TTS buffer size | `brain.py` | 176–178 |
| Sentence boundary detection | `brain.py` | 1166–1191 |
| First TTS flush timing | `brain.py` | 570–599 |
| LLM stream loop | `brain.py` | 518–664 |
| Interruption handling | `brain.py` | 888–918 |
| Silence timer | `brain.py` | 388–428 |
| Deepgram VAD params | `deepgram_provider.py` | 76–87 |
| TTS HTTP chunk size | `deepgram_tts_provider.py` | 82 |
| LiveKit settle time | `livekit_agent.py` | 188 |
| Predictive prewarm | `brain.py` | 437–463 |
| TTS pipeline mode | `policy.py` | 83–88 |
| Audio output callback | `main.py` | 218–219 |
| S2S bridge | `services/voice/openai_realtime.py` | full |

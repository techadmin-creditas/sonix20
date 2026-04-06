# Orchestrator & STT System — Complete Reference

> Auto-generated reference. Read this instead of the source files.
> Files covered: `voicebot/core/orchestrator/` (brain, turn_detector, workflow_engine, task_manager) · `voicebot/services/stt/` (deepgram_provider, whisper_provider) · `voicebot/services/tts/` (elevenlabs_provider, deepgram_tts_provider, deepgram_ws_tts_provider, fallback_provider)

---

## Architecture Overview

```
STT Partial/Final
      ↓
TurnDetector (is_turn_complete?)
      ↓
AgenticBrain._process_user_turn()
   ├── RuleEngine (input guardrails)
   ├── InjectionDetector
   ├── TopicRelevanceCheck
   ├── WorkflowEngine.evaluate()   ← if yield_to_llm → continue
   ├── RAG + SemanticCache (parallel)
   └── _run_llm_turn()
         ├── Build system prompt (cached per language)
         ├── LatencyWatchdog (filler if >1.2s to first token)
         ├── LLM stream loop (max 4 iterations)
         │     ├── Token accumulation → TTS buffer → audio
         │     ├── Tool call detection + execution
         │     └── Loop detection / hallucination recovery
         └── _finalize_turn()
```

---

## 1. TurnDetector (`turn_detector.py`)

Semantic VAD — decides when user has finished speaking using silence + linguistic signals.

### Constructor
```python
TurnDetector(
    min_silence_ms: float = 300,
    max_silence_ms: float = 800,
    confidence_threshold: float = 0.7,
    extra_backchannels: Optional[list[str]] = None,
)
```

### Public Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `compute_turn_complete_confidence(transcript, silence_duration_ms)` | `float 0–1` | Multi-signal fusion score |
| `is_turn_complete(transcript, silence_duration_ms, **kwargs)` | `bool` | True when threshold exceeded |
| `get_recommended_threshold(transcript, base_max_threshold_ms)` | `float ms` | Dynamic silence threshold |
| `is_sentence_boundary(text, char_cap, mode)` | `bool` | TTS flush point detection |
| `is_backchannel(text)` | `bool` | "yeah/okay/mhm" — not a real turn |
| `is_likely_duplicate(text, last_processed_text)` | `bool` | Deepgram artifact filter |
| `is_meaningful_barge_in(barge_in_text, last_processed_text)` | `bool` | Real speech vs noise |

### `compute_turn_complete_confidence` Signal Breakdown

| Signal | Weight | Condition |
|--------|--------|-----------|
| Silence duration | +0.5 | ≥ max_silence_ms |
| Silence duration | +0.3 × ratio | ≥ min_silence_ms |
| Sentence end `.!?` | +0.3 | Punctuation |
| Clause `,;:` | +0.1 | Punctuation |
| Question word/`?` | +0.15 | Starts with who/what/when… |
| Numeric OTP/PIN | +0.2 | "1 1 2 2" pattern |
| Trailing conjunction | -0.25 | Ends with "and/but/ki/par/aur" |

### `get_recommended_threshold` Thresholds

| Condition | Threshold |
|-----------|-----------|
| ≤2 words (short definitive) | 300ms |
| Confidence >0.8 | 400ms |
| Confidence >0.5 | 600ms |
| Low confidence | 900ms |
| Trailing conjunction | 2.0× |
| Flat prosody signal | 1.5× |

### `is_sentence_boundary` (TTS flush logic)

- Hard end `.!?` or Hindi `।` → flush immediately
- Clause `;:` → flush if buffer > 1/3 of char_cap
- Comma → flush if buffer > 1/2 of char_cap
- Fallback → flush if ≥ char_cap

---

## 2. TaskCancellationManager (`task_manager.py`)

Manages speculative (pre-warmed) async tasks to reduce tool latency.

### Constructor
```python
TaskCancellationManager():
    _active_tasks: Dict[str, asyncio.Task]
    _completed_results: Dict[str, Any]
    _lock: asyncio.Lock
```

### Public Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `spawn_speculative(task_id, coro_factory, confidence=1.0)` | `Optional[Task]` | Launch task gated by confidence |
| `get_speculative_result(task_id)` | `Optional[Any]` | Retrieve + pop completed result |
| `cancel_all()` | `None` | Emergency cleanup (session end) |

### Confidence Gating
- `< 0.50` → ignored (not spawned)
- `0.50–0.85` → pre-warm only
- `≥ 0.85` → full execution

---

## 3. WorkflowEngine (`workflow_engine.py`)

Declarative node-graph conversation flow. Fallback to main LLM when no node matches.

### Constructor
```python
WorkflowEngine(brain, workflow_data: dict):
    nodes: Dict[str, dict]       # node_id → node
    edges: List[dict]
    adjacency: Dict[str, List[dict]]  # node_id → [edges]
    current_node_id: Optional[str]
    history: List[str]           # visited node IDs (backtrack stack)
    session_data: Dict[str, Any] # extracted entities
    last_user_text: str
    _classifier_llm              # cached cheap classifier instance
```

### Node Types

| Type | Behavior |
|------|----------|
| `speech` | Speak text or LLM-generate via `_generate_dynamic_speech()` |
| `userInput` | Pause — wait for next `evaluate()` call |
| `logic` | Intent classification via cheap LLM → pick edge |
| `sentiment` | Route: positive / neutral / negative |
| `language` | Detect language → ISO 639-1 code |
| `knowledge` | RAG search → speak answer |
| `action` | Webhook / SMS / Email via httpx |
| `backtrack` | Navigate backward in history |
| `llm_fallback` | Return `yield_to_llm = True` to Brain |

### Key Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `evaluate(user_text)` | `bool` | `False` = workflow handled; `True` = yield to LLM |
| `_execute_node_chain(user_text)` | `bool` | Walk graph until blocking point (max 20 hops) |
| `_check_global_interceptor(text)` | `str` | `"DISCONNECT"` / `"ESCALATE"` / `"CONTINUE"` |
| `_classify_intent(text, options)` | `str` | Stage 1: substring; Stage 2: cheap LLM |
| `_classify_sentiment(text)` | `str` | `"positive"` / `"neutral"` / `"negative"` |
| `_detect_language(text)` | `str` | ISO 639-1 code |
| `_detect_navigational_intent(text)` | `Optional[dict]` | BACKTRACK / SKIP / RESTART |
| `_handle_backtrack(target_label)` | `bool` | Navigate to prior history node |
| `_handle_escalation()` | `None` | Webhook + farewell + session end |
| `_get_classifier_llm()` | `LLM instance` | Cached cheap LLM (Groq → OpenRouter → main) |

### Global Interceptor (2-stage, runs every turn)

**Stage 1 — Regex (0ms)**:
- `_DISCONNECT_RE`: bye, goodbye, hang up, bandh, alvida, …
- `_ESCALATE_RE`: human, agent, manager, insaan se baat, …

**Stage 2 — Cheap LLM** (only >4 words, no Stage 1 match)

### Classifier LLM Resolution Order
1. `bot_config["classifier_llm_provider"]` + `["classifier_llm_model"]`
2. Env: `CLASSIFIER_LLM_PROVIDER` / `CLASSIFIER_LLM_MODEL`
3. Auto: Groq (if `GROQ_API_KEY`)
4. Auto: OpenRouter (if `OPENROUTER_API_KEY`)
5. Fallback: Bot's main LLM (not cached)

### Farewell Messages (by language)
```python
"en": ("I understand. Hanging up now. Goodbye!", "Please wait while I connect you...")
"hi": ("समझ गया। अभी कॉल समाप्त कर रहा हूँ। अलविदा!", "कृपया प्रतीक्षा करें...")
```

---

## 4. AgenticBrain (`brain.py`)

Core state machine: STT → reasoning → TTS pipeline.

### State Machine

```
IDLE
 ↓ start_conversation()
LISTENING
 ↓ is_turn_complete()
PROCESSING
 ↓ _run_llm_turn()
SPEAKING
 ↓ TTS complete  ←── handle_interruption() → INTERRUPTED → PROCESSING
LISTENING
```

```python
class BotState(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"
```

### Constructor Parameters
```python
AgenticBrain(
    session: SessionState,
    stt_handler, llm_handler, tts_handler,
    guardrail_handler, memory_handler, db_handler,
    bot_config: Optional[dict],
    on_state_change, on_audio_output, on_transcript,
    on_bot_transcript, on_tool_call, on_tool_result,
    on_log, on_metrics, output_guard_handler,
    on_voice_session_end: Callable[[str], Awaitable[None]],
    on_audio_interrupt, on_audio_resume,
)
```

### Critical Internal State

```python
# State
state: BotState
_interrupt_event: asyncio.Event          # barge-in signal
_current_task: Optional[asyncio.Task]    # cancellable turn task

# Transcript buffers
_partial_buffer: str                     # Deepgram interim
_utterance_buffer: str                   # finalized STT
_barge_in_buffer: str                    # text during bot speaking

# Turn tracking
_turn_count: int
_completed_user_turns: int
_last_processed_text: str                # deduplication

# Sentiment
_sentiment_history: list[str]            # last 10 turns

# TTS control
_max_tts_buffer_chars: int              # flush threshold (100)
_tts_streaming_mode: str                # "chunked" | "whole_turn"
_tts_pipeline_llm: bool

# Timing
_silence_threshold_ms: float            # 500ms
_max_silence_threshold_ms: float        # 1200ms
_llm_latency_watchdog_sec: float        # 1.2s

# Timers
_silence_timer: Optional[asyncio.Task]
_proactive_timer: Optional[asyncio.Task]
_inactivity_timer: Optional[asyncio.Task]

# Guards
rule_engine: RuleEngine
turn_detector: TurnDetector
task_manager: TaskCancellationManager
workflow_engine: Optional[WorkflowEngine]

# Tool execution
_tools: List[ToolDefinition]
_tool_instances: Dict[str, Any]
_last_call_sig: Optional[str]           # loop detection

# LLM caching
_llm_static_prompt_cache: Dict[str, str]  # keyed by language
```

### Primary Entry Points

#### `start_conversation()` → `None`
- Load bot config (policies, tools, workflow)
- Emit greeting from `bot_config["greeting"]` or default
- Set state → LISTENING

#### `process_stt_partial(text, is_final, **kwargs)` → `None`
- Accumulate into `_partial_buffer` (interim) or `_utterance_buffer` (final)
- Deduplicate via `turn_detector.is_likely_duplicate()`
- On turn complete → cancel silence timer → `_process_user_turn()`

#### `_process_user_turn(user_text)` → `None`

Step-by-step:
1. STT confidence gate → ask for repeat if < threshold on short utterance
2. Rule Engine input guardrails → ALLOW / MASK / BLOCK
3. Injection detector (if `injection_enabled`)
4. Topic relevance check (if `topic_restriction`)
5. Add to session history + call DB/memory
6. `WorkflowEngine.evaluate()` → if `yield_to_llm=False`, return
7. Parallel: RAG lookup + Semantic cache lookup
8. `_run_llm_turn()`
9. Background (fire-and-forget): `_analyze_and_emit_sentiment()`, `_extract_and_store_entities()`

#### `_run_llm_turn(cache_key, _qa_question, _system_prompt_override)` → `None`

- **Max iterations**: 4 (tool chain: call → result → recovery → response)
- **Per iteration**:
  1. Build context (last 10 turns, JSON)
  2. Iteration 1 only: Start latency watchdog (filler at 1.2s)
  3. `llm.stream_completion(system_prompt, context, tools, ...)` with 30s timeout
  4. Token-by-token:
     - Accumulate to `full_response` + `tts_buffer`
     - Strip technical artifacts
     - Detect tool calls
     - On sentence boundary: flush TTS (first segment cap=15 chars, rest=100)
     - Apply output guardrails per segment
  5. If tool calls: check loop → execute → add results → next iteration
  6. If `<function>` tags in response: hallucination recovery → extract + execute
  7. Check `_interrupt_event` on every chunk

#### `handle_interruption()` → `None`
1. Merge `_barge_in_buffer` → `_utterance_buffer`
2. Clear `_partial_buffer`
3. Set `_interrupt_event` (cancels LLM/TTS loops)
4. Call `_on_audio_interrupt()`
5. `session.mark_interrupted()`
6. Re-enter `_process_user_turn()` with merged text

### TTS Streaming Modes

| Mode | Behavior | Use case |
|------|----------|----------|
| `"chunked"` (default) | Flush at sentence boundaries | Minimum latency |
| `"whole_turn"` | Buffer all tokens, one TTS call | Simplicity |
| Pipeline mode | LLM→queue→concurrent TTS consumer | Maximum throughput |

**First segment cap = 15 chars** → `<300ms` time-to-first-speech

### Tool Execution

**`_execute_tools(calls)`**:
- Sequential or parallel (configurable)
- Loop detection: hash of `(tool_name, args)` vs `_last_call_sig`
- On loop: set `_force_no_tools_this_turn=True` + add system hint to context

**Tool registration** (`_register_tools()`):
- Reads `bot_config["tools"]` (list of names)
- Resolves via `ToolRegistry`

### Background Tasks

| Task | Trigger | Purpose |
|------|---------|---------|
| `_analyze_and_emit_sentiment()` | Every user turn | Stage 1 regex → Stage 2 Groq; auto-escalate on 3× negative |
| `_extract_and_store_entities()` | Every user turn | Regex: names, amounts, accounts, dates, phones |
| `_proactive_silence_check()` | After `proactive_silence_sec` idle | "Still there?" prompt |
| `_inactivity_timeout_task()` | After `inactivity_timeout_secs` idle | End session |
| Latency watchdog | Inline in `_run_llm_turn` iter 1 | Inject filler if LLM slow |

### Latency Watchdog Fillers (language + sentiment aware)

| Lang | Filler |
|------|--------|
| EN | "One moment please." / "Just a second." / "Let me check that..." |
| HI | "Ek second, main check karta hoon." / "Thoda wait kijiye." |

On filler: fires `_on_metrics({"type": "audio_handoff"})` for frontend crossfade.

### Conversation Policies (`bot_config["conversation_policy"]`)

| Key | Default | Effect |
|-----|---------|--------|
| `silence_threshold_ms` | 500 | Min silence before turn complete |
| `max_silence_threshold_ms` | 1200 | Force turn end |
| `max_tts_buffer_chars` | 100 | TTS flush threshold |
| `tts_streaming_mode` | "chunked" | TTS mode |
| `first_segment_chars` | 15 | First TTS segment cap |
| `llm_latency_watchdog_sec` | 1.2 | Filler injection threshold |
| `proactive_silence_sec` | 30 | "Still there?" timeout |
| `proactive_grace_after_bot_sec` | 5 | No interrupt within N sec of bot |
| `proactive_after_user_turns` | 0 | Only after N completed turns |
| `extra_backchannels` | [] | Custom verbal nods |
| `min_stt_confidence` | 0.5 | Ask repeat below threshold |

### System Prompt Caching

- `_llm_static_prompt_cache: Dict[str, str]` keyed by language
- Lazy computation on first use per language
- Avoids re-serializing tools/persona/policies each turn

---

## Cross-Component Interactions

```
Brain ↔ TurnDetector
  brain.process_stt_partial() calls turn_detector.is_turn_complete()
  brain calls get_recommended_threshold() for dynamic silence adjustment

Brain ↔ TaskCancellationManager
  brain.spawn_speculative() for pre-warmed tool calls
  brain.get_speculative_result() to retrieve if completed

Brain ↔ WorkflowEngine
  brain._process_user_turn() calls workflow_engine.evaluate()
  workflow calls back brain._generate_and_speak() for speech nodes
  workflow calls brain.request_voice_session_end() on disconnect/escalate

Brain ↔ RuleEngine
  INPUT: rule_engine.apply_policies(text, RuleScope.INPUT) before LLM
  OUTPUT: rule_engine.apply_policies(text, RuleScope.OUTPUT) per TTS segment

WorkflowEngine ↔ Classifier LLM
  Cached instance, separate from main voice LLM
  Used for: intent, sentiment, language, global interceptor
```

---

## LLM Turn Flows

### Normal (no tools)
```
Iteration 1 → stream tokens → flush TTS at boundaries → finalize
```

### Tool use
```
Iteration 1 → tool calls detected → _execute_tools()
Iteration 2 → process results → stream response → finalize
```

### Loop recovery
```
Iteration 1 → tool call X
Iteration 2 → same tool call X (hash match) → _force_no_tools_this_turn=True + hint
Iteration 3 (tools disabled) → direct response → finalize
```

### Hallucination recovery
```
Iteration N → LLM outputs <function> tags instead of native tool calls
  → _extract_hallucinated_tool_calls() → execute → add results
Iteration N+1 → process results → finalize
```

### Timeout
```
LLM > 30s → asyncio.TimeoutError → log error → friendly error → LISTENING
TTFT > 1.5s → trigger fallback provider (Groq)
```

---

## Key Design Patterns

1. **Event-driven interruption**: `_interrupt_event.set()` cancels all async loops instantly
2. **Streaming pipeline**: LLM tokens → sentence boundary → TTS chunk → audio (minimal latency)
3. **Lazy caching**: System prompts cached per language, recomputed only on language change
4. **Semantic deduplication**: `_last_processed_text` prevents processing same transcript twice
5. **Confidence-gated speculation**: Speculative tasks respect 50/85% thresholds
6. **Graceful degradation**: workflow fail → LLM; LLM slow → filler; TTFT slow → provider fallback
7. **Multi-language**: Language-aware prompts, fillers, farewell messages (EN + HI + Hinglish)
8. **Parallel pre-processing**: RAG + cache run concurrently before LLM call

---

## STT Providers (`voicebot/services/stt/`)

Two providers available. Brain calls them via the same callback interface.

### Callback Signature (both providers)
```python
on_transcript(
    text: str,
    is_final: bool,
    language: str,
    confidence: float,
    **kwargs  # msg_type, error (Deepgram only)
) -> Awaitable[None]
```
`msg_type` values: `"speech_started"` | `"utterance_end"` | `"terminal_error"`

---

### DeepgramStreamingProvider (`deepgram_provider.py`)

Real-time WebSocket streaming with client-side VAD gating.

#### Constructor
```python
DeepgramStreamingProvider(
    api_key: Optional[str],           # fallback: settings.deepgram_api_key
    language: str = "en",
    model: str = "nova-2",
    sample_rate: int = 16000,
    channels: int = 1,
    encoding: str = "linear16",
    endpointing_ms: Optional[int],    # clamped 100–500ms, default 150
    vad_rms_threshold: Optional[float],  # clamped 120–2000, default 280
    forward_all_pcm: bool = False,    # bypass VAD (test mode)
)
```

#### Internal State
```python
_websocket                           # aiohttp/websockets WS connection
_connected: bool
_receive_task: asyncio.Task          # _receive_loop() background task
_on_transcript: Optional[Callable]

# VAD gate
_lookback_buffer: deque              # 30 frames = 300ms ring buffer
_is_streaming: bool                  # gate open/closed
_last_speech_time: float
_gate_open_time: float

# Timing
_bot_stop_time: float                # last bot audio end (anti-echo gate)
_bot_cooldown: float = 0.2s
_min_open_duration: float = 0.5s
_padding_duration: float = 0.5s

# Dedup & keepalive
_last_final_transcript: str
_last_keepalive: float
```

#### Public Methods

| Method | Description |
|--------|-------------|
| `streaming_listen_query_params() -> dict` | Build Deepgram WS query string (model, encoding, language, vad_events, endpointing…) |
| `async connect(on_transcript)` | Open WS to `wss://api.deepgram.com/v1/listen`, spawn `_receive_loop` |
| `async send_audio(audio_bytes)` | VAD gate → forward or buffer; anti-echo; keepalive every 4s |
| `async flush_endpoint()` | Send 200ms silence to force finalization; set `_bot_stop_time` |
| `reset_vad() / reset_buffer()` | Clear lookback buffer, reset gate + timers + dedup |
| `async finalize()` | Send `{"type": "Finalize"}` JSON to close utterance window |
| `async disconnect()` | Send `CloseStream`, cancel receive task, close WS |

#### VAD Gate Logic (`send_audio`)

```
Each 10ms audio frame (320 bytes):
  1. Anti-echo: if now < _bot_stop_time + 200ms → discard
  2. RMS = audioop.rms(audio_bytes, 2)
  3. if rms > threshold AND gate closed:
       flush 300ms lookback buffer → WS
       set _is_streaming=True, _gate_open_time=now
       send current frame
  4. elif rms ≤ threshold AND gate open:
       if silence > 500ms AND gate was open > 500ms:
         set _is_streaming=False  (close gate)
       else:
         send frame (padding window)
  5. elif gate closed:
       append to lookback_buffer (ring, max 30 frames)
       send keepalive JSON every 4.0s
```

#### Response Processing (`_process_response`)

| `type` field | Action |
|---|---|
| `"Results"` | Extract `channel.alternatives[0]`: text, is_final, confidence, detected_language → deduplicate finals → call `_on_transcript` |
| `"SpeechStarted"` | Call `_on_transcript(msg_type="speech_started")` |
| `"UtteranceEnd"` | Call `_on_transcript(is_final=True, msg_type="utterance_end")` |
| `"Error"` | Log + call `_on_transcript(msg_type="terminal_error", error=...)` + set `_connected=False` |

#### Audio Format Constants
| Constant | Value |
|----------|-------|
| Frame size | 320 bytes (10ms @ 16kHz 16-bit mono) |
| Lookback buffer | 30 frames = 300ms |
| Anti-echo cooldown | 200ms |
| Gate min-open | 500ms |
| Post-speech padding | 500ms |
| Keepalive interval | 4.0s (wall), 4.5s threshold |
| VAD RMS range | 120–2000 (default 280) |
| Endpointing range | 100–500ms (default 150ms) |

#### Utility Functions

**`resolve_stt_language_for_session(session_language, conversation_policy) -> str`**
- Policy `"multilingual"/"detect"/"auto"/"hinglish"` → `"multilingual"`
- Otherwise → lowercased session_language or `"hi"` default

**`deepgram_listen_language_params(listen_language) -> dict`**
- `"auto"/"detect"/"multilingual"` → `{"language": "multi"}`
- `"en"` → `{"language": "hi"}` (bot-specific override)
- `"hi"/"hindi"/"hi-in"` → `{"language": "hi"}`

**`extract_linear16_pcm_16k_mono(audio, *, raw_pcm) -> bytes`**
- `raw_pcm=True`: validate 16-bit alignment, return as-is
- `raw_pcm=False`: parse WAV header, validate mono/16-bit/16kHz, extract PCM frames

**`transcribe_sandbox_via_streaming_provider(...) -> tuple[str, Optional[float], dict]`**
- Batch testing via streaming (adds 300ms trailing silence, `forward_all_pcm=True`)
- Returns `(transcript, confidence, query_params)`

---

### WhisperProvider (`whisper_provider.py`)

Batch transcription — accumulates audio then transcribes on demand. No streaming.

#### Constructor
```python
WhisperProvider(
    model_size: str = "base",   # fallback: settings.stt.whisper_model_size
    use_api: bool = False,       # True = OpenAI API, False = local model
    api_key: Optional[str],      # required if use_api=True
)
```

#### Internal State
```python
_model: Optional           # loaded whisper model (None if API mode)
_audio_buffer: bytearray   # accumulates all audio chunks
```

#### Public Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `async initialize()` | `None` | Load local model in executor (non-blocking) |
| `async send_audio(audio_bytes)` | `None` | Append to `_audio_buffer` |
| `async transcribe_buffer()` | `Optional[dict]` | Batch transcribe accumulated buffer; clears buffer |
| `async disconnect()` | `None` | Clear buffer, set `_model=None` |

**`transcribe_buffer()` return**:
```python
{"text": str, "language": str, "confidence": float}
# confidence is always 1.0 (Whisper doesn't provide scores)
# language is always "en" in API mode
```

#### Transcription Backends

**Local** (`_transcribe_local`):
- Write buffer to temp `.wav` file
- `model.transcribe(filepath)` in executor
- Returns language from Whisper result

**API** (`_transcribe_api`):
- POST to `https://api.openai.com/v1/audio/transcriptions`
- Model: `whisper-1`, multipart WAV upload
- Returns language hardcoded to `"en"`

---

### Provider Comparison

| Feature | DeepgramStreamingProvider | WhisperProvider |
|---------|--------------------------|-----------------|
| Mode | Real-time WebSocket streaming | Batch (buffer + transcribe) |
| Latency | ~100–300ms (streaming) | 500–1500ms |
| Partial transcripts | Yes (interim results) | No |
| VAD | Client-side RMS gate | None |
| Anti-echo | Yes (200ms cooldown) | No |
| Confidence scores | Real (from Deepgram) | Hardcoded 1.0 |
| Language detection | Per-utterance from Deepgram | Model-level (local) or none (API) |
| Reconnection | `_receive_loop` error handling | N/A |
| Use case | Production voice calls | Offline / testing |

---

### STT → Brain Integration Flow

```
Audio hardware/LiveKit
  ↓ raw PCM (320 bytes/10ms frames)
DeepgramStreamingProvider.send_audio()
  ↓ VAD gate (RMS threshold)
WebSocket → Deepgram cloud
  ↓ JSON results
_receive_loop → _process_response()
  ↓ on_transcript(text, is_final, language, confidence)
AgenticBrain.process_stt_partial()
  ↓ is_final=False → accumulate _partial_buffer
  ↓ is_final=True  → accumulate _utterance_buffer
TurnDetector.is_turn_complete()
  ↓ True
_process_user_turn(user_text)
```

**Key lifecycle calls from Brain to STT**:
- `connect(on_transcript)` — session start
- `send_audio(bytes)` — every audio frame
- `flush_endpoint()` — after bot finishes speaking (anti-echo reset)
- `reset_buffer()` — after turn complete or interrupt
- `finalize()` — explicit utterance close
- `disconnect()` — session end

---

## TTS Providers (`voicebot/services/tts/`)

Four providers. All share the same duck-typed interface: `stream_speech(text, **kwargs) → AsyncIterator[bytes]`, `stop()`, `disconnect()`.

### Provider Comparison

| Feature | ElevenLabsStreaming | DeepgramHTTP | DeepgramWS | FallbackTTS |
|---------|--------------------|--------------|-----------:|-------------|
| Connection | HTTP + opt. WS | HTTP POST (ephemeral) | WS (persistent) | wraps others |
| TTFA | ~200–400ms | ~200–400ms | ~50ms | best of active |
| Redis cache | Yes (per-text MD5) | No | No | delegated |
| Prewarm | Yes | No | No | No |
| Auto-reconnect | No | No | Yes | No |
| Concurrent calls | Allowed | Allowed | Serialized (lock) | delegated |
| Stop semantics | cancel stream | cancel stream | Reset buffer | broadcast |

---

### ElevenLabsStreamingProvider (`elevenlabs_provider.py`)

#### Constructor
```python
ElevenLabsStreamingProvider(
    api_key: Optional[str],                    # fallback: settings
    voice_id: str = "EXAVITQu4vr4xnSDxMaL",
    model_id: str = "eleven_flash_v2_5",
    output_format: str = "pcm_16000",          # PCM 16-bit 16kHz
)
```

#### Internal State
```python
_cache                    # Redis backend (attached via set_cache())
_stopped: bool
_ws_url: str              # WS endpoint URL
_use_ws_primary: bool     # False (disabled — API restrictions)
_ws                       # pre-opened WS connection (prewarm target)
```

#### Public Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `stream_speech(text, stability=0.5, similarity_boost=0.75, style=0.0, **kwargs)` | `AsyncIterator[bytes]` | Yield PCM chunks; Redis cache check first |
| `prewarm()` | `None` | Pre-open WS conn on first LLM token (~200ms saved) |
| `stop()` | `None` | Set `_stopped=True` to interrupt active stream |
| `set_cache(cache)` | `None` | Attach Redis backend |
| `get_voices()` | `List[dict]` | Fetch `{id, name, provider, preview_url, labels}` from API |
| `disconnect()` | `None` | Cleanup resources |

#### Streaming Lifecycle
```
1. Check Redis: key = tts_audio:{voice_id}:{md5(text)}
   → Hit: yield 4096-byte chunks from hex-decoded bytes, return
2. Try WS path (if _use_ws_primary=True)
   → WS init msg: {text, voice_settings: {stability, similarity_boost, style, use_speaker_boost}, xi_api_key}
   → Receive: {audio: base64, isFinal: bool} JSON frames
   → On ConnectionClosed / TimeoutError: fall through to HTTP
3. HTTP POST: https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream
   → httpx persistent client, 30s timeout
   → Yield 4096-byte chunks
4. Write full audio to Redis (hex-encoded, TTL 3600s)
```

#### WS Protocol (if enabled)
- URL: `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=…&output_format=…`
- Audio arrives as base64 in `{audio: "...", isFinal: bool}` JSON
- Currently disabled (`_use_ws_primary=False`) — API rejects stream-input endpoint

---

### DeepgramTTSProvider (`deepgram_tts_provider.py`)

Stateless HTTP provider. New request per `stream_speech` call.

#### Constructor
```python
DeepgramTTSProvider(
    api_key: Optional[str],              # fallback: settings
    model: str = "aura-asteria-en",
    output_format: str = "linear16",
    sample_rate: int = 16000,
)
```

#### Internal State
```python
_url: str = "https://api.deepgram.com/v1/speak"
_stopped: bool
_http_client: Optional[httpx.AsyncClient]  # lazy-initialized, reused (HTTP/2)
```

#### Public Methods

| Method | Description |
|--------|-------------|
| `stream_speech(text, **kwargs)` | POST `{text}` → stream 4096-byte PCM chunks |
| `stop()` | Set `_stopped=True` |
| `disconnect()` | Close persistent HTTP/2 client |

#### HTTP Client
- Lazy-init via `_get_http_client()`, reused across calls (HTTP/2 keepalive)
- Timeouts: connect=5s, read=30s, write=10s, pool=5s
- Headers: `Authorization: Token {api_key}`, `Content-Type: application/json`
- Query params: `model`, `encoding`, `sample_rate`
- Logs chunk count every 5th chunk; returns early on non-200

---

### DeepgramWSTTSProvider (`deepgram_ws_tts_provider.py`)

Persistent WebSocket provider. Lowest latency (~50ms TTFA).

#### Constructor
```python
DeepgramWSTTSProvider(
    api_key: Optional[str],        # fallback: settings
    model: str = "aura-asteria-en",
    sample_rate: int = 16000,
    encoding: str = "linear16",
)
```

#### Internal State
```python
_ws                              # websockets connection (persistent)
_connected: bool
_receive_task: Optional[asyncio.Task]   # background _receive_loop()
_audio_queue: asyncio.Queue[bytes | None]  # chunks from current Speak
_flushed_event: asyncio.Event    # signaled when Flushed control msg received
_speak_lock: asyncio.Lock        # serialize concurrent stream_speech calls
_resetting: bool                 # skip stale chunks during Reset
```

#### Public Methods

| Method | Description |
|--------|-------------|
| `connect()` | Open persistent WS; spawn `_receive_loop`; raises on failure |
| `disconnect()` | Set `_connected=False`; cancel task; close WS; put sentinel in queue |
| `stream_speech(text, **kwargs)` | Auto-reconnect → drain stale queue → send Speak+Flush → yield chunks until sentinel |
| `reset()` | Set `_resetting=True`; send Reset msg; put sentinel (use on barge-in) |
| `stop()` | Alias for `reset()` |

#### WebSocket Protocol
```
Client → Server:
  {"type": "Speak", "text": "..."}   # trigger synthesis
  {"type": "Flush"}                   # force emit buffered audio
  {"type": "Reset"}                   # discard synthesis buffer

Server → Client:
  <binary frames>                     # PCM audio chunks (~50ms TTFA)
  {"type": "Flushed"}                 # end of current segment → put sentinel
  {"type": "Metadata"}                # informational
  {"type": "Warning"/"Error"}         # logged
```

#### `_receive_loop` (background task)
- Runs indefinitely on connected WS
- Binary frame → `_audio_queue.put(chunk)`
- `Flushed` → `_audio_queue.put(None)` + `_flushed_event.set()`
- Exception / disconnect → `_connected=False` + put sentinel

#### `stream_speech` Flow
```
1. If not connected: await connect()
2. Acquire _speak_lock
3. Drain stale chunks from _audio_queue
4. Send {"type": "Speak", "text": text}
5. Send {"type": "Flush"}
6. async for chunk in _audio_queue (timeout 10s per chunk):
     if chunk is None: break  (sentinel = end of segment)
     if _resetting: skip
     yield chunk
```

---

### FallbackTTSProvider (`fallback_provider.py`)

Wraps multiple providers with automatic failover.

#### Constructor
```python
FallbackTTSProvider(
    providers: List[Any],     # ordered list of provider instances (None filtered out)
    on_log_fn=None,           # async fn(source, message, css_class)
)
```

#### Internal State
```python
_current_index: int    # tracks active provider index
_stopped: bool
```

#### Public Methods

| Method | Description |
|--------|-------------|
| `stream_speech(text, **kwargs)` | Try each provider from `_current_index`; advance on failure |
| `stop()` | Broadcast `stop()` to all providers |
| `reset()` | Broadcast `reset()` to all (falls back to `stop()` if no `reset`) |
| `disconnect()` | Broadcast `disconnect()` to all |
| `model` (property) | Returns `model` or `voice_id` of current active provider |

#### Failover Logic
```
For each provider starting at _current_index:
  try:
    yield chunks from provider.stream_speech(text)
    if chunk_count > 0:
      update _current_index → return (success)
    else:
      log warning → on_log_fn → try next
  except Exception as e:
    if terminal error (quota/credit/balance/429/401/unauthorized):
      raise AuthError or ServiceExhaustedError immediately
    else:
      log error → on_log_fn → try next
If all fail: log critical, return (silent failure)
```

**Terminal error keywords**: `"quota"`, `"exhausted"`, `"credit"`, `"balance"`, `"429"`, `"401"`, `"unauthorized"`

---

### TTS → Brain Integration Flow

```
AgenticBrain._run_llm_turn()
  ↓ LLM token stream → tts_buffer
  ↓ sentence boundary detected (TurnDetector.is_sentence_boundary())
  ↓ _guard_tts_segment() → output guardrails

provider.prewarm()          ← called on first LLM token (ElevenLabs only)

provider.stream_speech(segment_text)
  ↓ AsyncIterator[bytes]
_emit_tts_audio_stream():
  ↓ for chunk in stream:
      if _interrupt_event.is_set(): break
      on_audio_output(chunk)  → LiveKit / audio hardware

on user barge-in:
  provider.stop() / provider.reset()
  _interrupt_event.set()

session end:
  provider.disconnect()
```

**Key lifecycle calls from Brain to TTS**:
- `prewarm()` — on first LLM token (ElevenLabs only, saves ~200ms)
- `stream_speech(text)` — per TTS segment (sentence boundary flush)
- `stop()` / `reset()` — on barge-in / interruption
- `disconnect()` — session end
- `set_cache(redis)` — session init (ElevenLabs only)

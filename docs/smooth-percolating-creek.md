# Plan: Ultra-Low Latency Real Human-Like Voicebot

## Context
Current bot has 1.15s barge-in lag, 200–400ms wasted before first audio word, hardcoded grace/debounce in `process_stt_partial`, and a topic-check that blocks the critical path. The Gemini Live model achieves human feel via: instant server-side interruption, parallel LLM+TTS streams, and sub-100ms first audio.

This plan closes those gaps on our STT→LLM→TTS stack without any hardcoded/mock data.

## Root Cause Diagnosis

| Problem | Root Cause | Target |
|---------|-----------|--------|
| Barge-in lag 1.15s | grace=800ms + debounce=350ms hardcoded at call site | <300ms |
| First audio slow | Waits for `first_segment_chars=15` before TTS, misses word boundaries | <300ms TTFS from LLM TTFT |
| TTS consumer not truly cancellable | Nested closure, no stored task reference | Instant cancel |
| Topic check blocks turn | Full LLM call before main turn starts | Move to background |
| TTFS not measured accurately | Measures queue-enqueue time, not first audio byte | True end-to-end metric |
| Stale TTS audio on interrupt | Deepgram WS queue not drained before Reset | Instant drain |

## What NOT to Change
WorkflowEngine (backtrack/escalate), RuleEngine (input/output guardrails), semantic + QA cache logic (`asyncio.gather` at line 1613), hallucination recovery (4-iteration limit + `_last_call_sig` loop detection), FallbackLLMProvider TTFT timeout, TurnDetector, InjectionDetector. All preserved exactly.

---

## Changes by File

### 1. `voicebot/core/orchestrator/brain.py`

#### A. `__init__` — Add 5 new state variables (after `_pending_latency_watchdogs`)
```python
self._active_tts_consumer_task: Optional[asyncio.Task] = None
self._turn_start_ref: float = 0.0
self._ultra_first_segment_chars: int = 8
self._barge_in_grace_ms: int = 300
self._barge_in_debounce_ms: int = 100
```

#### B. `_apply_conversation_policy_derived` — Read 3 new policy keys
Add after the `_llm_latency_watchdog_sec` block:
```python
# Barge-in timing (all from conversation_policy OR bot_config, clamped)
self._barge_in_grace_ms    = int(pol.get("barge_in_grace_period_ms") or self._bot_config.get("barge_in_grace_period_ms") or 300)
self._barge_in_grace_ms    = max(100, min(2000, self._barge_in_grace_ms))

self._barge_in_debounce_ms = int(pol.get("barge_in_debounce_ms") or self._bot_config.get("barge_in_debounce_ms") or 100)
self._barge_in_debounce_ms = max(50, min(800, self._barge_in_debounce_ms))

self._ultra_first_segment_chars = int(pol.get("ultra_first_segment_chars") or self._bot_config.get("ultra_first_segment_chars") or 8)
self._ultra_first_segment_chars = max(4, min(30, self._ultra_first_segment_chars))
```

#### C. `process_stt_partial` — Replace hardcoded grace/debounce (lines 641–656)
```python
# OLD (2 lines):
_grace_period_ms = int((self._bot_config or {}).get("barge_in_grace_period_ms", 800))
_debounce_ms = int((self._bot_config or {}).get("barge_in_debounce_ms", 350))

# NEW:
_grace_period_ms = self._barge_in_grace_ms
_debounce_ms = self._barge_in_debounce_ms
```
`asyncio.sleep(_debounce_ms / 1000.0)` line unchanged — just uses the new variable.

#### D. `_process_user_turn` — Two changes

**D1**: After `turn_start = time.time()`, add:
```python
self._turn_start_ref = turn_start
```

**D2**: Replace synchronous topic check (lines 1538–1552) with background task:
```python
_topic_check_task: Optional[asyncio.Task] = None
if self._topic_restriction and self._refuse_off_topic:
    if bool(self._conversation_policy.get("topic_check_async", True)):
        _topic_check_task = asyncio.create_task(
            self._background_topic_check(current_text, self._topic_restriction)
        )
    else:
        # Legacy blocking path (opt-in via topic_check_async: false)
        is_on_topic = await self._check_topic_relevance(current_text, self._topic_restriction)
        if not is_on_topic:
            await self._generate_and_speak(f"I am specialized in {self._topic_restriction}. Is there something related I can help with?")
            return
```
In the `finally` block of `_process_user_turn`, cancel the background task:
```python
if _topic_check_task and not _topic_check_task.done():
    _topic_check_task.cancel()
```

#### E. `_run_llm_turn` — Queue architecture + ultra-first-word flush

**E1**: Change `use_pipeline` condition (remove the `_tts_pipeline_llm` flag gate):
```python
# OLD: use_pipeline = bool(getattr(self, "_tts_pipeline_llm", False)) and not whole_turn and bool(self.tts)
# NEW:
use_pipeline = self._tts_streaming_mode == "chunked" and bool(self.tts) and not whole_turn
```

**E2**: Change queue item type from `Optional[str]` to `Optional[tuple[str, bool]]`:
```python
segment_q: asyncio.Queue[Optional[tuple[str, bool]]] = asyncio.Queue(maxsize=3)
```
`maxsize=3` provides back-pressure if TTS is slow — prevents LLM generating unbounded ahead.

**E3**: Store consumer task on `self` so interruptions can cancel it:
```python
consumer_task = asyncio.create_task(self._tts_queue_consumer(segment_q, turn_start))
self._active_tts_consumer_task = consumer_task
```

**E4**: Add ultra-first-word flush stage BEFORE the existing `is_sentence_boundary` check:
```python
# Ultra-flush: fire TTS after first ~2 words (on word boundary), before sentence completes
if not _ultra_flush_done and len(tts_buffer) >= self._ultra_first_segment_chars:
    if tts_buffer[-1] in " .!?,;:":  # word boundary only
        safe_text, block_meta = await self._guard_tts_segment(tts_buffer)
        if not block_meta and safe_text:
            if use_pipeline and segment_q is not None:
                await segment_q.put((safe_text, True))  # is_first=True
            else:
                await self._emit_tts_audio_stream(safe_text)
            tts_buffer = ""
            _ultra_flush_done = True
            _first_segment_done = True
        continue
```

**E5**: All other segment `put` calls use tuple: `await segment_q.put((safe_text, not _first_segment_done))`

**E6**: `finally` block — cancel consumer on interrupt:
```python
if use_pipeline and segment_q is not None and consumer_task is not None:
    await segment_q.put(None)  # sentinel
    if self._interrupt_event.is_set():
        consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    finally:
        if self._active_tts_consumer_task is consumer_task:
            self._active_tts_consumer_task = None
```

#### F. New method: `_tts_queue_consumer` (extracted from nested closure)
Replaces the `_consume_tts_queue` nested closure — makes it cancellable by stored task reference.

```python
async def _tts_queue_consumer(
    self,
    segment_q: asyncio.Queue,
    turn_start: float,
) -> None:
    """Consumes TTS segments concurrently with LLM producer. sentinel=None exits."""
    while True:
        if self._interrupt_event.is_set():
            return
        try:
            item = await asyncio.wait_for(segment_q.get(), timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("TTS consumer: 30s queue timeout")
            return
        if item is None:
            return
        if self._interrupt_event.is_set():
            return
        text_seg, _is_first = item
        await self._emit_tts_audio_stream(text_seg)
```

#### G. New method: `_background_topic_check`
```python
async def _background_topic_check(self, text: str, topic: str) -> None:
    """Off-critical-path topic check. Injects interruption if off-topic while bot is speaking."""
    try:
        is_on_topic = await self._check_topic_relevance(text, topic)
        if not is_on_topic and self.state in (BotState.PROCESSING, BotState.SPEAKING):
            self._interrupt_event.set()
            if self._on_audio_interrupt:
                await self._on_audio_interrupt()
            if self._active_tts_consumer_task and not self._active_tts_consumer_task.done():
                self._active_tts_consumer_task.cancel()
            if self.tts and hasattr(self.tts, "reset"):
                await self.tts.reset()
            await asyncio.sleep(0.05)
            await self._generate_and_speak(
                f"I am specialized in {topic}. Is there something related I can help with?"
            )
    except asyncio.CancelledError:
        pass  # Turn completed before check finished — normal
    except Exception as e:
        logger.debug("Background topic check error (non-critical): %s", e)
```

#### H. `handle_interruption` — Immediate consumer cancellation
Add immediately after `self._interrupt_event.set()`:
```python
# Cancel TTS consumer immediately — don't wait for segment boundary
if self._active_tts_consumer_task and not self._active_tts_consumer_task.done():
    self._active_tts_consumer_task.cancel()
```

#### I. `_emit_tts_audio_stream` — True TTFS measurement
In the `_first_chunk` block, after `self.session.last_tts_latency_ms = ...`:
```python
if self._turn_start_ref > 0:
    true_ttfs = (time.time() - self._turn_start_ref) * 1000
    self.session.first_audio_latency_ms = true_ttfs
    logger.info("TTFS %.0fms | TTS provider %.0fms | LLM TTFT %.0fms",
                true_ttfs, _provider_ttfa, self.session.last_llm_latency_ms)
    if self._on_metrics:
        asyncio.create_task(self._on_metrics({
            "type": "ttfs",
            "ttfs_ms": round(true_ttfs, 0),
            "tts_provider_ms": round(_provider_ttfa, 0),
            "llm_ttft_ms": round(self.session.last_llm_latency_ms, 0),
        }))
```

#### J. `cleanup` — Cancel consumer task
```python
if self._active_tts_consumer_task:
    self._active_tts_consumer_task.cancel()
    self._active_tts_consumer_task = None
```

---

### 2. `voicebot/services/tts/deepgram_ws_tts_provider.py`

#### `reset()` — Synchronous queue drain before sending Reset message
```python
async def reset(self) -> None:
    if not self._connected or not self._ws:
        return
    self._resetting = True
    # Drain queued audio immediately so stream_speech() unblocks without stale chunks
    while not self._audio_queue.empty():
        try:
            self._audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            break
    try:
        await self._ws.send(json.dumps({"type": "Reset"}))
    except Exception as exc:
        logger.warning("WS TTS reset send error: %s", exc)
    await self._audio_queue.put(None)  # sentinel to unblock stream_speech()
```

---

### 3. `voicebot/services/memory/sqlite_provider.py`

#### Schema fixes (~line 173)
```python
# Fix default (was 80, should match brain.py default):
("first_segment_chars", "INTEGER DEFAULT 15"),

# New key:
("ultra_first_segment_chars", "INTEGER DEFAULT 8"),
```

#### Add to conversation_policy key list (~line 509)
```python
"ultra_first_segment_chars",
"barge_in_grace_period_ms",
"barge_in_debounce_ms",
"topic_check_async",
```

---

### 4. `voicebot/livekit_agent.py`

#### `on_audio_interrupt` callback — Drain frame buffer
Inside the `start()` closure where `on_audio_output` is defined:
```python
async def on_audio_interrupt():
    _audio_buf.clear()  # Drop partial frame — prevents stale audio artifacts
```

Pass to `AgenticBrain`:
```python
AgenticBrain(..., on_audio_interrupt=on_audio_interrupt, ...)
```

---

## Optimal Bot Config (conversation_policy JSON)
```json
{
  "barge_in_grace_period_ms": 300,
  "barge_in_debounce_ms": 100,
  "ultra_first_segment_chars": 8,
  "first_segment_chars": 15,
  "max_tts_buffer_chars": 100,
  "tts_streaming_mode": "chunked",
  "tts_pipeline_llm": true,
  "llm_latency_watchdog_sec": 1.2,
  "topic_check_async": true,
  "silence_threshold_ms": 400,
  "max_silence_threshold_ms": 1000
}
```
All keys read from DB — zero hardcoded values.

---

## Expected Latency After Changes

| Metric | Before | After |
|--------|--------|-------|
| Barge-in lag (grace+debounce) | 1150ms | 400ms (300 grace + 100 debounce) |
| Time to first audio (TTFS) | ~600–900ms | ~300–500ms |
| TTS stop after interrupt | ~200–400ms | <50ms (immediate cancel + queue drain) |
| Topic check overhead | 200–500ms blocking | 0ms (background, races LLM) |
| TTS consumer cancellability | None (nested closure) | Instant (stored task ref) |

## Verification Steps
1. **Barge-in**: Let bot speak 3-sentence response. Interrupt mid-sentence. Bot must stop within 400ms.
2. **TTFS**: Ask "What is your name?" — measure time from your last word to first audio byte. Should be <500ms (Groq TTFT 400ms + ultra-flush at 8 chars ≈ 2 tokens + Deepgram WS 50ms).
3. **Cache hit**: Ask same question twice. Second response must be instantaneous (no LLM call, `session.last_llm_latency_ms ≈ 0`).
4. **Off-topic**: Enable `refuse_off_topic: true`. Ask off-topic question. Bot should start speaking within 300ms, not blank-pause for 300ms.
5. **Metrics**: Check `on_metrics` receives `{"type": "ttfs", "ttfs_ms": <500}` per turn.
6. **No hardcoded data**: Set `barge_in_grace_period_ms: 500` in DB for a bot. Verify brain uses 500ms, not 300ms.

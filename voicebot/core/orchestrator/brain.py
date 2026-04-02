"""
Agentic Brain — The core decision engine of the voice bot.

This is the orchestrator's "mind". It:
  1. Receives partial STT transcripts and decides when a turn is complete
  2. Constructs LLM prompts with conversation context
  3. Streams LLM tokens to TTS in real-time
  4. Detects and handles user interruptions
  5. Manages conversation flow and state transitions

The brain operates as an async state machine with these states:
  LISTENING → PROCESSING → SPEAKING → LISTENING (normal flow)
  SPEAKING → INTERRUPTED → LISTENING (interruption flow)
"""

from __future__ import annotations

import asyncio
import async_timeout
import hashlib
import json
import time
import logging
from enum import Enum
from typing import Any, Awaitable, Callable, List, Optional

# ─── Constants ────────────────────────────────────────────────────────
# ─── End Constants ───────────────────────────────────────────────────

from voicebot.shared.config import get_settings
from voicebot.shared.agent_task_spec import parse_agent_task_spec, render_agent_task_spec_appendix
from voicebot.shared.policy import (
    cache_ttl_seconds,
    injection_enabled,
    injection_threshold,
    kb_only_mode,
    parse_json_dict,
    tts_flush_mode,
    tts_pipeline_llm,
    tts_streaming_mode,
)
from voicebot.services.guardrail.injection_detector import InjectionDetector
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.models.session import SessionState, TurnRole
from voicebot.shared.models.tools import ToolCall, ToolDefinition, ToolResult, LLMResponse
from voicebot.core.orchestrator.turn_detector import TurnDetector
from voicebot.shared.exceptions import VoiceBotError, ServiceExhaustedError, AuthError
from voicebot.core.tools.registry import ToolRegistry

from fastapi import WebSocketDisconnect
try:
    from uvicorn.protocols.utils import ClientDisconnected
except ImportError:
    class ClientDisconnected(Exception): pass

settings = get_settings()
logger = setup_logger("orchestrator-brain", level=settings.log_level)

_VOICEBOT_PROCESS_START = time.time()

_SCOPE_TOOL_NAMES = {
    "knowledge": ("search_knowledge",),
    "appointments": ("book_appointment", "get_appointments"),
    "user_memory": ("remember_user_fact",),
    "weather": ("get_weather",),
    "banking": ("verify_customer", "get_account_balance", "get_loan_status"),
}


class BotState(str, Enum):
    """State machine for the voice bot."""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"


class AgenticBrain:
    """
    The Agent Brain — coordinates the real-time voice pipeline.

    Design decisions:
      - Uses asyncio.Event for interruption signaling (zero-latency cancellation)
      - Accumulates partial transcripts and uses semantic VAD to decide turn boundaries
      - Streams LLM tokens directly to TTS for minimum latency
      - Maintains conversation history for context-aware responses
    """
    
    @staticmethod
    def is_hindi(text: str) -> bool:
        """Check if the text contains Devanagari (Hindi) characters."""
        if not text:
            return False
        # Devanagari range: U+0900 to U+097F
        return any('\u0900' <= char <= '\u097f' for char in text)

    def __init__(
        self,
        session: SessionState,
        stt_handler: Any = None,
        llm_handler: Any = None,
        tts_handler: Any = None,
        guardrail_handler: Any = None,
        memory_handler: Any = None,
        db_handler: Any = None,  # SQLite long-term memory
        bot_config: Optional[dict] = None,  # Loaded bot persona from DB
        on_state_change: Optional[Callable] = None,
        on_audio_output: Optional[Callable] = None,
        on_transcript: Optional[Callable] = None,
        on_bot_transcript: Optional[Callable] = None,
        on_tool_call: Optional[Callable] = None,
        on_tool_result: Optional[Callable] = None,
        on_log: Optional[Callable] = None,
        on_metrics: Optional[Callable] = None,
        output_guard_handler: Any = None,
        on_voice_session_end: Optional[Callable[[str], Awaitable[None]]] = None,
        on_audio_interrupt: Optional[Callable] = None,
        on_audio_resume: Optional[Callable] = None, # NEW: Allow resuming playback if noise detected
    ) -> None:
        self.session = session
        self.stt = stt_handler
        self.llm = llm_handler
        self.tts = tts_handler
        self.guardrail = guardrail_handler
        self.output_guard = output_guard_handler
        self.memory = memory_handler
        self.db = db_handler
        self._bot_config = bot_config or {}
        
        self.state = BotState.LISTENING
        self._last_state_change_time = 0.0 # NEW: for barge-in grace period
        
        self._on_state_change = on_state_change
        self._on_audio_output = on_audio_output
        self._on_transcript = on_transcript
        self._on_bot_transcript = on_bot_transcript
        self._on_tool_call = on_tool_call
        self._on_tool_result = on_tool_result
        self._on_log = on_log
        self._on_metrics = on_metrics
        self._on_voice_session_end = on_voice_session_end
        self._on_audio_interrupt = on_audio_interrupt
        self._on_audio_resume = on_audio_resume # NEW
        self._bot_id: Optional[str] = self._bot_config.get("id")
        self._guardrail_policy: dict = parse_json_dict(self._bot_config.get("guardrail_policy"))
        self._data_access_policy: dict = parse_json_dict(self._bot_config.get("data_access_policy"))
        self._conversation_policy: dict = parse_json_dict(self._bot_config.get("conversation_policy"))
        self._agent_task_spec: dict = parse_agent_task_spec(self._bot_config.get("agent_task_spec"))
        self._topic_restriction: Optional[str] = self._bot_config.get("topic_restriction")
        self._refuse_off_topic: bool = bool(self._bot_config.get("refuse_off_topic", 0))

        # Phase 2: Logic (Speculative Intent)
        from voicebot.core.orchestrator.task_manager import TaskCancellationManager
        self.task_manager = TaskCancellationManager()

        # [GEMINI-GRADE] Initialize TurnDetector with bot-specific policies
        self.turn_detector = TurnDetector(
            min_silence_ms=float(self._conversation_policy.get("silence_threshold_ms", 600)),
            max_silence_ms=float(self._conversation_policy.get("max_silence_threshold_ms", 2000)),
            extra_backchannels=self._conversation_policy.get("extra_backchannels")
        )
        
        # Initialize session language from bot config if not already set or returning to defaults
        # This ensures the Watchdog filler uses the correct language from the very first turn.
        _initial_lang = self._bot_config.get("default_language")
        if _initial_lang and self.session.detected_language == "en":
             self.session.detected_language = _initial_lang
             logger.info("🧠 Brain: Initialized session language from bot config: %s", _initial_lang)
        self._injection_detector: Optional[InjectionDetector] = None
        if injection_enabled(self._guardrail_policy):
            self._injection_detector = InjectionDetector(threshold=injection_threshold(self._guardrail_policy))
        self._interrupt_prompt_suffix: str = ""

        # Hydrate session from memory if available
        if self.memory:
            asyncio.create_task(self._hydrate_session())

        # Eagerly warm the LLM client so the first user turn has no cold-start penalty.
        if self.llm and hasattr(self.llm, "_get_client"):
            asyncio.create_task(self.llm._get_client())

        # Callbacks for the WebSocket handler
        self._on_state_change = on_state_change
        self._on_audio_output = on_audio_output
        self._on_transcript = on_transcript
        self._on_bot_transcript = on_bot_transcript
        self._on_tool_call = on_tool_call
        self._on_tool_result = on_tool_result
        self._on_log = on_log
        self._on_metrics = on_metrics
        self._on_voice_session_end = on_voice_session_end
        self._on_audio_interrupt = on_audio_interrupt
        self._on_audio_resume = on_audio_resume

        # Interruption control
        self._interrupt_event = asyncio.Event()
        self._current_task: Optional[asyncio.Task] = None

        # Partial transcript accumulation
        self._partial_buffer: str = ""
        self._utterance_buffer: str = ""  # Accumulates finalized Deepgram segments across endpoints
        # Captures user finals that arrive WHILE the bot is speaking (during barge-in debounce).
        # Restored to _utterance_buffer after handle_interruption so short phrases aren't lost.
        self._barge_in_buffer: str = ""
        self._silence_timer: Optional[asyncio.Task] = None
        self._apply_conversation_policy_derived()
        self._proactive_timer: Optional[asyncio.Task] = None  # "Still there?" timer
        self._inactivity_timer: Optional[asyncio.Task] = None  # configurable silent-timeout timer
        # Priority: bot_config field → global setting → hard default (60s)
        self._inactivity_timeout_secs: int = int(
            self._bot_config.get("inactivity_timeout_seconds")
            or settings.inactivity_timeout_seconds
            or 60
        )

        # STT confidence tracking and debounce state
        self._last_stt_confidence: float = 1.0
        self._last_utterance_end_time: float = 0.0
        self._last_processed_text: str = ""  # Tracked to ignore repeating noise/partials
        self._cross_session_context: str = ""

        # Sentiment tracking (rolling per-session for escalation decisions)
        self._sentiment_history: list[str] = []  # "positive" | "neutral" | "negative" per turn
        
        # Tools Registry (loaded based on bot config)
        self._tools = self._register_tools()

        # Latency tracking
        self._turn_start_time: float = 0.0
        self._turn_count: int = 0
        
        # Extensible dynamic node workflow
        self.workflow_engine = None

    def _apply_conversation_policy_derived(self) -> None:
        """Load timing, TTS chunking, and streaming options from conversation_policy."""
        pol = self._conversation_policy
        try:
            # Default to 1000ms (1.0s) for a robust "generic" experience, or 1.5s if requested.
            st = float(pol.get("silence_threshold_ms", 1000))
            self._silence_threshold_ms = st if 600 <= st <= 5000 else 1000.0
        except (TypeError, ValueError):
            self._silence_threshold_ms = 1000.0

        try:
            # Maximum silence before forced submission (safety watchdog)
            self._max_silence_threshold_ms = float(pol.get("max_silence_threshold_ms", 2500))
        except (TypeError, ValueError):
            self._max_silence_threshold_ms = 2500.0
        try:
            # 100 chars (~20 words) flushes sooner → faster first audio to user.
            # Operators can raise this per-bot if they prefer fewer, longer TTS segments.
            self._max_tts_buffer_chars = int(pol.get("max_tts_buffer_chars", 100))
            self._max_tts_buffer_chars = max(30, min(self._max_tts_buffer_chars, 500))
        except (TypeError, ValueError):
            self._max_tts_buffer_chars = 100
        self._tts_flush_mode = tts_flush_mode(pol)
        self._tts_streaming_mode = tts_streaming_mode(pol)
        self._tts_pipeline_llm = tts_pipeline_llm(pol) and self._tts_streaming_mode == "chunked"

    async def _set_state(self, new_state: BotState) -> None:
        """Transition to a new state and notify listeners."""
        old_state = self.state
        self.state = new_state
        self._last_state_change_time = time.time() # NEW: track timeline
        logger.info(
            "State transition: %s → %s (session=%s)",
            old_state.value,
            new_state.value,
            self.session.session_id[:8],
        )
        if self._on_state_change:
            await self._on_state_change(new_state.value)
        
        # Log state transition to client terminal
        tag = "[STATE]"
        color = "text-primary"
        if new_state == BotState.PROCESSING:
            tag = "[BRAIN]"
            color = "text-indigo-400"
        elif new_state == BotState.SPEAKING:
            tag = "[VOICE]"
            color = "text-cyan-400"
        elif new_state == BotState.LISTENING:
            tag = "[EARS]"
            color = "text-green-400"
            # Flush Deepgram's buffer FIRST to discard any TTS-echo audio accumulated
            # during the speaking period, then reset VAD for the new listening turn.
            if self.stt and hasattr(self.stt, "finalize"):
                await self.stt.finalize()
            if self.stt and hasattr(self.stt, "reset_vad"):
                self.stt.reset_vad()

        await self._log_event(tag, f"Transitioned to {new_state.value}", color)

        # ─── Inactivity Timer Control ───
        if new_state == BotState.LISTENING:
            self._reset_inactivity_timer()
        else:
            self._stop_inactivity_timer()

    async def _log_event(self, tag: str, message: str, color: str = "text-outline") -> None:
        """Helper to send a log event to the client UI terminal."""
        if self._on_log:
            await self._on_log(tag, message, color)

    def request_voice_session_end(self, reason: str) -> None:
        """Mark the voice session to end after the current assistant turn finishes (TTS complete)."""
        self.session.voice_session_end_requested = True
        self.session.voice_session_end_reason = (reason or "completed").strip() or "completed"

    def _update_task_phase_from_user_text(self, user_text: str) -> None:
        """Lightweight heuristics for call_phase / objection_round when agent_task_spec is set."""
        if not self._agent_task_spec:
            return
        t = (user_text or "").lower()
        meta = self.session.metadata
        phase = meta.get("call_phase", "open")
        objection_round = int(meta.get("objection_round", 0) or 0)
        max_r = self._agent_task_spec.get("max_persuasion_rounds")
        try:
            max_r = int(max_r) if max_r is not None else None
        except (TypeError, ValueError):
            max_r = None

        refuse_markers = (
            "not interested",
            "no thanks",
            "don't call",
            "do not call",
            "stop calling",
            "leave me alone",
            "i refuse",
            "won't pay",
            "cant pay",
            "can't pay",
            "not paying",
        )
        if any(m in t for m in refuse_markers):
            objection_round += 1
            meta["user_stance"] = "refused"
            meta["objection_round"] = objection_round
            if max_r is not None and objection_round >= max_r:
                meta["call_phase"] = "closing"
            else:
                meta["call_phase"] = "handle_objection"
        elif any(m in t for m in ("how do i pay", "how to pay", "payment link", "where to pay", "pay online")):
            meta["call_phase"] = "pitch"
            meta.setdefault("user_stance", "neutral")
        elif meta.get("call_phase", "open") == "open" and len(self.session.conversation_history) >= 2:
            meta["call_phase"] = "pitch"

    def _format_task_phase_hint(self) -> str:
        if not self._agent_task_spec:
            return ""
        meta = self.session.metadata
        phase = meta.get("call_phase")
        if not phase:
            return ""
        parts = [f"\n\n[Session hint: call_phase={phase}"]
        if meta.get("user_stance"):
            parts.append(f", user_stance={meta.get('user_stance')}")
        if meta.get("objection_round") is not None:
            parts.append(f", objection_round={meta.get('objection_round')}")
        parts.append("]")
        if phase == "handle_objection":
            parts.append(
                " Respond with empathy; offer one alternative angle from value_props or objection_handling; stay polite."
            )
        elif phase == "closing":
            parts.append(
                " User has declined repeatedly or exit conditions met: give a brief polite goodbye, then call end_voice_session."
            )
        return "".join(parts)

    # ─── Audio Input Handling ────────────────────────────────────────────

    async def process_audio_chunk(self, chunk: bytes) -> None:
        """
        Ingest raw audio from the client.
        Passes it to the STT provider and detects intent patterns.
        """
        # Debug metadata for tracking ingestion
        if len(chunk) > 0:
            logger.debug("Ingested audio chunk: %d bytes (session=%s)", len(chunk), self.session.session_id[:8])

        # Send audio to Deepgram in ALL states — needed for barge-in during SPEAKING
        if self.stt:
            await self.stt.send_audio(chunk)

        if self.state != BotState.LISTENING:
            return

        self.session.is_user_speaking = True
        self._turn_start_time = self._turn_start_time or time.time()

    async def process_stt_partial(self, text: str, is_final: bool, **kwargs: Any) -> None:
        """
        Handle a partial or final transcript from STT.
        """
        msg_type = kwargs.get("msg_type")
        confidence = kwargs.get("confidence", 1.0)
        
        # [GEMINI-GRADE] Noise & Hallucination Filter
        if text.strip() and len(text.strip()) < 2 and not is_final and confidence < 0.5:
             logger.debug("🧠 Hallucination Filter: dropping short token '%s' (conf=%.2f)", text.strip(), confidence)
             return

        logger.info("🧠 Brain STT Ingested: '%s' [final=%s, type=%s, state=%s]", text, is_final, msg_type, self.state.value)

        # Handle interruptions with a configurable debounce (default 350 ms).
        # We now allow interruptions during SPEAKING and (optionally) PROCESSING.
        _barge_in_enabled = bool(self._bot_config.get("enable_barge_in", True))
        
        if msg_type == "speech_started" and _barge_in_enabled:
            # OPTIMIZATION: Only interrupt in PROCESSING state if explicitly allowed.
            # Default behavior is to only allow barge-in while the bot is actually SPEAKING.
            # Interrupting while PROCESSING often leads to false-positives from echo/noise
            # cutting off the LLM before it can even start.
            _allow_proc_interrupt = bool(self._bot_config.get("allow_interruption_while_processing", False))
            
            if self.state == BotState.SPEAKING or (self.state == BotState.PROCESSING and _allow_proc_interrupt):
                # 🚀 PRODUCTION OPTIMIZATION: Echo/Noise Grace Period
                # Ignore interruptions in the first 500ms of speaking (converging echo canner)
                # unless explicitly disabled.
                _grace_period_ms = int(
                    (self._bot_config or {}).get("barge_in_grace_period_ms", 600)
                )
                _elapsed = (time.time() - self._last_state_change_time) * 1000
                if self.state == BotState.SPEAKING and _elapsed < _grace_period_ms:
                    logger.debug("🧠 Barge-in Ignored: Within echo/noise grace period (%.0fms < %dms)", _elapsed, _grace_period_ms)
                    return

                # Signal the frontend to STOP audio playback instantly
                if self._on_audio_interrupt:
                    await self._on_audio_interrupt()
                
                _debounce_ms = int(
                    (self._bot_config or {}).get("barge_in_debounce_ms", 350)
                )
                await asyncio.sleep(_debounce_ms / 1000.0)
                
                if self.state in (BotState.SPEAKING, BotState.PROCESSING):   # Still active
                    # Advanced: Backchannel Filtering (Soft Kill)
                    snapshot = (self._partial_buffer or text).strip()
                    if not snapshot:
                        logger.info("🧠 Noise detected (empty transcript after debounce), resuming playback...")
                        self.session.false_interruption_count += 1
                        # RESUME: Inform UI to re-enable playback if we decide it was noise!
                        if self._on_audio_resume:
                            await self._on_audio_resume()
                        return

                    if self.turn_detector.is_backchannel(snapshot):
                        logger.info("🧠 Backchannel detected ('%s'), resuming playback...", snapshot.strip())
                        self.session.false_interruption_count += 1
                        self._partial_buffer = "" # discard backchannel text
                        if self._on_audio_resume:
                            await self._on_audio_resume()
                        return

                    await self.handle_interruption()
                else:
                    # Debounce suppressed this event — it was likely acoustic echo
                    self.session.false_interruption_count += 1
                    # Ensure playback resumes if it was blocked by immediately-sent interrupt signal
                    if self._on_audio_resume:
                        await self._on_audio_resume()
                    self._barge_in_buffer = ""
                return

        # If speaking/processing, capture transcripts into the barge-in buffer.
        if self.state in (BotState.SPEAKING, BotState.PROCESSING):
            if text.strip():
                # 🚀 CRUCIAL: Trim already processed prefix from cumulative transcripts
                _clean_text = text.strip()
                if self._last_processed_text:
                    # Fuzzy prefix match: if first 15 chars match, it's likely a cumulative repeat
                    prefix_threshold = min(15, len(self._last_processed_text))
                    if _clean_text.lower()[:prefix_threshold] == self._last_processed_text.lower()[:prefix_threshold]:
                        # Find the point where they diverge or take the length of processed text
                        # We use the length of the processed text as a safer truncation point
                        _clean_text = _clean_text[len(self._last_processed_text):].strip()
                
                if not _clean_text:
                    return # Nothing new
                
                self._partial_buffer = _clean_text
                
                if is_final:
                    sep = " " if self._barge_in_buffer else ""
                    self._barge_in_buffer = (self._barge_in_buffer + sep + _clean_text).strip()
                    logger.debug("Captured barge-in text (trimmed): '%s'", self._barge_in_buffer)
            return

        # Language Detection Module logic: Update session language if detected with high confidence
        stt_lang = kwargs.get("language")
        if stt_lang and stt_lang != self.session.detected_language:
            # We only switch if it's a stable signal
            logger.debug("Language Detection: Detected '%s' (current: '%s')", stt_lang, self.session.detected_language)
            self.session.detected_language = stt_lang

        # Update partial buffer
        if text.strip():
            # Reset inactivity timer since user is talking
            self._reset_inactivity_timer()
            # --- Anticipation Module ---
            # If not a final transcript and has some length, try to pre-warm LLM
            if not is_final and len(text.split()) > 2:
                asyncio.create_task(self._predictive_prewarm(text))

            self._partial_buffer = text  # Latest Deepgram segment text (full text so far in segment)

            if is_final:
                # Accumulate across Deepgram endpoint segments to handle split utterances.
                # (User pausing mid-sentence triggers separate Deepgram finals; we join them.)
                sep = " " if self._utterance_buffer else ""
                self._utterance_buffer = (self._utterance_buffer + sep + text.strip()).strip()

        # Notify client
        if self._on_transcript:
            await self._on_transcript(text, is_final)

        # Store STT confidence for low-confidence graceful recovery
        incoming_confidence = kwargs.get("confidence")
        if incoming_confidence is not None:
            self._last_stt_confidence = float(incoming_confidence)

        if is_final and text.strip():
            self._last_utterance_end_time = time.time()
            await self._log_event("[STT]", f"Final transcript: \"{text}\"", "text-yellow-400")

        # Turn Detection Logic (Debounce)
        if text.strip() or is_final or msg_type == "utterance_end":
            # --- Smart Reset Optimization ---
            # If the current text is identical to what we just processed, it's likely a
            # trailing Deepgram partial or background noise hallucination — ignore it.
            clean_text = text.strip()
            if clean_text == self._last_processed_text and not is_final and not (msg_type == "utterance_end"):
                logger.debug("Suppressing debounce reset: text unchanged (noise filter)")
                return

            # Recalculate silence threshold dynamically based on linguistic confidence
            # (silence duration is not yet known; it will be passed in _wait_for_silence)
            combined_text = (self._utterance_buffer or self._partial_buffer).strip()
            
            # Advanced: Use the TurnDetector's dynamic logic (Phase 1)
            dynamic_threshold = self.turn_detector.get_recommended_threshold(
                combined_text,
                self._max_silence_threshold_ms,
                pitch_signal=kwargs.get("pitch_signal")
            )

            # Endpoint-specific optimizations (slightly faster but still forgiving)
            if is_final:
                # Deepgram already waited its internal silence (e.g. 200ms)
                dynamic_threshold = min(dynamic_threshold, 600.0)
            elif msg_type == "utterance_end":
                # Definitive VAD signal — snap respond
                dynamic_threshold = 300.0

            if self._silence_timer:
                self._silence_timer.cancel()

            self._silence_timer = asyncio.create_task(
                self._wait_for_silence(dynamic_threshold)
            )

    async def _wait_for_silence(self, threshold_ms: float) -> None:
        """
        Wait for a period of silence, then fire the user turn.
        Reads the latest accumulated utterance at fire time (not captured at creation),
        so split-endpoint segments are correctly joined before processing.
        """
        try:
            await asyncio.sleep(threshold_ms / 1000.0)

            # Safety check: are we still in a state where we should start a turn?
            if self.state != BotState.LISTENING:
                logger.debug("Silence detected but state is %s. Ignoring turn trigger.", self.state)
                return

            # fall back to latest partial if no finals arrived yet.
            transcript = (self._utterance_buffer or self._partial_buffer).strip()
            if not transcript:
                return

            # 🛡️ DEDUPLICATION GUARD: Prevent reprocessing text that already triggered a turn.
            # Deepgram often sends a [final=True] with the same text ~5s after we processed the partial.
            if transcript == self._last_processed_text:
                logger.debug("🧠 Deduplication: ignoring stale transcript '%s'", transcript[:50])
                return

            # Compute actual elapsed silence from when the last utterance ended
            actual_silence_ms = threshold_ms
            if self._last_utterance_end_time > 0:
                actual_silence_ms = (time.time() - self._last_utterance_end_time) * 1000

            # --- Hard WATCHDOG for "Always Submit" ---
            # If silence exceeds our global limit (e.g. 2.5s), we force-submit even if confidence is low.
            if actual_silence_ms >= self._max_silence_threshold_ms:
                logger.info("Watchdog Triggered: Force-submitting turn after %.1fs silence", actual_silence_ms/1000)
            else:
                # Re-evaluate turn confidence with the actual silence duration now known
                # Advanced: Transition to using is_turn_complete (Phase 1)
                is_complete = self.turn_detector.is_turn_complete(
                    transcript, actual_silence_ms
                )
                logger.debug(
                    "Turn re-evaluation: complete=%s (silence=%.0fms)",
                    is_complete, actual_silence_ms,
                )
                
                if not is_complete:
                    # Confidence is too low, user is likely still pausing mid-thought
                    # Reset the inactivity timer to avoid timing out while the user thinks
                    self._reset_inactivity_timer()
                    return
                
                # If confidence is still very low (linguistically incomplete), and we haven't hit the watchdog,
                # we could choose to wait longer, but with the 2s max threshold above, it should naturally
                # have fired by now.

            # Silence threshold reached — user has finished speaking
            logger.info(
                "Turn complete (silence detected): threshold=%.0fms, transcript='%s'",
                threshold_ms,
                transcript[:50],
            )
            self.session.is_user_speaking = False

            # Cancel proactive timer since user just spoke
            if self._proactive_timer:
                self._proactive_timer.cancel()
                self._proactive_timer = None

            # Track this text to prevent repeated debounce resets on the same content
            self._last_processed_text = transcript

            await self._process_user_turn(transcript)

            # After the turn, start the proactive silence timer
            self._proactive_timer = asyncio.create_task(self._proactive_silence_check())

        except asyncio.CancelledError:
            # More speech arrived — timer was reset
            pass

    async def _proactive_silence_check(self) -> None:
        """If user is silent for 10s after a bot response, ask if they're still there."""
        try:
            await asyncio.sleep(10.0)
            # 🛡️ SAFETY CHECK: Don't prompt if there is pending user speech in the buffer
            # That the turn_detector is actively evaluating!
            if (self._utterance_buffer + self._partial_buffer).strip():
                logger.debug("Proactive silence: user spoke recently but turn not finalized. Skipping prompt.")
                return

            if self.state == BotState.LISTENING:
                logger.info("Proactive silence: user quiet for 10s, prompting...")
                proactive_messages = self._bot_config.get("proactive_prompts", [])
                if not proactive_messages:
                    lang = self.session.detected_language or "hi"
                    if "hi" in lang.lower():
                        proactive_messages = [
                            "क्या आप अभी भी वहां हैं? अगर आपको किसी और चीज़ की ज़रूरत है तो मुझे बताएं.",
                            "जब आप तैयार हों तो मैं यहीं हूं.",
                            "अपना समय लें - मैं सुन रहा हूं.",
                        ]
                    else:
                        proactive_messages = [
                            "Are you still there? Just let me know if you need anything.",
                            "I'm here whenever you're ready.",
                            "Take your time — I'm still listening.",
                        ]
                
                import random
                msg = random.choice(proactive_messages)
                await self._stream_text_to_tts(msg, time.time())
                if self._on_bot_transcript:
                    await self._on_bot_transcript(msg, True)
                # _emit_tts_audio_stream sets state to SPEAKING but never resets it.
                # Without this, the bot stays SPEAKING after the proactive prompt and
                # never processes the next user turn.
                await self._set_state(BotState.LISTENING)
                self._reset_inactivity_timer()
        except asyncio.CancelledError:
            pass

    # ─── Core Pipeline: STT → Guardrail → LLM → TTS ────────────────────

    async def _predictive_prewarm(self, text: str) -> None:
        """
        Anticipate the user's intent to reduce latency (Step 2.1).
        If high-confidence tokens appear in partials, trigger speculative tool execution.
        """
        text = text.lower()
        # 🎯 Confidence Thresholding (Phase 2)
        # For simplicity, we assign 'confidence' based on token length and precision.
        words = text.split()
        confidence = min(len(words) / 10.0, 1.0) # Heuristic (placeholder for real NLU classifier)

        # Triggers async LLM pre-warming
        if hasattr(self.llm, "_get_client"):
            asyncio.create_task(self.llm._get_client())

        # Speculative Intent Handling (Phase 2)
        intent_map = {
            "balance": "verify_customer", # Speculatively pre-warm identity verification or balance lookup
            "check my account": "verify_customer",
            "verify": "verify_customer",
            "search": "search_knowledge",
            "look up": "search_knowledge",
            "what is": "search_knowledge",
        }

        for keyword, tool_name in intent_map.items():
            if keyword in text:
                logger.debug("🎯 Phase 2: Speculatively pre-warming tool '%s' for '%s'", tool_name, text)
                # We spawn the tool speculatively (if tool system supports it)
                # For now, we only pre-warm connections or light metadata fetches.
                # await self.task_manager.spawn_speculative(
                #     tool_name, 
                #     lambda: self._execute_tool_silent(tool_name), 
                #     confidence=confidence
                # )
                break

    async def _load_cross_session_context(self) -> None:
        """
        Load 3-layer cross-session memory for a returning user.
        Populates self._cross_session_context which is injected into _build_system_prompt().

        Layer 1: Persistent user facts (name, account, preferences).
        Layer 2: Past session summaries (compressed LLM digests of previous calls).
        Layer 3: Recent turns from most recent prior session (verbatim continuity).
        """
        user_id = self.session.user_id
        if not user_id or not self.db:
            return
        try:
            ctx = await self.db.get_user_cross_session_context(user_id)
            parts = []

            if ctx.get("facts"):
                facts_str = " | ".join(f["fact"] for f in ctx["facts"][:10])
                parts.append(f"Known about this caller: {facts_str}")

            if ctx.get("past_summaries"):
                lines = [
                    f"- {s['summary']}"
                    for s in ctx["past_summaries"]
                    if s.get("summary")
                ]
                if lines:
                    parts.append("Previous conversations:\n" + "\n".join(lines))

            if ctx.get("recent_turns"):
                recent = "\n".join(
                    f"{t['role'].capitalize()}: {t['content']}"
                    for t in ctx["recent_turns"]
                )
                parts.append(f"Last conversation excerpt:\n{recent}")

            if parts:
                self._cross_session_context = "\n\n".join(parts)
                logger.info(
                    "Cross-session context loaded for user '%s' (%d chars)",
                    user_id, len(self._cross_session_context),
                )
        except Exception as e:
            logger.warning("Failed to load cross-session context: %s", e)

    async def start_conversation(self) -> None:
        """
        Trigger the initial greeting from the bot.
        Uses bot-specific greeting from DB config if available.
        """
        logger.info("🎬 Starting conversation (session=%s)", self.session.session_id[:8])

        # Load cross-session memory for returning users before the greeting
        await self._load_cross_session_context()

        await self._set_state(BotState.PROCESSING)
        self._interrupt_event.clear()
        
        # Load Workflow Engine if applicable
        if self._bot_config.get("workflow_id") and self.db:
            wf_data = await self.db.get_workflow(self._bot_config["workflow_id"])
            if wf_data:
                from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
                self.workflow_engine = WorkflowEngine(self, wf_data)
                logger.info("Loaded generic workflow engine: %s", wf_data.get('name', 'Unknown'))
            else:
                self.workflow_engine = None

        # Use custom greeting from bot config if set
        custom_greeting = self._bot_config.get("greeting")
        try:
            if custom_greeting:
                logger.info("Using bot greeting (session=%s): %s", self.session.session_id[:8], custom_greeting[:60])
                # We try to speak, but if it fails, we still want the transcript
                try:
                    await self._stream_text_to_tts(custom_greeting, time.time())
                except Exception as tts_err:
                    logger.warning("Greeting TTS failed: %s", tts_err)
                    await self._log_event("[SYSTEM]", "Voice greeting failed. Continuing with text.", "text-yellow-400")

                if self._on_bot_transcript:
                    await self._on_bot_transcript(custom_greeting, True)
                
                await self._set_state(BotState.LISTENING)
                # Log the greeting as an assistant turn
                self.session.add_turn(TurnRole.ASSISTANT, custom_greeting)
                if self.db:
                    await self.db.log_turn(self.session.session_id, "assistant", custom_greeting)
            else:
                # LLM-generated greeting based on persona
                bot_name = self._bot_config.get("name", "Assistant")
                persona = self._bot_config.get("persona", "helpful and friendly")
                intro_instruction = f"You are {bot_name}, a {persona} AI assistant. Greet the user warmly in one sentence and invite them to speak."
                await self._run_llm_turn(intro_instruction, override_system_prompt=True)
        except Exception as e:
            logger.error("Critical error in start_conversation: %s", e)
            await self._set_state(BotState.LISTENING)

        # Start proactive timer after greeting
        self._proactive_timer = asyncio.create_task(self._proactive_silence_check())

    async def _run_llm_turn(
        self,
        instruction: str = "",
        override_system_prompt: bool = False,
        cache_key: Optional[str] = None,
        _qa_question: Optional[str] = None,
    ) -> None:
        """
        Internal method to handle the LLM -> TTS flow.
        """
        turn_start = time.time()
        full_response = ""
        max_iterations = 3
        iteration = 0

        system_prompt = self._build_system_prompt()
        if override_system_prompt:
            system_prompt = f"{system_prompt}\n\nINSTRUCTION: {instruction}"

        text_accumulated_whole_turn = ""
        total_turn_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        _filler_fired_this_turn = False  # Track whether watchdog filler already played

        try:
            if self.llm:
                while iteration < max_iterations:
                    iteration += 1
                    context = self.session.get_context_window(max_turns=20)
                    tts_buffer = ""
                    tool_calls_this_turn = []
                    executed_in_this_loop = set() # Track unique calls in this specific iteration

                    whole_turn = getattr(self, "_tts_streaming_mode", "chunked") == "whole_turn"
                    use_pipeline = bool(getattr(self, "_tts_pipeline_llm", False)) and not whole_turn and bool(self.tts)

                    segment_q: Optional[asyncio.Queue[Optional[str]]] = None
                    consumer_task: Optional[asyncio.Task] = None

                    async def _consume_tts_queue() -> None:
                        assert segment_q is not None
                        while True:
                            if self._interrupt_event.is_set():
                                return
                            seg = await segment_q.get()
                            if seg is None:
                                return
                            if self._interrupt_event.is_set():
                                return
                            await self._emit_tts_audio_stream(seg)

                    if use_pipeline:
                        segment_q = asyncio.Queue()
                        consumer_task = asyncio.create_task(_consume_tts_queue())

                    # First-sentence fast-path: use a smaller char cap (Phase 3)
                    # to achieve <300ms TTFS.
                    _first_segment_done = False
                    _first_seg_cap = int(
                        self._bot_config.get("first_segment_chars")
                        or self._conversation_policy.get("first_segment_chars")
                        or 40
                    )

                    # --- Latency Watchdog (Phase 4) ---
                    # Only inject filler on the FIRST LLM call of a turn.
                    # Tool-follow-up iterations (iteration > 1) skip the watchdog to avoid
                    # repeated "Ek minute" fillers during multi-step tool chains.
                    _tokens_received = False
                    _watchdog_fired = False
                    async def _latency_watchdog():
                        nonlocal _tokens_received, _watchdog_fired, _filler_fired_this_turn
                        await asyncio.sleep(0.8) # 800ms threshold — Groq typically takes 600-1500ms
                        if not _tokens_received and not self._interrupt_event.is_set() and not _filler_fired_this_turn:
                            _watchdog_fired = True
                            _filler_fired_this_turn = True
                            # Inject filler (Hinglish/English)
                            # We check both detected_language and preferred_language to be safe.
                            _current_lang = (self.session.detected_language or self.session.preferred_language or "hi").lower()
                            filler = "Hmm... let me check." if "hi" not in _current_lang else "Ek minute... main check karta hoon."
                            
                            logger.info("🧠 Watchdog: LLM slow (>400ms), injecting filler: '%s' (lang=%s)", filler, _current_lang)
                            # Sync context (Step 4.2: Prevent LLM Amnesia)
                            self.session.add_turn(TurnRole.ASSISTANT, filler)
                            await self._emit_tts_audio_stream(filler, turbo=True)

                    _watchdog_task = asyncio.create_task(_latency_watchdog())

                    try:
                        async with async_timeout.timeout(30.0):
                            async for chunk in self.llm.stream_completion(
                                system_prompt=system_prompt,
                                messages=context,
                                tools=self._tools,
                                temperature=self._bot_config.get("temperature"),
                                max_tokens=self._bot_config.get("max_tokens"),
                            ):
                                if not _tokens_received:
                                    _tokens_received = True
                                    if _watchdog_task:
                                        _watchdog_task.cancel()
                                    if _watchdog_fired and self._on_metrics:
                                        # Signal frontend to crossfade (Phase 4)
                                        await self._on_metrics({"type": "audio_handoff"})

                                if self._interrupt_event.is_set():
                                    break

                                if chunk.usage:
                                    p = chunk.usage.get("prompt_tokens", 0)
                                    c = chunk.usage.get("completion_tokens", 0)
                                    t = chunk.usage.get("total_tokens", 0)
                                    total_turn_usage["prompt_tokens"] += p
                                    total_turn_usage["completion_tokens"] += c
                                    total_turn_usage["total_tokens"] += t
                                    self.session.cumulative_prompt_tokens += p
                                    self.session.cumulative_completion_tokens += c
                                    self.session.cumulative_total_tokens += t

                                if chunk.content:
                                    # Anti-hallucination Filter: Remove <function> tags or raw JSON from spoken text
                                    import re
                                    clean_content = re.sub(r'<function.*?</function>', '', chunk.content, flags=re.DOTALL)
                                    # Also strip standalone JSON-like blocks that Llama 3 sometimes leaks
                                    clean_content = re.sub(r'\{".*?":\s*".*?"\}', '', clean_content)
                                    
                                    full_response += chunk.content
                                    tts_buffer += clean_content
                                    text_accumulated_whole_turn += clean_content

                                    if whole_turn and self._on_bot_transcript:
                                        await self._on_bot_transcript(text_accumulated_whole_turn, False)

                                    if not whole_turn and self.tts:
                                        # First segment: use smaller cap for faster first audio
                                        flush_cap = _first_seg_cap if not _first_segment_done else self._max_tts_buffer_chars
                                        if self.turn_detector.is_sentence_boundary(tts_buffer, char_cap=flush_cap, mode=self._tts_flush_mode):
                                            safe_tts_text = self._guard_tts_segment(tts_buffer)
                                            if safe_tts_text:
                                                if not _first_segment_done:
                                                    # Record time from turn_start to first TTS flush
                                                    self.session.first_audio_latency_ms = (
                                                        time.time() - turn_start
                                                    ) * 1000
                                                if use_pipeline and segment_q is not None:
                                                    await segment_q.put(safe_tts_text)
                                                else:
                                                    await self._emit_tts_audio_stream(safe_tts_text)
                                            if self._on_bot_transcript:
                                                await self._on_bot_transcript(text_accumulated_whole_turn, False)
                                            tts_buffer = ""
                                            _first_segment_done = True

                                if chunk.tool_calls:
                                    tool_calls_this_turn.extend(chunk.tool_calls)
                                    for tc in chunk.tool_calls:
                                        await self._log_event("[PLAN]", f"LLM requested tool: {tc.name}", "text-purple-400")

                        if self._interrupt_event.is_set():
                            pass
                        elif whole_turn and tts_buffer.strip() and self.tts:
                            safe_final = self._guard_tts_segment(tts_buffer)
                            if safe_final:
                                await self._emit_tts_audio_stream(safe_final)
                        elif not whole_turn and tts_buffer.strip() and self.tts and not self._interrupt_event.is_set():
                            safe_tail = self._guard_tts_segment(tts_buffer)
                            if safe_tail:
                                if use_pipeline and segment_q is not None:
                                    await segment_q.put(safe_tail)
                                else:
                                    await self._emit_tts_audio_stream(safe_tail)
                            if self._on_bot_transcript:
                                await self._on_bot_transcript(text_accumulated_whole_turn, False)

                    finally:
                        if use_pipeline and segment_q is not None and consumer_task is not None:
                            await segment_q.put(None)
                            if self._interrupt_event.is_set():
                                # Cancel immediately so mid-TTS consumer stops without sending more audio.
                                consumer_task.cancel()
                            try:
                                await consumer_task
                            except asyncio.CancelledError:
                                pass

                    if self._interrupt_event.is_set():
                        break

                    if tool_calls_this_turn:
                        # Prevent infinite loops if LLM repeats same tool calls
                        call_sig = "|".join([f"{tc.name}:{tc.arguments}" for tc in tool_calls_this_turn])
                        if getattr(self, "_last_call_sig", None) == call_sig:
                            logger.warning("🧠 Detect tool-call loop (same calls requested twice). Breaking with recovery.")
                            # Force a recovery message so the bot doesn't go silent
                            recovery_text = "I'm sorry, I'm having a little trouble with those details. Could you please repeat your account number and date of birth clearly?"
                            if (self.session.detected_language or "en") == "hi":
                                recovery_text = "Maaf kijiye, mujhe details samajhne mein dikkat ho rahi hai. Kya aap ek baar phir se apna account number bata sakte hain?"
                            
                            await self._stream_text_to_tts(recovery_text, time.time())
                            self.session.add_turn(TurnRole.ASSISTANT, recovery_text)
                            break
                        self._last_call_sig = call_sig

                        tool_results = await self._execute_tools(tool_calls_this_turn)
                        for res in tool_results:
                            self.session.add_turn(
                                TurnRole.SYSTEM, f"Tool Result [{res.name}]: {res.content}"
                            )
                            if self.memory:
                                await self.memory.add_history(
                                    self.session.session_id,
                                    {
                                        "role": "system",
                                        "content": f"Tool Result [{res.name}]: {res.content}",
                                    },
                                )
                        if self.session.voice_session_end_requested:
                            break
                        continue
                    break

        except (WebSocketDisconnect, ClientDisconnected) as e:
            logger.info("📡 Client disconnected during turn (session=%s). Stopping generation.", self.session.session_id[:8])
            self._interrupt_event.set()
            raise e
        except Exception as e:
            logger.error("LLM Turn error: %s", e, exc_info=True)
            await self._log_event("[SYSTEM]", f"Voice/LLM Error: {str(e)[:100]}", "text-red-400")
        finally:
            if text_accumulated_whole_turn and not self._interrupt_event.is_set():
                ttl = cache_ttl_seconds(self._guardrail_policy)
                await self._finalize_turn(
                    text_accumulated_whole_turn,
                    turn_start,
                    usage=total_turn_usage,
                    cache_key=cache_key,
                    cache_ttl_seconds=ttl,
                    _qa_question=_qa_question,
                )
            elif not self._interrupt_event.is_set():
                # Safety fallback to prevent state hanging
                await self._set_state(BotState.LISTENING)

    async def _generate_and_speak(self, text: str) -> None:
        """Speak fixed text (workflows, rejection messages). Logs assistant turn via _finalize_turn."""
        t = self._strip_technical_artifacts(text or "")
        if not t:
            return
        if self.output_guard:
            t = self.output_guard.validate_and_mask(t)["masked_text"]
        turn_start = time.time()
        self._interrupt_event.clear()
        await self._stream_text_to_tts(t, turn_start)
        await self._finalize_turn(t, turn_start)

    async def _process_user_turn(self, user_text: str) -> None:
        self._reset_inactivity_timer()
        await self._set_state(BotState.PROCESSING)
        self._interrupt_event.clear()
        self._last_call_sig = None  # Reset tool-loop tracking for new turn
        self._barge_in_buffer = ""  # Clear any leftover barge-in content from previous turn

        turn_start = time.time()

        # ── Step 0: STT confidence check — ask for clarification on noisy input ──
        _min_confidence = float(
            self._bot_config.get("min_stt_confidence")
            or self._conversation_policy.get("min_stt_confidence")
            or 0.5
        )
        _word_count = len(user_text.split())
        if _word_count <= 2 and self._last_stt_confidence < _min_confidence:
            logger.info(
                "Low STT confidence (%.2f < %.2f) on short utterance '%s' — asking for repeat",
                self._last_stt_confidence, _min_confidence, user_text,
            )
            await self._set_state(BotState.LISTENING)
            await self._generate_and_speak(
                "I didn't quite catch that. Could you say that again?"
            )
            return

        # ── Step 1: Guardrail check ──
        await self._log_event("[BRAIN]", f"Screening input (PII Detection & Safety)...", "text-indigo-400")
        logger.debug("Phase 1: Guardrail check starting... (session=%s)", self.session.session_id[:8])
        safe_text = user_text
        pii_detected = False
        if self.guardrail:
            # Apply Input Guardrails (PII Detection)
            try:
                logger.debug("Running guardrails on user input...")
                # Note: PIIDetector.detect_and_mask is synchronous
                guardrail_result = self.guardrail.detect_and_mask(user_text)
                pii_detected = bool(guardrail_result.get("detected"))
                if pii_detected:
                    logger.warning(
                        "PII detected in user input! Masked Version: %s",
                        guardrail_result.get("masked_text"),
                    )
                    # We continue with the masked text for the LLM
                    safe_text = guardrail_result.get("masked_text", user_text)
                # If not detected, safe_text remains user_text
            except Exception as e:
                logger.error("Guardrail check failed: %s", e, exc_info=True)
                # Fail open — continue with original text (user_text)

        if self._guardrail_policy.get("reject_on_pii") and self.guardrail and pii_detected:
            msg = self._guardrail_policy.get(
                "pii_reject_message",
                "I can't process requests that include that kind of personal information.",
            )
            logger.warning("PII reject policy triggered (session=%s)", self.session.session_id[:8])
            self.session.add_turn(TurnRole.USER, safe_text)
            if self.memory:
                await self.memory.add_history(
                    self.session.session_id, {"role": "user", "content": safe_text}
                )
            if self.db:
                await self.db.log_turn(self.session.session_id, "user", safe_text)
            self._turn_count += 1
            await self._generate_and_speak(msg)
            return

        if self._injection_detector:
            inj = self._injection_detector.check(safe_text)
            if inj["detected"] and self._guardrail_policy.get("injection_action", "log") == "block":
                msg = self._guardrail_policy.get(
                    "injection_block_message",
                    "I can't process that request.",
                )
                logger.warning("Injection block (session=%s)", self.session.session_id[:8])
                self.session.add_turn(TurnRole.USER, safe_text)
                if self.memory:
                    await self.memory.add_history(
                        self.session.session_id, {"role": "user", "content": safe_text}
                    )
                if self.db:
                    await self.db.log_turn(self.session.session_id, "user", safe_text)
                self._turn_count += 1
                await self._generate_and_speak(msg)
                return
        
        # ── Step 1.5: Topic Guardrail Check ──
        if self._topic_restriction and self._refuse_off_topic:
            await self._log_event("[BRAIN]", f"Verifying topic relevance for '{self._topic_restriction}'...", "text-indigo-400")
            is_on_topic = await self._check_topic_relevance(safe_text, self._topic_restriction)
            if not is_on_topic:
                msg = f"I am specialized in {self._topic_restriction}. Is there something related to that I can help with?"
                logger.warning("Topic guardrail triggered (session=%s)", self.session.session_id[:8])
                self.session.add_turn(TurnRole.USER, safe_text)
                if self.memory:
                    await self.memory.add_history(self.session.session_id, {"role": "user", "content": safe_text})
                if self.db:
                    await self.db.log_turn(self.session.session_id, "user", safe_text)
                self._turn_count += 1
                await self._generate_and_speak(msg)
                return

        # ── Step 2: Update conversation history ──
        logger.debug("Phase 2: Updating context... (session=%s)", self.session.session_id[:8])
        # Clear buffers ASAP to prevent watchdog or race conditions from re-submitting
        _safe_text = safe_text
        self._last_processed_text = _safe_text
        self._utterance_buffer = ""
        self._partial_buffer = ""
        
        self.session.add_turn(TurnRole.USER, _safe_text)
        if self.memory:
            await self.memory.add_history(self.session.session_id, {"role": "user", "content": safe_text})
        # Log to SQLite long-term memory
        if self.db:
            await self.db.log_turn(self.session.session_id, "user", safe_text)
        self._turn_count += 1
        self._update_task_phase_from_user_text(safe_text)

        # ── Step 2.1a: Real-time Sentiment Analysis ──
        # Run as a background task so it doesn't add to voice latency.
        asyncio.create_task(self._analyze_and_emit_sentiment(safe_text))

        # ── Step 2.1b: Automatic Entity Extraction ──
        # Background task: extract named entities and store as user_facts without LLM tool call.
        if self.session.user_id or self.session.session_id:
            asyncio.create_task(self._extract_and_store_entities(safe_text))

        # ── Step 2.1: Dynamic Workflow Execution ──
        if self.workflow_engine:
            logger.info("Evaluating text via WorkflowEngine & Global Interceptor...")
            yield_to_llm = await self.workflow_engine.evaluate(safe_text)
            if not yield_to_llm:
                # Turn was completely handled by deterministic blocks and pre-flight interceptor
                # Reset turn state
                self.session.is_bot_speaking = False
                self._partial_buffer = ""
                self._utterance_buffer = ""
                self._turn_start_time = 0.0
                if not self._interrupt_event.is_set():
                    await self._set_state(BotState.LISTENING)
                return

        # ── Step 2.3: Vector RAG — inject semantically relevant KB snippets ──
        # Runs only when a VectorMemoryProvider is attached (optional; falls back silently).
        if hasattr(self, "_vector_memory") and self._vector_memory:
            try:
                rag_results = await self._vector_memory.retrieve_context(
                    query=safe_text,
                    user_id=self.session.user_id,
                    top_k=3,
                )
                if rag_results:
                    rag_snippets = "\n".join(
                        f"- {r['document']}" for r in rag_results if r.get("document")
                    )
                    if rag_snippets:
                        # Append RAG context to the conversation as a hidden system message
                        self.session.add_turn(
                            TurnRole.SYSTEM,
                            f"[Relevant past context retrieved]\n{rag_snippets}",
                        )
                        logger.info("RAG: injected %d snippets into context", len(rag_results))
            except Exception as _rag_err:
                logger.debug("RAG retrieval error (non-critical): %s", _rag_err)

        # ── Step 2.5: Semantic Cache Lookup ──
        system_prompt = self._build_system_prompt()
        context = self.session.get_context_window(max_turns=5)  # Limited window for caching
        ctx_serialized = json.dumps(context, sort_keys=True, default=str)
        cache_key = hashlib.md5(
            f"{system_prompt}:{ctx_serialized}:{safe_text}".encode()
        ).hexdigest()
        
        if self.memory:
            logger.info("Phase 2.5: Checking semantic cache (key=%s)...", cache_key[:8])
            cached_response = await self.memory.get_cache(cache_key)
            if cached_response:
                logger.info("⚡ Semantic Cache Hit! (key=%s)", cache_key[:8])
                await self._log_event("[METRIC]", "Semantic Cache HIT (latency minimized)", "text-green-400")
                if self._on_state_change:
                   await self._on_state_change("cached") # Notify UI
                await self._stream_text_to_tts(cached_response, turn_start)
                await self._finalize_turn(cached_response, turn_start)
                return
        
        # ── Step 2.6: Semantic QA cache lookup (cross-session, embedding-based) ──
        # This catches semantically similar questions even when exact wording differs
        # (e.g. "mera balance kya hai?" == "check my balance please?").
        if self._vector_memory and getattr(self._vector_memory, "_available", False) and self._bot_id:
            try:
                _qa_hit = await self._vector_memory.lookup_qa(
                    bot_id=str(self._bot_id),
                    question=safe_text,
                )
                if _qa_hit:
                    await self._log_event("[METRIC]", "QA Semantic Cache HIT (cross-session)", "text-green-400")
                    await self._stream_text_to_tts(_qa_hit, turn_start)
                    await self._finalize_turn(
                        _qa_hit, turn_start,
                        cache_key=cache_key,
                        _qa_question=safe_text,
                    )
                    return
            except Exception as _qa_err:
                logger.debug("QA cache lookup error (non-critical): %s", _qa_err)

        # ── Step 3: Generate LLM response ──
        logger.info("📡 Starting Agentic Turn (session=%s)...", self.session.session_id[:8])
        await self._run_llm_turn(cache_key=cache_key, _qa_question=safe_text)

    async def _analyze_and_emit_sentiment(self, text: str) -> None:
        """
        Classify sentiment of the user's utterance and emit a WebSocket event.

        Runs as a background task — must NOT block the voice pipeline.

        Resolution order (fastest first, no LLM unless truly needed):
          1. Keyword regex — zero cost, handles the majority of clear-cut cases
          2. Workflow engine's _classify_sentiment (uses cached Groq, not main LLM)
          3. Main LLM fallback (only when workflow_engine is unavailable)
        """
        if not text.strip():
            return
        try:
            from voicebot.core.orchestrator.workflow_engine import _POSITIVE_RE, _NEGATIVE_RE

            # Stage 1 — keyword regex (0ms, no LLM)
            _pos = bool(_POSITIVE_RE.search(text))
            _neg = bool(_NEGATIVE_RE.search(text))
            if _pos and not _neg:
                label = "positive"
            elif _neg and not _pos:
                label = "negative"
            elif len(text.split()) <= 3:
                # Short neutral filler — no need for an LLM call
                label = "neutral"
            else:
                # Stage 2 — cheap classifier via WorkflowEngine (Groq, not main LLM)
                if self.workflow_engine:
                    label = await self.workflow_engine._classify_sentiment(text)
                elif self.llm:
                    # Stage 3 — last-resort: main LLM (only if no workflow engine)
                    prompt = (
                        f'Classify the sentiment of this user utterance with ONE word: '
                        f'positive, neutral, or negative.\n\nUtterance: "{text[:200]}"'
                    )
                    chunks: list[str] = []
                    async for chunk in self.llm.stream_completion(
                        system_prompt="You are a sentiment classifier. Reply only: positive, neutral, or negative.",
                        messages=[{"role": "user", "content": prompt}],
                    ):
                        chunks.append(chunk.content or "")
                    raw = "".join(chunks).strip().lower()
                    label = "neutral"
                    if "positive" in raw:
                        label = "positive"
                    elif "negative" in raw:
                        label = "negative"
                else:
                    label = "neutral"

            self._sentiment_history.append(label)
            if len(self._sentiment_history) > 10:
                self._sentiment_history = self._sentiment_history[-10:]

            # Emit real-time sentiment event to the UI
            if self._on_metrics:
                await self._on_metrics({
                    "type": "sentiment",
                    "label": label,
                    "turn_sentiment": label,
                    "rolling_negative": self._sentiment_history.count("negative"),
                })

            # Auto-escalation: 3+ consecutive negative turns → trigger escalation
            _recent = self._sentiment_history[-3:] if len(self._sentiment_history) >= 3 else []
            if len(_recent) == 3 and all(s == "negative" for s in _recent):
                logger.warning(
                    "3 consecutive negative sentiment turns — requesting escalation (session=%s)",
                    self.session.session_id[:8],
                )
                self.request_voice_session_end("escalated_sentiment")
                await self._generate_and_speak(
                    "I can hear this is frustrating. Let me connect you with a team member who can help you directly."
                )

            await self._log_event(
                "[SENTIMENT]",
                f"Turn sentiment: {label} (history: {self._sentiment_history[-5:]})",
                "text-emerald-400",
            )
        except Exception as e:
            logger.debug("Sentiment analysis failed (non-critical): %s", e)

    async def _check_topic_relevance(self, text: str, topic: str) -> bool:
        """
        Use a lightweight LLM call to verify if the user's query is on-topic.
        Returns True if related or ambiguous, False if clearly unrelated.
        """
        if not self.llm or not text.strip() or not topic:
            return True
        try:
            prompt = (
                f"Topic: {topic}\n"
                f"User Utterance: \"{text}\"\n\n"
                "Is this user utterance related to the given topic? "
                "Consider related concepts, questions about the business, or common clarifications. "
                "Reply only with 'YES' or 'NO'."
            )
            chunks = []
            async for chunk in self.llm.stream_completion(
                system_prompt="You are a topic relevance classifier. Reply only 'YES' or 'NO'.",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,  # Deterministic
                max_tokens=5,
            ):
                chunks.append(chunk.content or "")
            raw = "".join(chunks).strip().upper()
            return "YES" in raw or "NO" not in raw
        except Exception as e:
            logger.debug("Topic relevance check failed (failing open): %s", e)
            return True

    async def _extract_and_store_entities(self, text: str) -> None:
        """
        Extract key entities from the user's utterance and persist them as user_facts.
        Runs as a background task — does NOT block the voice pipeline.

        Extracts: caller name, account/loan reference, amounts, payment dates, phone numbers.
        """
        if not self.db or not text.strip():
            return
        import re

        entities_found: list[tuple[str, str]] = []

        # Name patterns: "my name is X", "I am X", "this is X"
        name_match = re.search(
            r"\b(?:my name is|i(?:'m| am)|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            text, re.IGNORECASE,
        )
        if name_match:
            entities_found.append(("name", f"Caller name: {name_match.group(1).strip()}"))

        # Indian currency amounts: ₹5000, Rs 2000, 5000 rupees
        amount_match = re.search(
            r"(?:₹|Rs\.?\s*|INR\s*)(\d[\d,]+(?:\.\d{1,2})?)"
            r"|(\d[\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?)",
            text, re.IGNORECASE,
        )
        if amount_match:
            amount = (amount_match.group(1) or amount_match.group(2) or "").replace(",", "")
            entities_found.append(("amount", f"Amount mentioned: ₹{amount}"))

        # Account/loan reference: alphanumeric IDs after keywords
        ref_match = re.search(
            r"\b(?:account|loan|reference|ref|id|number)\s*(?:number|no\.?)?\s*[:#]?\s*([A-Z0-9]{4,20})",
            text, re.IGNORECASE,
        )
        if ref_match:
            entities_found.append(("account_ref", f"Account/loan ref: {ref_match.group(1)}"))

        # Payment date: "by the 25th", "on March 25", "by end of month"
        date_match = re.search(
            r"\b(?:by|on|before)\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|end of (?:month|week))",
            text, re.IGNORECASE,
        )
        if date_match:
            entities_found.append(("payment_date", f"Promised payment by: {date_match.group(1)}"))

        for category, fact in entities_found:
            try:
                await self.db.save_user_fact(
                    fact=fact,
                    session_id=self.session.session_id,
                    user_id=self.session.user_id,
                    category=category,
                )
                logger.debug("Auto-extracted entity [%s]: %s", category, fact)
            except Exception as e:
                logger.debug("Entity save failed (non-critical): %s", e)

        if entities_found:
            await self._log_event(
                "[ENTITY]",
                f"Auto-extracted {len(entities_found)} entities from utterance",
                "text-blue-400",
            )

    def _guard_tts_segment(self, raw_buffer: str) -> str:
        """Strip and apply output guard to a TTS phrase."""
        t = (raw_buffer or "").strip()
        if not t:
            return ""
            
        # [GEMINI-GRADE] Secondary Tool/JSON Stripping
        # This catches tags that were split across LLM chunks or leaked into the buffer.
        import re
        t = re.sub(r'<function.*?</function>', '', t, flags=re.DOTALL)
        t = re.sub(r'\{".*?":\s*".*?"\}', '', t)
        t = re.sub(r'<function.*?>', '', t) # Strip partial opening tags
        t = re.sub(r'.*?</function>', '', t) # Strip partial closing tags
        t = t.strip()
        
        if not t:
            return ""

        if self.output_guard:
            return str(self.output_guard.validate_and_mask(t).get("masked_text") or t).strip()
        return t

    async def _emit_tts_audio_stream(self, text: str, turbo: bool = False) -> None:
        """Stream one TTS synthesis to the client; one short log per segment."""
        t = (text or "").strip()
        if not self.tts or not t:
            return
        # Clear interrupt event explicitly before starting synthesis loop
        # to ensure the first word doesn't bail on a stale signal.
        self._interrupt_event.clear()
        
        await self._set_state(BotState.SPEAKING)
        self.session.is_bot_speaking = True  # <-- Set speaking flag for interruption detection
        
        if self._on_log:
            voice_id = getattr(self.tts, "model", getattr(self.tts, "voice_id", "unknown"))
            # Log first part of text to help debug silent segments
            safe_text = t[:30] + "..." if len(t) > 30 else t
            await self._log_event(
                "[STREAM]",
                f"TTS segment ({len(t)} chars) \"{safe_text}\" [Voice: {voice_id}]",
                "text-cyan-400",
            )
        
        _tts_t0 = time.time()
        _first_chunk = True
        interrupted = False
        
        # Phase 3: Turbo TTS for the very first segment
        tts_kwargs = {"turbo": True} if turbo or _first_chunk else {}
        
        async for audio_chunk in self.tts.stream_speech(t, **tts_kwargs):
            if self._interrupt_event.is_set():
                interrupted = True
                break
            
            if _first_chunk:
                # Track time-to-first-sound for metrics
                self.session.last_tts_latency_ms = (time.time() - _tts_t0) * 1000
                _first_chunk = False
                
            if self._on_audio_output:
                await self._on_audio_output(audio_chunk)
        
        # Reset speaking flag
        self.session.is_bot_speaking = False
        
        # On interruption, reset the WS TTS buffer so stale synthesis doesn't
        # trickle through on the next turn (no-op for HTTP provider).
        if interrupted and hasattr(self.tts, "reset"):
            await self.tts.reset()

    async def _stream_text_to_tts(self, text: str, turn_start: float) -> None:
        """Helper to stream a static text through the TTS pipeline."""
        if not self.tts:
            return
        await self._emit_tts_audio_stream(text)

    async def _finalize_turn(
        self,
        full_response: str,
        turn_start: float,
        usage: Optional[dict] = None,
        cache_key: Optional[str] = None,
        cache_ttl_seconds: int = 3600,
        _qa_question: Optional[str] = None,
    ) -> None:
        """Common logic to end a turn: history update, tracking, and cache save."""
        self.session.add_turn(TurnRole.ASSISTANT, full_response)

        if self.memory:
            await self.memory.add_history(self.session.session_id, {"role": "assistant", "content": full_response})
            if cache_key:
                await self.memory.set_cache(cache_key, full_response, ttl=cache_ttl_seconds)

        # Store in semantic QA cache for cross-session reuse.
        # Only cache non-trivial answers (> 10 words) to avoid caching greetings/fillers.
        if (
            _qa_question
            and full_response
            and len(full_response.split()) > 10
            and self._vector_memory
            and getattr(self._vector_memory, "_available", False)
            and self._bot_id
        ):
            try:
                asyncio.create_task(
                    self._vector_memory.cache_qa(
                        bot_id=str(self._bot_id),
                        question=_qa_question,
                        answer=full_response,
                    )
                )
            except Exception:
                pass

        # Log to SQLite long-term memory
        if self.db:
            await self.db.log_turn(self.session.session_id, "assistant", full_response)

        # ── Track total latency ──
        total_latency = (time.time() - turn_start) * 1000
        self.session.last_total_latency_ms = total_latency
        
        # Emit structured metrics for the dashboard
        if self._on_metrics:
            _tts_name = type(self.tts).__name__ if self.tts else "none"
            self.session.tts_provider_used = _tts_name
            await self._on_metrics({
                "stt": round(self.session.last_stt_latency_ms, 0),
                "llm": round(self.session.last_llm_latency_ms, 0),
                "tts": round(self.session.last_tts_latency_ms, 0),
                "first_audio": round(self.session.first_audio_latency_ms, 0),
                "inter_segment_gap": round(self.session.inter_segment_gap_ms, 0),
                "false_interruptions": self.session.false_interruption_count,
                "tts_provider": _tts_name,
                "total": round(total_latency, 0),
                # Token usage fields (Aggregated for obsidian-command)
                "tokens_input": usage.get("prompt_tokens", 0) if usage else 0,
                "tokens_output": usage.get("completion_tokens", 0) if usage else 0,
                "tokens_total": usage.get("total_tokens", 0) if usage else 0,
                "session_tokens_input": self.session.cumulative_prompt_tokens,
                "session_tokens_output": self.session.cumulative_completion_tokens,
                "session_tokens_total": self.session.cumulative_total_tokens,
                # Success metrics
                "tool_success_rate": 100 if self.session.false_interruption_count < 2 else 50
            })

        # Persist per-turn latency metrics to SQLite for analytics
        if self.db and hasattr(self.db, "log_turn_metrics"):
            try:
                # Merge tokens if available
                prompt = usage.get("prompt_tokens", 0) if usage else 0
                completion = usage.get("completion_tokens", 0) if usage else 0

                asyncio.create_task(self.db.log_turn_metrics(
                    session_id=self.session.session_id,
                    stt_ms=self.session.last_stt_latency_ms,
                    llm_ms=self.session.last_llm_latency_ms,
                    tts_ms=self.session.last_tts_latency_ms,
                    total_ms=total_latency,
                    first_audio_ms=self.session.first_audio_latency_ms,
                    prompt_tokens=prompt,
                    completion_tokens=completion
                ))
            except Exception:
                pass

        await self._log_event("[METRIC]", f"Turn complete: TAT={total_latency:.0f}ms | LLM={self.session.last_llm_latency_ms:.0f}ms", "text-yellow-400")

        # Reset state
        self.session.is_bot_speaking = False
        self._partial_buffer = ""
        self._utterance_buffer = ""
        self._barge_in_buffer = ""   # Clear barge-in on normal turn end so it can't leak into next interrupt
        self._turn_start_time = 0.0

        if self._on_bot_transcript:
            await self._on_bot_transcript(full_response, True)

        if not self._interrupt_event.is_set():
            if self.session.voice_session_end_requested and self._on_voice_session_end:
                reason = self.session.voice_session_end_reason or "completed"
                self.session.voice_session_end_requested = False
                self.session.voice_session_end_reason = None
                if self._proactive_timer:
                    self._proactive_timer.cancel()
                    self._proactive_timer = None
                try:
                    await self._on_voice_session_end(reason)
                except Exception as e:
                    logger.warning("on_voice_session_end error: %s", e)
                return
            await self._set_state(BotState.LISTENING)

    # ─── Interruption Handling ───────────────────────────────────────────

    async def handle_interruption(self) -> None:
        """
        Handle user interruption of bot speech.

        Strategy:
          1. Set the interrupt event (signals all streaming loops to stop)
          2. Stop TTS playback
          3. Transition back to LISTENING
          4. Record the partial response in history
        """
        if self.state not in (BotState.SPEAKING, BotState.PROCESSING):
            return

        logger.info(
            "Interruption detected — session=%s", self.session.session_id[:8]
        )

        # Signal all streaming loops to stop immediately
        self._interrupt_event.set()

        # Notify the frontend to flush its audio queue right away.
        if self._on_audio_interrupt:
            await self._on_audio_interrupt()

        # Cancel a pending silence timer so a ghost turn doesn't fire after the interrupt.
        if self._silence_timer:
            self._silence_timer.cancel()
            self._silence_timer = None

        # Restore any user speech captured during the barge-in debounce window.
        # Without this, short phrases ("stop", "wait", "ok") spoken while the bot
        # was talking are lost and the bot freezes in LISTENING state with no turn to fire.
        self._utterance_buffer = self._barge_in_buffer
        self._partial_buffer = ""
        self._barge_in_buffer = ""

        self.session.mark_interrupted()
        if self._conversation_policy.get("interrupt_aware_reply", True):
            self.session.interrupt_prompt_pending = True
            logger.debug("📌 Tracked interruption prompt pending (session=%s)", self.session.session_id[:8])

        # Stop TTS if it's playing.
        # For the persistent WS TTS provider, reset() clears Deepgram's buffer
        # so stale synthesis doesn't leak into the next turn.
        if self.tts:
            if hasattr(self.tts, "reset"):
                await self.tts.reset()
            else:
                await self.tts.stop()

        await self._set_state(BotState.LISTENING)

        # If the user already finished speaking during the debounce window, their text
        # is now in _utterance_buffer but no more transcripts will arrive to trigger a
        # silence timer.  Start one now with a dynamic threshold so the turn fires promptly.
        if self._utterance_buffer:
            _barge_conf = self.turn_detector.compute_turn_complete_confidence(
                self._utterance_buffer, 0
            )
            _barge_threshold = (
                600.0 if _barge_conf > 0.8
                else 800.0 if _barge_conf > 0.5
                else self._silence_threshold_ms
            )
            self._silence_timer = asyncio.create_task(
                self._wait_for_silence(_barge_threshold)
            )

    # ─── Tools & Functions ───────────────────────────────────────────────

    def _register_tools(self) -> List[ToolDefinition]:
        """Define available tools. Only register tools enabled for this bot."""
        enabled = set(self._bot_config.get("tools_enabled") or [
            "search_knowledge", "book_appointment", "get_appointments",
            "remember_user_fact", "get_weather"
        ])
        scopes = self._data_access_policy.get("enabled_scopes")
        if scopes and isinstance(scopes, list) and len(scopes) > 0:
            allowed: set[str] = set()
            for s in scopes:
                key = str(s).lower()
                for n in _SCOPE_TOOL_NAMES.get(key, ()):
                    allowed.add(n)
            if allowed:
                enabled = enabled & allowed

        registered_tools = []
        for name in enabled:
            tool_cls = ToolRegistry.get_tool_class(name)
            if tool_cls:
                # We instantiate just to get the definition for LLM config
                tool = tool_cls()
                registered_tools.append(ToolDefinition(
                    name=tool.name,
                    description=tool.description,
                    parameters=tool.parameters
                ))
        return registered_tools

    async def _execute_tools(self, calls: List[ToolCall]) -> List[ToolResult]:
        """Execute tool calls — backed by real SQLite DB where applicable."""
        results = []
        for call in calls:
            try:
                logger.info("⚙️  Executing tool: %s with args: %s", call.name, call.arguments)
                if self._on_tool_call:
                    await self._on_tool_call(call.name, call.arguments)

                args = call.arguments
                
                # Dynamic Tool Loading from Registry
                tool_instance = ToolRegistry.instantiate_tool(
                    call.name,
                    session=self.session,
                    db=self.db,
                    data_access_policy=self._data_access_policy,
                    brain=self,
                )

                if tool_instance:
                    self._on_tool_started(call.name)
                    result_text = await tool_instance.execute(
                        bot_id=self._bot_id,
                        data_access=self._data_access_policy,
                        **args,
                    )
                else:
                    result_text = f"Tool '{call.name}' is not currently implemented."

                if self._on_tool_result:
                    await self._on_tool_result(call.name, result_text)

                results.append(ToolResult(
                    tool_call_id=call.id,
                    name=call.name,
                    content=result_text
                ))

            except Exception as e:
                self._on_tool_failed(call.name)
                logger.error("Tool execution error [%s]: %s", call.name, e, exc_info=True)
                if self._on_tool_result:
                    await self._on_tool_result(call.name, f"Error: {str(e)}")
                results.append(ToolResult(
                    tool_call_id=call.id,
                    name=call.name,
                    content=f"Tool error: {str(e)}",
                    is_error=True
                ))
        return results

    # ─── System Prompt Construction ──────────────────────────────────────
    
    async def get_infra_status(self) -> dict:
        """
        Return real-time health of every infrastructure component.

        Status values understood by the frontend StatusBadge:
          "online"     – connected and healthy
          "offline"    – provider exists but WebSocket / HTTP connection is down
          "simulator"  – STT unavailable; session running in text/simulator mode
          "degraded"   – provider connected but experiencing errors
          "unavailable" – provider not configured at all
        """
        up = int(time.time() - _VOICEBOT_PROCESS_START)

        def _provider_label(obj, fallback: str) -> str:
            return (getattr(obj, "provider", None) or fallback).capitalize()

        def _tts_label(obj) -> str:
            if not obj:
                return "TTS"
            cls = obj.__class__.__name__
            if "Deepgram" in cls:
                return "Deepgram"
            if "ElevenLabs" in cls:
                return "ElevenLabs"
            return getattr(obj, "provider", "TTS").capitalize()

        status: dict = {
            "uptime_seconds": up,
            "uptime": f"{up}s",
            "stt_provider": _provider_label(self.stt, "STT"),
            "llm_provider": _provider_label(self.llm, "LLM"),
            "tts_provider": _tts_label(self.tts),
        }

        # ── Redis ──────────────────────────────────────────────────────────────
        if self.memory:
            try:
                status["redis"] = "online" if await self.memory.ping() else "offline"
            except Exception:
                status["redis"] = "offline"
        else:
            status["redis"] = "unavailable"

        # ── STT ────────────────────────────────────────────────────────────────
        if not self.stt:
            status["stt"] = "unavailable"
        elif getattr(self.stt, "_connected", None) is False:
            # Provider exists but WebSocket connection failed/dropped
            status["stt"] = "simulator"
        else:
            status["stt"] = "online"

        # ── LLM ────────────────────────────────────────────────────────────────
        if not self.llm:
            status["llm"] = "unavailable"
        else:
            # LLM providers are stateless HTTP; flag offline only if explicitly
            # marked (e.g., after a repeated 401/429).
            status["llm"] = "degraded" if getattr(self.llm, "_error_state", False) else "online"

        # ── TTS ────────────────────────────────────────────────────────────────
        if not self.tts:
            status["tts"] = "unavailable"
        elif getattr(self.tts, "_connected", None) is False:
            status["tts"] = "offline"
        else:
            status["tts"] = "online"

        return status

    def _build_system_prompt(self) -> str:
        """
        Build the system prompt for the LLM.
        Uses bot config from DB if available, otherwise defaults.
        """
        lang = self.session.detected_language or "en"
        lang_instruction = ""
        if lang != "en":
            lang_instruction = (
                f"\nIMPORTANT: The user is speaking in '{lang}'. "
                f"You MUST respond in the SAME language ('{lang}'). "
                f"Do NOT switch to English unless the user speaks English. "
                f"Never include technical tags, JSON, or <function> tags in your spoken response."
            )

        extra = ""
        if getattr(self.session, "interrupt_prompt_pending", False):
            extra = "\n\n[Context: The user interrupted your previous spoken reply. Acknowledge briefly and respond to what they say next.]"
            self.session.interrupt_prompt_pending = False
        if kb_only_mode(self._guardrail_policy):
            extra += (
                "\n\nFor factual questions about the business, policies, or services, "
                "use the search_knowledge tool and base answers on retrieved text; do not invent details."
            )

        spec_block = render_agent_task_spec_appendix(self._agent_task_spec)
        phase_hint = self._format_task_phase_hint()

        # Cross-session memory block: injected when a returning user_id is known
        memory_block = ""
        if self._cross_session_context:
            memory_block = (
                "\n\n[CALLER MEMORY — use this to personalize your responses]\n"
                + self._cross_session_context
                + "\n[END CALLER MEMORY]"
            )

        # Use DB-configured system prompt if available
        if self._bot_config.get("system_prompt"):
            return (
                self._bot_config["system_prompt"]
                + lang_instruction + extra + memory_block + spec_block + phase_hint
            )

        # Fallback default
        bot_name = self._bot_config.get("name", "Assistant")
        return (
            f"You are {bot_name}, a helpful, friendly AI voice assistant. "
            "You are having a real-time voice conversation with a human.\n\n"
            "Guidelines:\n"
            "- Keep responses concise and conversational (1-3 sentences)\n"
            "- Speak naturally — use contractions, filler words sparingly\n"
            "- Emotion & Tone: Dynamically adapt your tone based on context. "
            "If the user is frustrated, be empathetic. If they are happy, be enthusiastic. "
            "You may use descriptive emotion cues like [excited], [thoughtful], or [concerned] at the start of your turn to help the voice engine adapt (these tags will be stripped before speaking if needed).\n"
            "- Never use markdown, bullet points, or formatting-only tags\n"
            "\n[SYSTEM NOTE: LATENCY FILLERS]\n"
            "You may occasionally see '[system_filler]' or tokens like 'Hmm', 'One second...', 'Let me check...' in the conversation history. "
            "These were injected by the system to bridge network latency while you were thinking. "
            "IGNORE these in your decision-making. Do NOT repeat or acknowledge them. "
            "If the user responds TO a filler, prioritize their latest request."
            "- Never mention that you are an AI unless directly asked\n"
            "- If you don't understand, ask for clarification\n"
            "- Be warm, empathetic, and professional\n"
            "- Never reveal sensitive information (passwords, OTPs, card numbers)\n"
            f"{lang_instruction}{extra}{memory_block}{spec_block}{phase_hint}"
        )

    async def switch_bot(self, bot_config: dict) -> None:
        """
        Hot-swap the bot persona mid-call without disconnecting.
        Updates system prompt, greeting, tools, and LLM model.
        """
        old_name = self._bot_config.get("name", "current bot")
        new_name = bot_config.get("name", "new bot")
        logger.info("🔄 Switching bot: %s → %s (session=%s)", old_name, new_name, self.session.session_id[:8])

        self._bot_config = bot_config
        self._bot_id = bot_config.get("id")
        self._guardrail_policy = parse_json_dict(bot_config.get("guardrail_policy"))
        self._data_access_policy = parse_json_dict(bot_config.get("data_access_policy"))
        self._conversation_policy = parse_json_dict(bot_config.get("conversation_policy"))
        self._agent_task_spec = parse_agent_task_spec(bot_config.get("agent_task_spec"))
        self._injection_detector = None
        if injection_enabled(self._guardrail_policy):
            self._injection_detector = InjectionDetector(threshold=injection_threshold(self._guardrail_policy))
        self._apply_conversation_policy_derived()

        # Load Workflow Engine if applicable
        if bot_config.get("workflow_id") and self.db:
            wf_data = await self.db.get_workflow(bot_config["workflow_id"])
            if wf_data:
                from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
                self.workflow_engine = WorkflowEngine(self, wf_data)
                logger.info("Swapped active generic workflow to: %s", wf_data.get("name"))
            else:
                self.workflow_engine = None
        else:
            self.workflow_engine = None

        # Reload tools for new bot
        self._tools = self._register_tools()
        # Optionally update LLM model
        if bot_config.get("llm_model") and self.llm:
            self.llm.model = bot_config["llm_model"]

        # Announce the switch
        greeting = bot_config.get("greeting") or f"Hello! I'm {new_name}. How can I help you?"
        await self._stream_text_to_tts(greeting, time.time())
        if self._on_bot_transcript:
            await self._on_bot_transcript(greeting, True)
        

        self.session.add_turn(TurnRole.ASSISTANT, greeting)
        if self.db:
            await self.db.log_turn(self.session.session_id, "assistant", greeting,
                                   metadata={"event": "bot_switch", "new_bot": new_name})
        await self._set_state(BotState.LISTENING)

    # ─── Cleanup ─────────────────────────────────────────────────────────

    async def _hydrate_session(self) -> None:
        """Load previous conversation history from Redis into the active session."""
        if not self.memory:
            return
        
        logger.info("Hydrating session history from Redis... (session=%s)", self.session.session_id[:8])
        history = await self.memory.get_history(self.session.session_id)
        for msg in history:
            role = TurnRole.USER if msg["role"] == "user" else TurnRole.ASSISTANT
            self.session.add_turn(role, msg["content"])
        
        if history:
            logger.info("Loaded %d messages from history", len(history))

    async def cleanup(self) -> None:
        """Clean up resources when the session ends."""
        if self._silence_timer:
            self._silence_timer.cancel()
        if self._proactive_timer:
            self._proactive_timer.cancel()
        if self._inactivity_timer:
            self._inactivity_timer.cancel()
        if self._current_task:
            self._current_task.cancel()
        self.session.is_active = False

        # Mark session as ended in SQLite
        if self.db:
            try:
                # Actual metrics for the session
                stats = {
                    "tokens_input": getattr(self, "_session_tokens_input", 0),
                    "tokens_output": getattr(self, "_session_tokens_output", 0),
                    "tokens_total": getattr(self, "_session_tokens_total", 0),
                    "tool_success_rate": self._calculate_tool_success_rate(),
                }
                await self.db.close_session(self.session.session_id, turn_count=self._turn_count, metadata=stats)
            except Exception:
                pass

        logger.info("Brain cleanup complete — session=%s", self.session.session_id[:8])

    # ─── Logic Helpers (Delegated to TurnDetector) ───────────────────

    def _strip_technical_artifacts(self, text: str) -> str:
        """Strip technical hallucinations like <function> tags or raw JSON from spoken text."""
        import re
        if not text: return ""
        # 1. Strip <function> tags and their contents
        text = re.sub(r'<function.*?>.*?</function>', '', text, flags=re.DOTALL)
        # 2. Strip leftover JSON-like blocks
        text = re.sub(r'\{[^{}]*?"[^{}]*?":.*?\}(?!\s*<)', '', text, flags=re.DOTALL | re.MULTILINE)
        return text.strip()

    # ─── Inactivity Management ─────────────────────────────────────────

    def _reset_inactivity_timer(self) -> None:
        """Reset the inactivity disconnect timer (duration from bot_config or settings)."""
        self._stop_inactivity_timer()
        # Only arm the timer while waiting for the user to speak
        if self.state == BotState.LISTENING:
            self._inactivity_timer = asyncio.create_task(self._inactivity_timeout_task())

    def _stop_inactivity_timer(self) -> None:
        """Cancel any running inactivity timer."""
        if self._inactivity_timer:
            self._inactivity_timer.cancel()
            self._inactivity_timer = None

    async def _inactivity_timeout_task(self) -> None:
        """Disconnect session after _inactivity_timeout_secs of silence."""
        try:
            await asyncio.sleep(self._inactivity_timeout_secs)
            if self.state == BotState.LISTENING:
                logger.info(
                    "🚫 Inactivity timeout (%ds) triggered for session %s",
                    self._inactivity_timeout_secs,
                    self.session.session_id[:8],
                )
                await self._log_event(
                    "[SYSTEM]",
                    f"Disconnecting: {self._inactivity_timeout_secs}s of silence detected.",
                    "text-red-400",
                )
                if self._on_voice_session_end:
                    await self._on_voice_session_end("inactivity_timeout")
        except asyncio.CancelledError:
            pass

    def _calculate_tool_success_rate(self) -> float:
        """Calculate the percentage of successful tool executions in this session."""
        total = getattr(self, "_total_tool_calls", 0)
        if total == 0:
            return 100.0  # Perfect by default if no tools used
        failed = getattr(self, "_failed_tool_calls", 0)
        return round(((total - failed) / total) * 100.0, 1)

    def _on_tool_started(self, name: str) -> None:
        """Internal hook to track tool usage frequency."""
        setattr(self, "_total_tool_calls", getattr(self, "_total_tool_calls", 0) + 1)

    def _on_tool_failed(self, name: str) -> None:
        """Internal hook to track tool failure rates for precision metrics."""
        setattr(self, "_failed_tool_calls", getattr(self, "_failed_tool_calls", 0) + 1)

    # Heuristic for verbal nods (moved to TurnDetector)

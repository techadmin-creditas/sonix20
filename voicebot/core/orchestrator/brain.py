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
import random
import re
import time
import logging
from enum import Enum
from typing import Any, Awaitable, Callable, List, Optional

# ─── Constants ────────────────────────────────────────────────────────

# Ordered from longest to shortest so longer prefixes are matched first.
# These are suspicious suffixes that may be the start of a hallucination tag.
_SUSPICIOUS_PREFIXES: tuple[str, ...] = (
    "<function=", "(function=",
    "```json", "```", "[TOOL:",
    "<function", "<functio", "<functi", "<funct", "<func", "<fun", "<fu", "<f", "<",
)


def _suspicious_prefix_length(text: str) -> int:
    """Return the length of a suspicious suffix at the end of `text`, or 0 if clean."""
    for prefix in _SUSPICIOUS_PREFIXES:
        for length in range(len(prefix), 0, -1):
            if text.endswith(prefix[:length]):
                return length
    return 0

# ─── Dynamic Response Pools (To prevent robotic repetition) ────────────────
_COMMITMENT_PROMPTS = {
    "extract_commitment": (
        "Did the user just make a commitment, promise, or clear statement of intent?\n"
        "A commitment is any definite statement about what they WILL do, WANT, or have AGREED to.\n"
        "NOT a commitment: questions, greetings, filler words ('okay', 'haan'), passive statements.\n"
        "{few_shots}"
        "User said: \"{text}\"\n\n"
        "If a commitment exists, reply with ONLY the commitment as one short sentence (max 15 words).\n"
        "If no commitment, reply with exactly: NONE"
    ),
    "check_contradiction": (
        "Prior commitments made by the user in this call:\n{commitments}\n\n"
        "{few_shots}"
        "User just said: \"{text}\"\n\n"
        "Does the user's current statement directly contradict or walk back any prior commitment?\n"
        "Clarifying questions, partial information, or unrelated statements are NOT contradictions.\n\n"
        "If YES — reply in this exact format:\n"
        "CONTRADICTION: <prior commitment text> | <what they are now saying>\n\n"
        "If NO contradiction — reply with exactly: NONE"
    ),
}

_DYNAMIC_RESPONSES = {
    "low_confidence_reprompt": {
        "en": [
            "I didn't quite catch that. Could you say that again?",
            "Sorry, I missed that. Can you please repeat it?",
            "I'm sorry, I didn't hear you clearly. Could you say that once more?",
            "Excuse me, I missed the last part. What was that?"
        ],
        "hi": [
            "Maaf kijiye, main sun nahi paaya. Kya aap phir se kahenge?",
            "Sorry, mujhe samajh nahi aaya. Ek baar phir bolenge?",
            "Kshama kijiye, main sun nahi saka. Dobara bol sakte hain?",
            "Aapki awaaz thodi kat gayi thi. Phir se batayiye?"
        ]
    },
    "sentiment_escalation": {
        "en": [
            "I can hear this is frustrating. Let me connect you with a team member who can help you directly.",
            "I understand your frustration. I'm transferring you to a senior advisor now.",
            "I'm sorry this is difficult. Let me get a specialist on the line for you.",
            "I want to make sure you get the right help. Let me connect you with one of our managers."
        ],
        "hi": [
            "Main samajh sakta hoon ki aap pareshaan hain. Main aapki baat apne senior se karwata hoon.",
            "Maaf kijiye, main aapko senior advisor se connect kar raha hoon jo isme behtar madad kar sakein.",
            "Main aapka frustration samajh sakta hoon. Line par rahiye, main call transfer kar raha hoon.",
            "Main chahta hoon aapki poori madad ho. Main call senior team member ko de raha hoon."
        ]
    },
    "topic_violation": {
        "en": [
            "I am specialized in {topic}. Is there something related to that I can help with?",
            "Actually, I'm only trained to assist with {topic} right now. Any questions on that?",
            "I'm here to help with {topic}. Let's stick to that for now, if that's okay.",
            "My expertise is limited to {topic}. Happy to help you with that!"
        ],
        "hi": [
            "Main abhi sirf {topic} mein madad kar sakta hoon. Kya aap is baare mein kuch poochna chahein?",
            "Kshama kijiye, main sirf {topic} par baat kar sakta hoon.",
            "Mera kaam sirf {topic} se juda hai. Kya main isme aapki koi madad karoon?",
            "Main filhaal sirf {topic} ke liye trained hoon. Is par baat karte hain."
        ]
    },
    "security_block": {
        "en": [
            "I'm sorry, I can't process that request.",
            "I am unable to perform that action for security reasons.",
            "That request goes beyond what I'm allowed to do.",
            "I'm unable to fulfill that specific request."
        ],
        "hi": [
            "Maaf kijiye, main yeh nahi kar sakta.",
            "Suraksha kaarno se main yeh request poori nahi kar sakta.",
            "Kshama kijiye, yeh mere adhikaar kshetra se bahar hai.",
            "Main is request ko poora karne mein asamarth hoon."
        ]
    },
    "topic_violation": {
        "en": [
            "I am specialized in {topic}. Is there something related to that I can help with?",
            "Actually, I'm only trained to assist with {topic} right now. Any questions on that?",
            "I'm here to help with {topic}. Let's stick to that for now, if that's okay.",
            "My expertise is limited to {topic}. Happy to help you with that!"
        ],
        "hi": [
            "Main abhi sirf {topic} mein madad kar sakta hoon. Kya aap is baare mein kuch poochna chahein?",
            "Kshama kijiye, main sirf {topic} par baat kar sakta hoon.",
            "Mera kaam sirf {topic} se juda hai. Kya main isme aapki koi madad karoon?",
            "Main filhaal sirf {topic} ke liye trained hoon. Is par baat karte hain."
        ]
    },
}
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
from voicebot.core.guardrails import RuleEngine, GuardrailRule, RuleScope
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


def _merge_stt_final_with_partial(last_interim: str, final_text: str) -> str:
    """
    Deepgram sometimes emits a short final that is only a suffix of the last interim
    (e.g. partial 'हाँ बोल रहा हूँ' vs final 'रहा हूँ।'). Prefer the fuller interim when
    the final is clearly contained at the end of the interim.
    """
    part = (last_interim or "").strip()
    fin = (final_text or "").strip()
    if not fin:
        return part
    if not part or len(part) <= len(fin):
        return fin

    def _norm(s: str) -> str:
        return re.sub(r"[\s।.?!,;:'\"\-]+", "", s.casefold())

    pn, fn = _norm(part), _norm(fin)
    if not fn:
        return fin
    if pn.endswith(fn):
        return part
    if fn in pn and len(pn) >= len(fn) + 2:
        return part
    return fin

# Latency bridge phrases (watchdog). Override via conversation_policy.latency_fillers or bot_config.
_LATENCY_FILLERS_EN_DEFAULT = (
    "One moment please.",
    "Just a second.",
    "Let me check that for you.",
    "Bear with me.",
    "Alright, one moment.",
    "Hmm, give me a moment.",
)
_LATENCY_FILLERS_EN_QUESTION = (
    "Let me look that up.",
    "Good question — one moment.",
    "Let me find that for you.",
)
_LATENCY_FILLERS_EN_ACK = (
    "Got it — one moment.",
    "Thanks — let me check.",
    "Okay, just a second.",
)
_LATENCY_FILLERS_EN_FRUSTRATION = (
    "I understand — let me help with that.",
    "Sorry about the wait — one moment.",
    "Let me sort that out for you.",
)
_LATENCY_FILLERS_HI_DEFAULT = (
    "Ek second, main check karta hoon.",
    "Thoda wait kijiye.",
    "Bas ek moment...",
    "Theek hai, abhi dekh raha hoon.",
    "Ek minute, please.",
    "Haan, bas ek second.",
)
_LATENCY_FILLERS_HI_QUESTION = (
    "Achha, yeh dekh leta hoon.",
    "Theek hai, main check karta hoon.",
    "Ek second, main dekh raha hoon.",
)
_LATENCY_FILLERS_HI_ACK = (
    "Theek hai, ek second.",
    "Samajh gaya, bas ek moment.",
    "Ji, abhi check karta hoon.",
)
_LATENCY_FILLERS_HI_FRUSTRATION = (
    "Main samajhta hoon — ek second.",
    "Theek hai, main madad karta hoon.",
    "Bas ek moment, dekh leta hoon.",
)

_SCOPE_TOOL_NAMES = {
    "knowledge": ("search_knowledge",),
    "appointments": ("book_appointment", "get_appointments"),
    "user_memory": ("remember_user_fact",),
    "weather": ("get_weather",),
    "banking": ("verify_customer", "get_account_balance", "get_loan_status"),
}

# 🧠 SELF-LEARNING: Post-Call Reflection Prompt
_POST_CALL_REFLECTION_PROMPT = """
You are a Senior Conversation Analyst. Your goal is to review a voice conversation and extract deep insights for future use.

### ANALYSIS GOALS:
1.  **USER FACTS**: Identify specific facts about the user (preferences, account details mentioned, constraints, personality traits).
2.  **SUCCESSFUL TACTICS**: Identify specifically what the bot did that worked well (e.g., "Used a calm tone during frustration," "Offered a discount").
3.  **SUMMARY**: A concise 1-2 sentence summary of the call outcome.
4.  **CONFIDENCE**: For each fact/tactic, provide a confidence score between 0.0 and 1.0.

### OUTPUT FORMAT (JSON ONLY):
{{
    "user_facts": [{{"fact": "...", "confidence": 0.95}}, ...],
    "successful_tactics": [{{"tactic": "...", "confidence": 0.8}}, ...],
    "outcome_summary": "Summary text..."
}}

### CONVERSATION TRANSCRIPT:
{transcript}
"""


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
        self._vector_memory = None
        self.db = db_handler
        self._bot_config = bot_config or {}
        
        self.state = BotState.LISTENING
        self._last_state_change_time = 0.0 # Grace period tracking
        self._last_emitted_transcript = "" # Deduplication for UI
        self._last_speech_stop_time = time.time()  # Track latency
        
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
        self._persona_id: Optional[str] = self._bot_config.get("persona_id")
        
        # ⏱️ PHASE 6: Turn & Task Management
        # Tracks the active 'thinking' or 'speaking' task to allow immediate cancellation on barge-in.
        self._current_turn_task: Optional[asyncio.Task] = None
        self._filler_fired_this_turn = False
        self._last_latency_filler: str = ""
        self._guardrail_policy: dict = parse_json_dict(self._bot_config.get("guardrail_policy"))
        self._data_access_policy: dict = parse_json_dict(self._bot_config.get("data_access_policy"))
        self._conversation_policy: dict = parse_json_dict(self._bot_config.get("conversation_policy"))
        self._agent_task_spec: dict = parse_agent_task_spec(self._bot_config.get("agent_task_spec"))
        self._topic_restriction: Optional[str] = self._bot_config.get("topic_restriction")
        self._refuse_off_topic: bool = bool(self._bot_config.get("refuse_off_topic", 0))

        # 🛡️ Universal Rule Engine — Generic Guardrails
        rules_data = self._guardrail_policy.get("rules", [])
        try:
            rules = [GuardrailRule(**r) for r in rules_data] if isinstance(rules_data, list) else []
            self.rule_engine = RuleEngine(rules=rules, bot_id=str(self._bot_id))
            logger.info("🛡️ Guardrail Engine initialized with %d rules for bot %s", len(rules), self._bot_id)
        except Exception as e:
            logger.error("Failed to parse guardrail rules for bot %s: %s", self._bot_id, e)
            self.rule_engine = RuleEngine(rules=[], bot_id=str(self._bot_id))

        # Phase 2: Logic (Speculative Intent)
        from voicebot.core.orchestrator.task_manager import TaskCancellationManager
        self.task_manager = TaskCancellationManager()

        # [GEMINI-GRADE] Initialize TurnDetector with bot-specific policies
        self.turn_detector = TurnDetector(
            min_silence_ms=float(self._conversation_policy.get("silence_threshold_ms", 500)),
            max_silence_ms=float(self._conversation_policy.get("max_silence_threshold_ms", 1500)),
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
        self._enable_rag: bool = bool(self._bot_config.get("enable_rag", 0))
        logger.info("🧠 Brain: RAG (Knowledge Base) is %s", "ENABLED" if self._enable_rag else "DISABLED")

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
        self._pending_latency_watchdogs: list[asyncio.Task] = []
        self._llm_static_prompt_cache: dict[str, str] = {}
        self._sentiment_sidecar_llm_loaded: bool = False
        self._sentiment_sidecar_llm: Any = None

        # ── Ultra-low-latency pipeline state ──────────────────────────────────
        # Stored reference to the running TTS consumer task so handle_interruption()
        # can cancel it immediately without waiting for the next chunk boundary.
        self._active_tts_consumer_task: Optional[asyncio.Task] = None
        # Timestamp of the current turn start, set in _process_user_turn() and
        # used in _emit_tts_audio_stream() to compute true end-to-end TTFS.
        self._turn_start_ref: float = 0.0
        # Configurable barge-in timing — loaded from conversation_policy in
        # _apply_conversation_policy_derived(); defaults match plan targets.
        self._barge_in_grace_ms: int = 300
        self._barge_in_debounce_ms: int = 100
        # Ultra-early TTS flush: fire synthesis after first N chars (word boundary).
        self._ultra_first_segment_chars: int = 8

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
        self._tool_instances: dict[str, Any] = {}
        self._tools = self._register_tools()

        # Latency tracking
        self._turn_start_time: float = 0.0
        self._turn_count: int = 0
        # User turns that passed STT confidence gate (for proactive_after_user_turns)
        self._completed_user_turns: int = 0
        self._last_stt_partial_monotonic: float = 0.0
        
        # Extensible dynamic node workflow
        self.workflow_engine = None

    def _get_dynamic_response(self, category: str, **kwargs) -> str:
        """Picks a random, non-repeating human-like response based on session language."""
        user_lang = self.session.detected_language or "en"
        lang_key = "hi" if ("hi" in user_lang.lower() or user_lang.lower().startswith("hi")) else "en"
        
        pool = _DYNAMIC_RESPONSES.get(category, {}).get(lang_key, [])
        if not pool:
            return "..." # Ultimate fallback

        # Prevent immediate repetition
        history_key = f"_last_{category}"
        last_used = getattr(self, history_key, "")
        
        choices = [phrase for phrase in pool if phrase != last_used]
        if not choices:
            choices = pool # Fallback if pool is too small

        selected = random.choice(choices)
        
        # Inject dynamic variables like {topic}
        try:
            selected = selected.format(**kwargs)
        except KeyError:
            pass

        setattr(self, history_key, selected)
        return selected

    def _apply_conversation_policy_derived(self) -> None:
        """Load timing, TTS chunking, and streaming options from conversation_policy."""
        pol = self._conversation_policy
        try:
            # Default to 500ms for a snappy production experience.
            st = float(pol.get("silence_threshold_ms", 500))
            self._silence_threshold_ms = st if 300 <= st <= 2000 else 500.0
        except (TypeError, ValueError):
            self._silence_threshold_ms = 500.0

        try:
            # Maximum silence before forced submission (safety watchdog).
            # Lowered from 1500 to 1200 for a snappier banking-grade response.
            self._max_silence_threshold_ms = float(pol.get("max_silence_threshold_ms", 1200))
        except (TypeError, ValueError):
            self._max_silence_threshold_ms = 1200.0
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
        try:
            self._proactive_silence_sec = float(pol.get("proactive_silence_sec", 30) or 30)
            self._proactive_silence_sec = max(5.0, min(120.0, self._proactive_silence_sec))
        except (TypeError, ValueError):
            self._proactive_silence_sec = 30.0
        try:
            # Default 5s grace so bot doesn't prompt immediately after speaking
            self._proactive_grace_after_bot_sec = float(pol.get("proactive_grace_after_bot_sec", 5) or 5)
            self._proactive_grace_after_bot_sec = max(0.0, min(120.0, self._proactive_grace_after_bot_sec))
        except (TypeError, ValueError):
            self._proactive_grace_after_bot_sec = 5.0
        try:
            self._proactive_after_user_turns = int(pol.get("proactive_after_user_turns", 0) or 0)
            self._proactive_after_user_turns = max(0, min(50, self._proactive_after_user_turns))
        except (TypeError, ValueError):
            self._proactive_after_user_turns = 0
        try:
            # Raise to 1.2s so fast Groq responses (400-800ms TTFT) don't get swamped by the filler
            _w = float(pol.get("llm_latency_watchdog_sec", 1.2) or 1.2)
            self._llm_latency_watchdog_sec = max(0.5, min(5.0, _w))
        except (TypeError, ValueError):
            self._llm_latency_watchdog_sec = 1.2

        # ── Barge-in timing (conversation_policy takes priority over bot_config) ──
        try:
            _grace = (
                pol.get("barge_in_grace_period_ms")
                or (self._bot_config or {}).get("barge_in_grace_period_ms")
                or 300
            )
            self._barge_in_grace_ms = max(100, min(2000, int(_grace)))
        except (TypeError, ValueError):
            self._barge_in_grace_ms = 300

        try:
            _deb = (
                pol.get("barge_in_debounce_ms")
                or (self._bot_config or {}).get("barge_in_debounce_ms")
                or 100
            )
            self._barge_in_debounce_ms = max(50, min(800, int(_deb)))
        except (TypeError, ValueError):
            self._barge_in_debounce_ms = 100

        # ── Ultra-early TTS first-word flush ─────────────────────────────────
        try:
            _ultra = (
                pol.get("ultra_first_segment_chars")
                or (self._bot_config or {}).get("ultra_first_segment_chars")
                or 8
            )
            self._ultra_first_segment_chars = max(4, min(30, int(_ultra)))
        except (TypeError, ValueError):
            self._ultra_first_segment_chars = 8

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
        
        # ⏱️ PHASE 4: Reset STT silence track on listening state entry
        if new_state == BotState.LISTENING:
            self._last_utterance_end_time = time.time()
        
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
            
            # Flush Deepgram's buffer only if finishing a turn NORMALLY (not interrupted).
            # If interrupted, the user is mid-speech and we don't want to inject silence.
            is_interruption = self._interrupt_event.is_set()
            if self.stt and not is_interruption:
                if hasattr(self.stt, "flush_endpoint"):
                    await self.stt.flush_endpoint()
            
            # Always reset VAD buffers on state entry
            if self.stt and hasattr(self.stt, "reset_buffer"):
                self.stt.reset_buffer()
            elif self.stt and hasattr(self.stt, "reset_vad"):
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

    async def _handle_fatal_error(self, error: Exception, context: str = "internal_error") -> None:
        """
        Broadcasting a technical error to the user and terminating the session gracefully.
        Triggered on STT, LLM, or core orchestration failures.
        """
        logger.error("🚫 FATAL ERROR [%s]: %s", context, error, exc_info=True)
        
        # Clean technical gibberish for the user
        raw_reason = str(error)
        friendly_msg = f"Sorry, I encountered a technical error: {raw_reason[:120]}"
        
        if "Model NotFound" in raw_reason or "model_not_found" in raw_reason:
            friendly_msg = "Configuration Error: The selected model is not available for this provider. Please check your bot settings."
        elif "API Key invalid" in raw_reason or "invalid_api_key" in raw_reason:
            friendly_msg = "Authentication Error: The API key for this provider is invalid or a placeholder. Please check your .env file."
        
        # 1. Notify the user via transcript
        if self._on_bot_transcript:
            await self._on_bot_transcript(friendly_msg, True)
            
        # 2. Log the event in the UI terminal
        await self._log_event("[FATAL]", f"An error occurred ({context}). Terminating session.", "text-red-500")
        
        # 3. Disconnect call/session/socket
        if self._on_voice_session_end:
            await self._on_voice_session_end(context)
        
        # 4. Final state transition
        await self._set_state(BotState.LISTENING)
        await self.cleanup()

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
        """Provide a mission-critical context hint to the LLM about the current state/workflow."""
        parts = []

        # 0. Dynamic Call Mission — Injected when agent_task_spec defines a call purpose.
        if self._agent_task_spec:
            call_purpose = (self._agent_task_spec.get("call_purpose") or "").strip()
            
            # Dynamically determine if this is an inbound or outbound bot (default to outbound)
            call_direction = (self._bot_config.get("call_direction") or "outbound").lower()
            
            # Pull all captured workflow facts generically
            _wf_data = getattr(getattr(self, "workflow_engine", None), "session_data", {}) or {}
            captured_facts = ", ".join(
                f"{k}={str(v)[:50]}"
                for k, v in _wf_data.items()
                if not str(k).startswith("_") and v and str(v) not in ("NONE", "None", "")
            )
            
            mission_line = call_purpose or "Pursue the core objective."
            facts_line = f" Known facts: {captured_facts}." if captured_facts else ""
            direction_header = f"CALL MISSION — {call_direction.upper()} CALL"
            
            if call_direction == "outbound":
                direction_instructions = (
                    "You initiated this call. YOU have the agenda — the customer did NOT call for help.\n"
                    "NEVER ask 'how can I help you' or 'what do you need'.\n"
                    "When the user prompts you to speak (e.g., 'Yes?', 'Tell me', 'Haan bolo', 'Who is this?'), "
                    "treat it as an INVITATION to state your purpose. Do it immediately and confidently."
                )
            else:
                direction_instructions = (
                    "The user initiated this call. You are here to assist them with their inquiries while "
                    "efficiently guiding them toward the call's ultimate objective."
                )

            parts.append(
                f"\n\n[{direction_header}]\n"
                f"Purpose: {mission_line}{facts_line}\n"
                f"{direction_instructions}\n"
                "Stay on mission. If the user goes off-topic, acknowledge briefly and pivot back to the objective."
            )

        # 1. Workflow engine state — current node objective
        if hasattr(self, "workflow_engine") and self.workflow_engine:
            wf_status = self.workflow_engine.get_context_status()
            parts.append(f"\n\n[WORKFLOW STATE: {wf_status}]")
            parts.append(
                "\nINSTRUCTION: Stay on the CURRENT TASK. "
                "Conversational affirmations ('tell me', 'okay', 'bataiye') mean CONTINUE — not an off-topic question. "
                "Continue with the task directly."
            )

        # Language consistency — enforce matching the user's live detected language
        lang = self.session.detected_language or "en"
        if lang in ("hi", "hi-IN", "hi-in"):
            parts.append(
                "\n[LANGUAGE RULE] User is speaking Hindi/Hinglish. "
                "ALWAYS respond in natural Hinglish — mix Hindi and English as bilingual speakers naturally do. "
                "Never switch to pure English unless the user explicitly switches first."
            )

        # 2. Add Agent Task Spec hints (Call Phase / Objection Round)
        if self._agent_task_spec:
            meta = self.session.metadata
            phase = meta.get("call_phase")
            if phase:
                parts.append(f"\n[Session hint: call_phase={phase}")
                if meta.get("user_stance"):
                    parts.append(f", user_stance={meta.get('user_stance')}")
                if meta.get("objection_round") is not None:
                    parts.append(f", objection_round={meta.get('objection_round')}")
                parts.append("]")
                
                if phase == "handle_objection":
                    parts.append(" Respond with empathy; offer one alternative angle; stay polite.")
                elif phase == "closing":
                    parts.append(" User exit conditions met: give a brief polite goodbye.")

        return "".join(parts)

    # ─── Audio Input Handling ────────────────────────────────────────────

    async def tick_stt_keepalive_wall(self) -> None:
        """Deepgram JSON KeepAlive on wall-clock (see main.py EnergyGate + net0001)."""
        stt = self.stt
        if stt is not None and hasattr(stt, "keepalive_wallclock_if_due"):
            await stt.keepalive_wallclock_if_due()

    def _should_schedule_proactive_timer(self) -> bool:
        # Never schedule the proactive timer on the very first boot (before user has spoken once)
        # This prevents the "Are you there?" prompt interrupting the greeting flow
        return self._completed_user_turns >= max(1, self._proactive_after_user_turns)

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

    async def process_stt_partial(self, text: str, is_final: bool, suppress_transcript: bool = False, **kwargs: Any) -> None:
        """
        Handle a partial or final transcript from STT.
        """
        try:
            msg_type = kwargs.get("msg_type")
            
            # --- TERMINAL ERROR HANDLER ---
            if msg_type == "terminal_error":
                error_msg = kwargs.get("error", "Unknown STT Error")
                logger.error("🛑 STT Terminal Error signaled: %s", error_msg)
                await self._handle_fatal_error(VoiceBotError(error_msg), context="stt_terminal_error")
                return

            # Track VAD timing locally to assist with barge-in decision logic
            if msg_type == "speech_started":
                self._last_vad_signal_time = time.time()

            confidence = kwargs.get("confidence", 1.0)
            
            # [DEDUPLICATION] Deepgram sometimes sends duplicate Finals if the connection is slow.
            if is_final and text.strip() and text.strip() == getattr(self, "_last_processed_text", ""):
                 time_since_processed = time.time() - getattr(self, "_last_processed_time", 0.0)
                 if time_since_processed < 5.0:  # Ignore identical finals within 5s
                     logger.debug("🧠 Brain STT Filter: ignoring duplicate final transcript '%s'", text.strip())
                     return

            # [GEMINI-GRADE] Noise & Hallucination Filter
            if text.strip() and len(text.strip()) < 2 and not is_final and confidence < 0.5:
                 logger.debug("🧠 Hallucination Filter: dropping short token '%s' (conf=%.2f)", text.strip(), confidence)
                 return

            # Skip empty finals ONLY if we have no buffered text (otherwise we need it to reset the watchdog)
            buffer_has_text = bool((getattr(self, "_utterance_buffer", "") or "").strip() or (getattr(self, "_partial_buffer", "") or "").strip())
            if is_final and not text.strip() and not buffer_has_text:
                logger.debug("🧠 Noise Filter: skipping empty final transcript")
                return

            logger.info("🧠 Brain STT Ingested: '%s' [final=%s, type=%s, state=%s]", text, is_final, msg_type, self.state.value)

            # Handle interruptions with a configurable debounce (default 350 ms).
            # We now allow interruptions during SPEAKING and (optionally) PROCESSING.
            _barge_in_enabled = bool(self._bot_config.get("enable_barge_in", True))
            
            if msg_type == "speech_started" and _barge_in_enabled:
                # 🛡️ SILENCE TIMER PROTECTION: If we already have a full sentence in the buffer (is_final),
                # do NOT cancel the silence timer for a new 'speech_started' signal unless we actually
                # see new text coming in. This prevents background noise from "resetting" the turn
                # and leaving the bot in a silent hanging state.
                has_pending_final = bool(self._utterance_buffer.strip())
                
                if self._silence_timer:
                    if has_pending_final:
                        logger.debug("🧠 STT Noise Filter: speech_started received but buffer has content. Keeping silence timer.")
                    else:
                        logger.debug("🧠 STT Signal: User speaking, cancelling silence timer.")
                        self._silence_timer.cancel()
                        self._silence_timer = None

                # 🚀 PRODUCTION: Always allow interruption during SPEAKING or PROCESSING
                # to achieve human-like responsiveness.
                if self.state in (BotState.SPEAKING, BotState.PROCESSING):
                    # Post-turn guard window: ignore interruptions very early to prevent
                    # self-interruption from late STT fragments / echo.
                    # Value from conversation_policy (set in _apply_conversation_policy_derived).
                    _elapsed = (time.time() - self._last_state_change_time) * 1000
                    if _elapsed < self._barge_in_grace_ms:
                        logger.debug("🧠 Barge-in Ignored: Within post-turn guard window (%.0fms < %dms)", _elapsed, self._barge_in_grace_ms)
                        return

                    # Signal the frontend to MUTE audio playback instantly
                    if self._on_audio_interrupt:
                        await self._on_audio_interrupt()

                    # Short confirmation window — distinguishes real speech from single noise burst.
                    await asyncio.sleep(self._barge_in_debounce_ms / 1000.0)
                    
                    if self.state in (BotState.SPEAKING, BotState.PROCESSING):
                        snapshot = (self._partial_buffer or text).strip()
                        
                        # 🛡️ LATENCY FIX: Extended Grace Window
                        # If the STT endpoint triggered a VAD signal but hasn't returned text yet, 
                        # hold the mute state for an extra 300ms to allow the network to catch up.
                        if not snapshot:
                            logger.debug("🧠 Barge-in: VAD triggered but text is empty. Holding mute for 300ms grace window...")
                            await asyncio.sleep(0.3)
                            # Re-fetch the snapshot after waiting
                            snapshot = (self._partial_buffer or text).strip()
                            
                        # If STILL no text after the extended wait, it was just a noise burst. Resume playback.
                        if not snapshot:
                            logger.info("🧠 Barge-in Suppressed: No text arrived during extended grace window. Resuming.")
                            if self._on_audio_resume:
                                await self._on_audio_resume()
                            return
                        
                        # 🛡️ New meaningful barge-in check (Deduplication + Backchannel)
                        if not self.turn_detector.is_meaningful_barge_in(snapshot, self._last_processed_text):
                            logger.info("🧠 Barge-in Suppressed: Non-meaningful or duplicate found ('%s')", snapshot)
                            self.session.false_interruption_count += 1
                            if self._on_audio_resume:
                                await self._on_audio_resume()
                            return

                        await self.handle_interruption()
                    else:
                        self.session.false_interruption_count += 1
                        if self._on_audio_resume:
                            await self._on_audio_resume()
                        self._barge_in_buffer = ""
                    return


            # If speaking/processing, capture transcripts into the barge-in buffer.
            # If speaking/processing, capture transcripts into the barge-in buffer.
            if self.state in (BotState.SPEAKING, BotState.PROCESSING):
                if text.strip():
                    # 🛡️ DEDUPLICATION: Ignore late fragments of the turn we just finished.
                    if self.turn_detector.is_likely_duplicate(text, self._last_processed_text):
                        logger.debug("🧠 Barge-in Junk Filter: skipping late fragment '%s'", text.strip())
                        return

                    _clean_text = text.strip()
                    # Secondary prefix trimming for cumulative streams
                    if self._last_processed_text and _clean_text.lower().startswith(self._last_processed_text.lower()[:10]):
                        _clean_text = _clean_text[len(self._last_processed_text):].strip()
                    
                    if not _clean_text:
                        return
                    
                    self._partial_buffer = _clean_text
                    
                    if is_final:
                        sep = " " if self._barge_in_buffer else ""
                        self._barge_in_buffer = (self._barge_in_buffer + sep + _clean_text).strip()
                        logger.debug("Captured barge-in text (cleaned): '%s'", self._barge_in_buffer)
                return


            # Language Detection Module logic: Update session language if detected with high confidence
            stt_lang = kwargs.get("language")
            if stt_lang and stt_lang != self.session.detected_language:
                # We only switch if it's a stable signal
                logger.debug("Language Detection: Detected '%s' (current: '%s')", stt_lang, self.session.detected_language)
                self.session.detected_language = stt_lang

            # Update partial buffer
            _should_emit = False
            if text.strip():
                self._reset_inactivity_timer()
                
                # 🛡️ UI NOISE FILTER: Only emit to UI if the text is new OR final.
                _should_emit = is_final or text != getattr(self, "_last_emitted_transcript", "")
                
                # --- Anticipation Module ---
                if not is_final and len(text.split()) > 2:
                    asyncio.create_task(self._predictive_prewarm(text))

                _prior_interim = (self._partial_buffer or "").strip()
                self._partial_buffer = text
                if not is_final:
                    self._last_stt_partial_monotonic = time.monotonic()

                if is_final:
                    final_t = text.strip()
                    chosen = _merge_stt_final_with_partial(_prior_interim, final_t)
                    if chosen != final_t:
                        logger.info(
                            "STT: kept fuller interim over short final (interim_len=%d final_len=%d)",
                            len(_prior_interim),
                            len(final_t),
                        )
                    sep = " " if self._utterance_buffer else ""
                    self._utterance_buffer = (self._utterance_buffer + sep + chosen).strip()

            # Notify client (with deduplication)
            if self._on_transcript and _should_emit and not suppress_transcript:
                self._last_emitted_transcript = text
                await self._on_transcript(text, is_final)



            # Store STT confidence for low-confidence graceful recovery
            incoming_confidence = kwargs.get("confidence")
            if incoming_confidence is not None:
                self._last_stt_confidence = float(incoming_confidence)

            if text.strip():
                # ⏱️ STT latency: time from last non-final partial to this final (avoids bogus multi-second RTT
                # when Deepgram delivers a late duplicate final after a long gap).
                if is_final:
                    _now_m = time.monotonic()
                    _partial_m = float(getattr(self, "_last_stt_partial_monotonic", 0.0) or 0.0)
                    if _partial_m > 0 and (_now_m - _partial_m) < 30.0:
                        stt_rtt = (_now_m - _partial_m) * 1000.0
                    else:
                        stt_rtt = (time.time() - self._last_speech_stop_time) * 1000
                    logger.info("📊 STT Latency: %.0f ms [Final Received]", stt_rtt)
                    self.session.last_stt_latency_ms = stt_rtt
                    self._last_stt_partial_monotonic = 0.0
                else:
                     # On every partial, we 'bump' the speech stop time to the NOW
                     # until the user actually stops speaking.
                     self._last_speech_stop_time = time.time()
                
                self._last_utterance_end_time = time.time()
                if is_final:
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
        except Exception as e:
            await self._handle_fatal_error(e, "stt_processing_failed")

    async def _wait_for_silence(self, initial_threshold_ms: float) -> None:
        """
        Wait for silence and periodically re-evaluate if the user's turn is complete.
        This provides a reliable "Watchdog" that fires even for low-confidence utterances
        (like numbers or brief nods) once enough silence is detected.
        """
        try:
            # ── Step 1: Initial Wait ──
            await asyncio.sleep(initial_threshold_ms / 1000.0)
            
            # ── Step 2: Reliable Watchdog Loop ──
            # We poll until either the turn is deemed complete or the global max threshold is reached.
            total_waited_ms = initial_threshold_ms
            poll_interval_ms = 250.0  # Periodic checks for snappy response
            
            while True:
                # Basic sanity checks before each poll
                if self.state != BotState.LISTENING:
                    logger.debug("🧠 Silence Loop: State changed to %s. Aborting.", self.state)
                    return
                
                transcript = (self._utterance_buffer or self._partial_buffer).strip()
                if not transcript:
                    return

                # Proceed with turn completion logic even if text matches last processed (e.g. repeated user command)
                # Deduplication is already handled at the STT ingestion layer.

                # Calculate actual elapsed silence since the last STT activity
                actual_silence_ms = total_waited_ms
                if self._last_utterance_end_time > 0:
                     actual_silence_ms = (time.time() - self._last_utterance_end_time) * 1000

                # ── Determination A: Hard Watchdog (Full timeout) ──
                # If silence exceeds our global limit (e.g. 2s), FORCE-SUBMIT.
                if actual_silence_ms >= self._max_silence_threshold_ms:
                    logger.info("🧠 Watchdog Triggered: Force-submitting turn after %.1fs silence", actual_silence_ms/1000)
                    break

                # ── Determination B: Semantic Re-evaluation ──
                # Let the TurnDetector decide if linguistic + silence score is sufficient.
                is_complete = self.turn_detector.is_turn_complete(
                    transcript, actual_silence_ms
                )
                
                if is_complete:
                    logger.debug("🧠 Silence Loop: Turn complete semantically at %dms", actual_silence_ms)
                    break
                
                # ── Determination C: No Progress ──
                # If not complete, sleep for another short window and try again.
                await asyncio.sleep(poll_interval_ms / 1000.0)
                total_waited_ms += poll_interval_ms


            # Silence threshold reached — user has finished speaking
            logger.info(
                "Turn complete (silence detected): threshold=%.0fms, transcript='%s'",
                initial_threshold_ms,
                transcript[:50],
            )
            self.session.is_user_speaking = False

            # Cancel proactive timer since user just spoke
            if self._proactive_timer:
                self._proactive_timer.cancel()
                self._proactive_timer = None

            # After the turn, start the proactive silence timer
            # Track this text to prevent repeated debounce resets on the same content
            self._last_processed_text = transcript

            # ⏱️ PHASE 6: Track turn task for cancellation
            self._current_turn_task = asyncio.create_task(self._process_user_turn(transcript))
            
            # Helper to clear task on completion
            def _clear_task(_):
                if self._current_turn_task == _:
                    self._current_turn_task = None
            self._current_turn_task.add_done_callback(_clear_task)

            # After the turn, start the proactive silence timer (if policy allows)
            if self._should_schedule_proactive_timer():
                self._proactive_timer = asyncio.create_task(self._proactive_silence_check())

        except asyncio.CancelledError:
            # More speech arrived — timer was reset
            pass

    async def _proactive_silence_check(self) -> None:
        """If user is silent (policy: proactive_silence_sec) after bot speech, prompt."""
        try:
            if self._proactive_grace_after_bot_sec > 0:
                await asyncio.sleep(self._proactive_grace_after_bot_sec)
            await asyncio.sleep(self._proactive_silence_sec)
            # 🛡️ SAFETY CHECK: Don't prompt if there is pending user speech in the buffer
            # That the turn_detector is actively evaluating!
            if (self._utterance_buffer + self._partial_buffer).strip():
                logger.debug("Proactive silence: user spoke recently but turn not finalized. Skipping prompt.")
                return

            if self.state == BotState.LISTENING:
                logger.info(
                    "Proactive silence: user quiet for %.0fs (grace=%.0fs), prompting...",
                    self._proactive_silence_sec,
                    self._proactive_grace_after_bot_sec,
                )
                proactive_messages = self._bot_config.get("proactive_prompts", [])
                if not proactive_messages:
                    lang = self.session.detected_language or "hi"
                    _style = str(
                        self._conversation_policy.get("language_style")
                        or self._bot_config.get("language_style")
                        or ""
                    ).lower().strip()
                    if _style == "hinglish":
                        proactive_messages = [
                            "Hello, aap line par hain? Agar kuch chahiye ho to bataiye.",
                            "Main yahi hoon — jab aap ready hon, bol dijiye.",
                            "Take your time, main sun raha hoon.",
                        ]
                    elif "hi" in lang.lower():
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
                # The full speculative LLM call (below) handles the deeper optimization.
                break

        # 🚀 SPECULATIVE EXECUTION: If user says 4+ words with high confidence,
        # pre-warm the LLM connection NOW — before the final transcript arrives.
        # This overlaps the STT finalization gap (~400ms) with LLM connection setup.
        # We only do client pre-warming (not a full call) to avoid wasted tokens.
        if confidence >= 0.5 and len(words) >= 4:
            if hasattr(self.llm, "_get_client"):
                asyncio.create_task(self.llm._get_client())
            logger.debug("🚀 Speculative LLM prewarm triggered (%.0f%% confidence, %d words)", confidence * 100, len(words))

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

            # Structured collections briefing — shown first so LLM sees it immediately
            _structured_cats = {
                "ptp_amount", "ptp_date", "partial_payment",
                "contact_time_preference", "strategy_worked", "strategy_failed",
            }
            if ctx.get("facts"):
                structured = [
                    f for f in ctx["facts"]
                    if f.get("category", "") in _structured_cats
                ]
                if structured:
                    lines = [f"  • {f['fact']}" for f in structured[:8]]
                    parts.append("Collections briefing for this caller:\n" + "\n".join(lines))

            if ctx.get("facts"):
                general_facts = [
                    f for f in ctx["facts"]
                    if f.get("category", "") not in _structured_cats
                ]
                if general_facts:
                    facts_str = " | ".join(f["fact"] for f in general_facts[:8])
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
        Handles Workflow nodes, Static Configured Greetings, and Dynamic LLM Greetings.
        """
        logger.info("🎬 Starting conversation (session=%s)", self.session.session_id[:8])

        # Load cross-session memory for returning users before the greeting
        await self._load_cross_session_context()

        try:
            await self._set_state(BotState.PROCESSING)
            self._interrupt_event.clear()
            
            custom_greeting = self._bot_config.get("greeting") or ""

            # ── SCENARIO 1: WORKFLOW ENGINE ATTACHED ──
            if self._bot_config.get("workflow_id") and self.db:
                wf_data = await self.db.get_workflow(self._bot_config["workflow_id"])
                if wf_data:
                    from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
                    self.workflow_engine = WorkflowEngine(self, wf_data)
                    logger.info("Loaded generic workflow engine: %s", wf_data.get('name', 'Unknown'))
                    
                    # 1a. Speak the custom DB greeting if it exists (e.g. "Hello, this is X.")
                    if custom_greeting:
                        await self._generate_and_speak(custom_greeting)

                    # 1b. Kick off the workflow engine naturally
                    logger.info("🎬 Starting WorkflowEngine execution...")
                    await self.workflow_engine.evaluate("")
                    
                    # Exit out, the engine handles the state and proactive timers from here
                    return 

            # ── SCENARIO 2: STANDARD BOT (NO WORKFLOW) ──
            self.workflow_engine = None
            
            if custom_greeting:
                # Path A: We have a static greeting configured in the DB
                logger.info("Using static config greeting: %s", custom_greeting[:60])
                
                await self._generate_and_speak(custom_greeting)
                await self._set_state(BotState.LISTENING)
                
                # Log to session history since we aren't routing through the LLM
                self.session.add_turn(TurnRole.ASSISTANT, custom_greeting)
                if self.db:
                    await self.db.log_turn(self.session.session_id, "assistant", custom_greeting)
            else:
                # Path B: No static greeting, let the LLM generate one dynamically
                logger.info("No static greeting found. Generating dynamic persona greeting.")
                bot_name = self._bot_config.get("name", "Assistant")
                persona = self._bot_config.get("persona", "helpful and friendly")
                
                intro_instruction = (
                    f"You are {bot_name}, a {persona} AI assistant. "
                    f"Greet the user warmly in one sentence and invite them to speak."
                )
                await self._run_llm_turn(intro_instruction, override_system_prompt=True)

        except Exception as e:
            await self._handle_fatal_error(e, "conversation_startup_failed")

        # Proactive "still there?" — optional skip until first real user turn
        if self._should_schedule_proactive_timer():
            self._proactive_timer = asyncio.create_task(self._proactive_silence_check())

    async def _run_llm_turn(
        self,
        instruction: str = "",
        override_system_prompt: bool = False,
        cache_key: Optional[str] = None,
        _qa_question: Optional[str] = None,
        _system_prompt_override: Optional[str] = None,
    ) -> None:
        """
        Internal method to handle the LLM -> TTS flow.
        """
        turn_start = time.time()
        full_response = ""
        max_iterations = 3
        iteration = 0

        if _system_prompt_override is not None:
            system_prompt = _system_prompt_override
        else:
            system_prompt = self._build_system_prompt()
        if override_system_prompt:
            system_prompt = f"{system_prompt}\n\nINSTRUCTION: {instruction}"

        text_accumulated_whole_turn = ""
        total_turn_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        _filler_fired_this_turn = False  # Track whether watchdog filler already played
        self._force_no_tools_this_turn = False
        self._last_call_sig = None  # 🛡️ Reset loop detector for every NEW user turn

        try:
            if self.llm:
                max_iterations = 4  # Allow enough steps for (Tool 1 -> Tool 2 -> Recovery -> Response)
                while iteration < max_iterations:
                    iteration += 1
                    # 🏎️ LATENCY OPTIMIZATION: Reduce history window for voice turns (5000 char cap effectively)
                    context = self.session.get_context_window(max_turns=10)
                    if iteration == 1:
                        try:
                            # 🚀 CONTEXT COMPRESSION: Cache the serialized context to avoid
                            # repeated JSON serialization on every LLM loop iteration.
                            _ctx_hash = id(context)  # Fast identity check
                            if getattr(self, "_last_ctx_hash", None) == _ctx_hash:
                                _ctx_dump = self._last_ctx_dump
                            else:
                                _ctx_dump = json.dumps(context, default=str)
                                self._last_ctx_hash = _ctx_hash
                                self._last_ctx_dump = _ctx_dump
                        except (TypeError, ValueError):
                            _ctx_dump = str(context)
                        logger.info(
                            "LLM request profile: system_prompt_chars=%d context_chars=%d",
                            len(system_prompt),
                            len(_ctx_dump),
                        )
                    _watchdog_user_hint = ""
                    for _m in reversed(context):
                        if _m.get("role") == "user":
                            _c = (_m.get("content") or "").strip()
                            if _c:
                                _watchdog_user_hint = _c[:240]
                                break
                    tts_buffer = ""
                    # 🛡️ Loop Recovery: If tools were forced off in previous iteration, keep them off
                    current_tools = self._tools if getattr(self, "_force_no_tools_this_turn", False) is False else []
                    tool_calls_this_turn = []
                    executed_in_this_loop = set() # Track unique calls in this specific iteration

                    whole_turn = getattr(self, "_tts_streaming_mode", "chunked") == "whole_turn"
                    # 🚀 LOW-LATENCY: Use pipeline mode for chunked streaming to achieve true parallelism
                    use_pipeline = self._tts_streaming_mode == "chunked" and bool(self.tts) and not whole_turn

                    segment_q: asyncio.Queue[Optional[tuple[str, bool]]] = asyncio.Queue(maxsize=3)
                    consumer_task: Optional[asyncio.Task] = None

                    if use_pipeline:
                        consumer_task = asyncio.create_task(self._tts_queue_consumer(segment_q, turn_start))
                        self._active_tts_consumer_task = consumer_task

                    # First-sentence fast-path: use a smaller char cap (Phase 3)
                    # to achieve <300ms TTFS.
                    _first_segment_done = False
                    # Ultra-flush fires exactly ONCE per turn — initialize here,
                    # never reset inside the token loop.
                    _ultra_flush_done = False
                    # Suspicious-prefix hold: accumulate partial hallucination tags
                    # before they reach TTS. Released on next token or after timeout.
                    _held_prefix: str = ""
                    _hold_start_time: float = 0.0
                    _HOLD_TIMEOUT_SEC: float = 0.5
                    _first_seg_cap = int(
                        self._bot_config.get("first_segment_chars")
                        or self._conversation_policy.get("first_segment_chars")
                        or 15
                    )


                    # --- Latency Watchdog (Phase 4) ---
                    # Only inject filler on the FIRST LLM call of a turn.
                    # Tool-follow-up iterations (iteration > 1) skip the watchdog to avoid
                    # repeated "Ek minute" fillers during multi-step tool chains.
                    _tokens_received = False
                    _watchdog_fired = False
                    _watchdog_task: Optional[asyncio.Task] = None
                    _wd_sec = float(self._llm_latency_watchdog_sec)
                    if iteration == 1 and _wd_sec > 0:

                        async def _latency_watchdog():
                            nonlocal _tokens_received, _watchdog_fired, _filler_fired_this_turn
                            try:
                                await asyncio.sleep(_wd_sec)
                            except asyncio.CancelledError:
                                return
                            if _tokens_received:
                                return
                            if not getattr(self.session, "is_active", True):
                                return
                            if self._interrupt_event.is_set():
                                return
                            if self.state not in (BotState.PROCESSING, BotState.SPEAKING):
                                return
                            if _filler_fired_this_turn:
                                return
                            _watchdog_fired = True
                            _filler_fired_this_turn = True
                            _current_lang = (
                                self.session.detected_language or self.session.preferred_language or "hi"
                            ).lower()
                            filler = self._pick_latency_watchdog_filler(
                                _current_lang, _watchdog_user_hint
                            )

                            logger.info(
                                "🧠 Watchdog: LLM slow (>%dms), injecting filler: '%s' (lang=%s)",
                                int(_wd_sec * 1000),
                                filler,
                                _current_lang,
                            )
                            self.session.add_turn(TurnRole.ASSISTANT, filler)
                            await self._emit_tts_audio_stream(filler, turbo=True)

                        _watchdog_task = asyncio.create_task(_latency_watchdog())
                        self._register_latency_watchdog_task(_watchdog_task)

                    try:
                        async with async_timeout.timeout(30.0):
                            async for chunk in self.llm.stream_completion(
                                system_prompt=system_prompt,
                                messages=context,
                                tools=current_tools,
                                temperature=self._bot_config.get("temperature"),
                                max_tokens=self._bot_config.get("max_tokens"),
                                ttft_timeout=1.5,  # 🛡️ If primary is slow, switch to Groq before watchdog fires
                            ):
                                if not _tokens_received:
                                    _tokens_received = True
                                    # ⏱️ PHASE 4: LLM TTFT Measurement (First Token)
                                    # Measure time from request start to first content chunk.
                                    if iteration == 1:
                                        self.session.last_llm_latency_ms = (time.time() - turn_start) * 1000
                                        logger.info("📊 LLM TTFT: %.2fms", self.session.last_llm_latency_ms)

                                    if _watchdog_task and not _watchdog_task.done():
                                        _watchdog_task.cancel()
                                        try:
                                            await _watchdog_task
                                        except asyncio.CancelledError:
                                            pass
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
                                
                                if chunk.content:
                                    text_accumulated_whole_turn += chunk.content
                                    tts_buffer += chunk.content

                                    # 🛡️ SUSPICIOUS-PREFIX HOLD (Layer 1 real-time detection)
                                    # Hold TTS flush when tts_buffer tail looks like a partial hallucination tag.
                                    # This prevents "<function=verify_cu" from being spoken before the tag is complete.
                                    if not whole_turn and self.tts:
                                        # Step 1: Resolve any held prefix from the previous token
                                        if _held_prefix:
                                            if (time.time() - _hold_start_time) >= _HOLD_TIMEOUT_SEC:
                                                # Timeout: strip whatever we accumulated and release
                                                tts_buffer = self._strip_technical_artifacts(_held_prefix + tts_buffer)
                                                _held_prefix = ""
                                            else:
                                                combined = _held_prefix + tts_buffer
                                                stripped = self._strip_technical_artifacts(combined)
                                                if stripped != combined or not _suspicious_prefix_length(combined):
                                                    # Resolved: tag completed and stripped, or proven clean
                                                    tts_buffer = stripped
                                                    _held_prefix = ""
                                                else:
                                                    # Still suspicious: keep accumulating, suppress tts_buffer
                                                    _held_prefix = combined
                                                    tts_buffer = ""
                                        # Step 2: Check if current buffer tail is now suspicious
                                        if not _held_prefix:
                                            suspicious_len = _suspicious_prefix_length(tts_buffer)
                                            if suspicious_len > 0:
                                                _held_prefix = tts_buffer[-suspicious_len:]
                                                tts_buffer = tts_buffer[:-suspicious_len]
                                                _hold_start_time = time.time()

                                    if not whole_turn and self.tts:
                                        # 🏁 ULTRA-FLUSH (Phase 3): Fire TTS after first ~2 words (on word boundary)
                                        # to achieve <300ms time-to-first-speech, beating sentence completion.
                                        if not _ultra_flush_done and len(tts_buffer) >= self._ultra_first_segment_chars:
                                            if tts_buffer[-1] in " .!?,;:":  # Word boundary detected
                                                safe_text, block_meta = await self._guard_tts_segment(tts_buffer)
                                                if not block_meta and safe_text:
                                                    if use_pipeline:
                                                        await segment_q.put((safe_text, True))  # is_first=True
                                                    else:
                                                        await self._emit_tts_audio_stream(safe_text)
                                                    tts_buffer = ""
                                                    _ultra_flush_done = True
                                                    _first_segment_done = True
                                                continue

                                        # First segment: use smaller cap for faster first audio
                                        flush_cap = _first_seg_cap if not _first_segment_done else self._max_tts_buffer_chars
                                        if self.turn_detector.is_sentence_boundary(tts_buffer, char_cap=flush_cap, mode=self._tts_flush_mode):
                                            safe_tts_text, block_meta = await self._guard_tts_segment(tts_buffer)
                                            if block_meta:
                                                logger.warning("🚫 Output Guardrail BLOCKED mid-stream (rule=%s)", block_meta.get("rule_id"))
                                                self._interrupt_event.set()
                                                if self._on_audio_interrupt: await self._on_audio_interrupt()
                                                # Inject custom rejection message from the rule metadata
                                                _block_msg = block_meta.get("message", "I'm sorry, I cannot provide that information.")
                                                await self._emit_tts_audio_stream(_block_msg, turbo=True)
                                                return

                                            if safe_tts_text:
                                                if use_pipeline and segment_q is not None:
                                                    await segment_q.put((safe_tts_text, not _first_segment_done))
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

                        # 🛡️ End-of-stream: release any held prefix (strip tags, then flush)
                        if _held_prefix:
                            tts_buffer = self._strip_technical_artifacts(_held_prefix + tts_buffer)
                            _held_prefix = ""

                        if self._interrupt_event.is_set():
                            pass
                        elif whole_turn and tts_buffer.strip() and self.tts:
                            safe_final, block_meta = await self._guard_tts_segment(tts_buffer)
                            if block_meta:
                                await self._emit_tts_audio_stream(block_meta.get("message", "I'm sorry, I cannot provide that information."), turbo=True)
                            elif safe_final:
                                await self._emit_tts_audio_stream(safe_final)
                        elif not whole_turn and tts_buffer.strip() and self.tts and not self._interrupt_event.is_set():
                            safe_tail, block_meta = await self._guard_tts_segment(tts_buffer)
                            if block_meta:
                                await self._emit_tts_audio_stream(block_meta.get("message", "I'm sorry, I cannot provide that information."), turbo=True)
                            elif safe_tail:
                                if use_pipeline and segment_q is not None:
                                    await segment_q.put((safe_tail, not _first_segment_done))
                                else:
                                    await self._emit_tts_audio_stream(safe_tail)
                            if self._on_bot_transcript:
                                await self._on_bot_transcript(text_accumulated_whole_turn, False)

                    finally:
                        if _watchdog_task is not None and not _watchdog_task.done():
                            _watchdog_task.cancel()
                            try:
                                await _watchdog_task
                            except asyncio.CancelledError:
                                pass
                        if use_pipeline and segment_q is not None and consumer_task is not None:
                            await segment_q.put(None)  # Goodbye sentinel
                            if self._interrupt_event.is_set():
                                # 📡 IMMEDIATE CANCEL: Don't wait for current segment to finish
                                consumer_task.cancel()
                            try:
                                await consumer_task
                            except asyncio.CancelledError:
                                pass
                            finally:
                                if self._active_tts_consumer_task is consumer_task:
                                    self._active_tts_consumer_task = None

                    # 🛡️ RESILIENCE: Hallucination Recovery
                    # If LLM didn't use native tool-calls API, but wrote <function> tags in text,
                    # recover them and trigger the execution pipeline manually.
                    if not tool_calls_this_turn and text_accumulated_whole_turn:
                        extracted = self._extract_hallucinated_tool_calls(text_accumulated_whole_turn)
                        if extracted:
                            tool_calls_this_turn.extend(extracted)
                            logger.warning("🧠 [HALLUCINATION] Recovered %d call(s) (session=%s)", len(extracted), self.session.session_id[:8])
                            await self._log_event("[PLAN]", f"Recovered {len(extracted)} hallucinated tool calls", "text-yellow-400")
                            self._hallucination_count_this_session = getattr(self, "_hallucination_count_this_session", 0) + len(extracted)
                            if self._on_metrics:
                                asyncio.create_task(self._on_metrics({
                                    "type": "hallucination_recovered",
                                    "count": len(extracted),
                                    "session_total": self._hallucination_count_this_session,
                                }))

                    if self._interrupt_event.is_set():
                        break

                    if tool_calls_this_turn:
                        # 1. 🛡️ Record the Assistant Turn with Tool Calls (Phase 5: Structured Context)
                        # This turns the history into:
                        # assistant: {content: "...", tool_calls: [...]}
                        # tool: {tool_call_id: "...", content: "..."}
                        # This matches OpenAI/Groq/Gemini expectations perfectly.
                        self.session.add_turn(
                            TurnRole.ASSISTANT, 
                            content=text_accumulated_whole_turn or None,
                            tool_calls=[tc.model_dump() for tc in tool_calls_this_turn]
                        )
                        if self.memory:
                            await self.memory.add_history(
                                self.session.session_id,
                                {
                                    "role": "assistant",
                                    "content": text_accumulated_whole_turn or None,
                                    "tool_calls": [tc.model_dump() for tc in tool_calls_this_turn]
                                }
                            )

                        # Prevent infinite loops if LLM repeats same tool calls
                        call_sig = "|".join([f"{tc.name}:{tc.arguments}" for tc in tool_calls_this_turn])
                        if getattr(self, "_last_call_sig", None) == call_sig:
                            logger.warning("🧠 Detect tool-call loop. Forcing dynamic conversation recovery.")
                            # 1. Strip tools and force a SPEAKING iteration
                            self._force_no_tools_this_turn = True
                            self._last_call_sig = None 
                            # 2. Inject a system hint to the context
                            self.session.add_turn(TurnRole.SYSTEM, 
                                "CRITICAL_LOOP: You are repeating tool calls. STOP calling tools and directly ask "
                                "the user to clarify their information clearly."
                            )
                            continue 
                        self._last_call_sig = call_sig

                        # 🔄 Cross-turn loop detection (A→B→A cycle across user turns)
                        if iteration == 1:
                            if not hasattr(self, "_cross_turn_call_history"):
                                self._cross_turn_call_history: list[str] = []
                            self._cross_turn_call_history.append(call_sig)
                            if len(self._cross_turn_call_history) > 6:
                                self._cross_turn_call_history.pop(0)
                            if len(self._cross_turn_call_history) >= 3:
                                if self._cross_turn_call_history[-1] == self._cross_turn_call_history[-3]:
                                    logger.warning("🔄 [HALLUCINATION] Cross-turn tool loop detected — forcing no-tools recovery")
                                    self._force_no_tools_this_turn = True
                                    self._last_call_sig = None
                                    self.session.add_turn(TurnRole.SYSTEM,
                                        "CROSS_TURN_LOOP: You are cycling through the same tool calls across turns. "
                                        "Stop calling tools and respond directly to the user."
                                    )
                                    continue

                        # 2. Execute and Record Results
                        tool_results = await self._execute_tools(tool_calls_this_turn)
                        for res in tool_results:
                            self.session.add_turn(
                                TurnRole.TOOL, 
                                content=res.content,
                                tool_call_id=res.tool_call_id
                            )
                            if self.memory:
                                await self.memory.add_history(
                                    self.session.session_id,
                                    {
                                        "role": "tool",
                                        "content": res.content,
                                        "tool_call_id": res.tool_call_id
                                    },
                                )
                        if self.session.voice_session_end_requested:
                            break
                        
                        # Reset accumulators for next iteration (follow-up response)
                        # Phase 5: Ensure old text doesn't bleed into the next follow-up LLM prompt
                        text_accumulated_whole_turn = "" 
                        tool_calls_this_turn = []
                        continue
                    break


        except (WebSocketDisconnect, ClientDisconnected) as e:
            logger.info("📡 Client disconnected during turn (session=%s). Stopping generation.", self.session.session_id[:8])
            self._interrupt_event.set()
            raise e
        except Exception as e:
            await self._handle_fatal_error(e, "llm_generation_failed")
        finally:
            if not getattr(self.session, "is_active", True):
                return
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

    async def _tts_queue_consumer(self, q: asyncio.Queue, turn_start: float) -> None:
        """
        Consumes TTS segments from the LLM producer queue and streams audio.
        Runs concurrently with the LLM loop — achieves overlapping synthesis.
        Uses a 30s timeout per item to prevent hanging if producer crashes
        without sending the sentinel (None).
        """
        try:
            while True:
                if self._interrupt_event.is_set():
                    return
                try:
                    item = await asyncio.wait_for(q.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    logger.warning("TTS consumer: 30s queue timeout — exiting")
                    return
                if item is None:
                    return
                if self._interrupt_event.is_set():
                    return
                text, _is_first = item
                await self._emit_tts_audio_stream(text)
        except asyncio.CancelledError:
            pass

    async def _background_topic_check(self, text: str, topic: str) -> None:
        """
        Performs topic relevance check off the critical path.
        If user goes off-topic, it triggers an interruption to the bot's current turn.
        """
        try:
            is_on_topic = await self._check_topic_relevance(text, topic)
            if not is_on_topic and self.state in (BotState.PROCESSING, BotState.SPEAKING):
                logger.warning("🧠 Async Topic Guardrail: User went off-topic mid-reply. Triggering interruption.")
                self._interrupt_event.set()
                if self._on_audio_interrupt:
                    await self._on_audio_interrupt()
                # 📡 Kill active TTS to unblock immediate refusal
                if self._active_tts_consumer_task and not self._active_tts_consumer_task.done():
                    self._active_tts_consumer_task.cancel()
                if self.tts and hasattr(self.tts, "reset"):
                    await self.tts.reset()
                
                # Immediate refusal — beats the rest of the current turn's LLM generation
                await asyncio.sleep(0.05) # Yield to allow cancel to propagate
                msg = self._get_dynamic_response("topic_violation", topic=topic)
                await self._generate_and_speak(msg)
        except asyncio.CancelledError:
            pass  # Normal closure when turn completes on-topic
        except Exception as e:
            logger.debug("Background topic check suppressed error: %s", e)

    async def _generate_and_speak(self, text: str) -> None:
        """Speak fixed text (workflows, rejection messages). Logs assistant turn via _finalize_turn."""
        try:
            # 1. Resolve variables [Placeholders]
            t = self._inject_variables(text or "")
            # 2. Cleanup artifacts
            t = self._strip_technical_artifacts(t)
            if not t:
                return
            if self.output_guard:
                t = self.output_guard.validate_and_mask(t)["masked_text"]
            
            turn_start = time.time()
            self._interrupt_event.clear()
            await self._stream_text_to_tts(t, turn_start)
            await self._finalize_turn(t, turn_start)
        except Exception as e:
            await self._handle_fatal_error(e, "tts_reply_failed")

    def _inject_variables(self, text: str) -> str:
        """Replace [Variable Name] placeholders from session data, metadata, mappings, or bot defaults."""
        if not text: return ""
        
        import re
        # 1. Gather all data sources
        metadata = getattr(self.session, "metadata", {}) if self.session else {}
        # Also check WorkflowEngine's local session_data if available
        workflow_data = {}
        if hasattr(self, "workflow_engine") and self.workflow_engine:
            workflow_data = getattr(self.workflow_engine, "session_data", {})
            
        bot_cfg = self._bot_config or {}
        mappings = bot_cfg.get("variable_mappings", {})
        defaults = bot_cfg.get("metadata_defaults", {})
        
        # Merge sources for lookup
        combined = {**workflow_data, **metadata}
        # Create a normalized lowercase map for fuzzy matching
        lowercase_map = {str(k).lower(): v for k, v in combined.items()}
        
        # Regex to find [Bracked Variables]
        pattern = re.compile(r'\[(.*?)\]')
        
        def _repl(match):
            key = match.group(1).strip()
            key_low = key.lower()
            bracketed_key = f"[{key}]"
            
            # Helper to check if a value is actually another key
            def _resolve_pointer(v):
                if v is None: return None
                if isinstance(v, str):
                    # Check if v is a key in our combined data
                    v_low = v.lower()
                    if v in combined:
                        rp_v = combined[v]
                        return str(rp_v) if rp_v is not None else None
                    if v_low in lowercase_map:
                        rp_v = lowercase_map[v_low]
                        return str(rp_v) if rp_v is not None else None
                return str(v)

            # A. Check explicit mappings
            mapped_key = mappings.get(bracketed_key) or mappings.get(key)
            if mapped_key:
                val = combined.get(mapped_key)
                if val is not None: return _resolve_pointer(val)
                
            # B. Direct Match (Case Sensitive)
            if key in combined:
                val = _resolve_pointer(combined[key])
                if val is not None: return val
            if bracketed_key in combined:
                val = _resolve_pointer(combined[bracketed_key])
                if val is not None: return val
            
            # C. Loose Match (Case Insensitive)
            if key_low in lowercase_map:
                val = _resolve_pointer(lowercase_map[key_low])
                if val is not None: return val
            
            # D. Snake Case Match (e.g. "Customer Name" -> "customer_name")
            sc_key = key_low.replace(" ", "_").replace("-", "_")
            if sc_key in lowercase_map:
                val = _resolve_pointer(lowercase_map[sc_key])
                if val is not None: return val
            
            # E. Check bot config defaults
            val = defaults.get(bracketed_key) or defaults.get(key) or \
                  defaults.get(sc_key) or bot_cfg.get(sc_key)
            if val is not None: return _resolve_pointer(val)
            
            # F. Special Dynamic variables
            if key_low in ("date", "today"):
                import datetime
                return datetime.date.today().strftime("%d %B %Y")
            
            # G. Fallback to original
            return match.group(0)
            
        return pattern.sub(_repl, text)

    async def _process_user_turn(self, user_text: str) -> None:
        try:
            self._reset_inactivity_timer()
            await self._set_state(BotState.PROCESSING)
            self._interrupt_event.clear()
            self._last_call_sig = None  # Reset tool-loop tracking for new turn
            self._barge_in_buffer = ""  # Clear any leftover barge-in content from previous turn
            self.session.is_interrupted = False  # Reset for telemetry auditing

            turn_start = time.time()
            self._turn_start_ref = turn_start
            self.session.last_llm_latency_ms = 0 # ⬅️ Reset for every turn
            self._is_fast_track_turn = False      # ⬅️ New flag for telemetry
            
            # ⏱️ PHASE 4: STT Latency Measurement
            # Time from Deepgram's final transcript arrival to Brain turn trigger.
            if hasattr(self, "_last_utterance_end_time") and self._last_utterance_end_time > 0:
                self.session.last_stt_latency_ms = (turn_start - self._last_utterance_end_time) * 1000
                logger.debug("📊 STT Latency: %.2fms", self.session.last_stt_latency_ms)

            # ── Step 0: STT confidence check — ask for clarification on noisy input ──
            _min_confidence = float(
                self._bot_config.get("min_stt_confidence")
                or self._conversation_policy.get("min_stt_confidence")
                or 0.5
            )
            _word_count = len(user_text.split())
            _is_common = user_text.lower().strip("?.! ,") in ("hello", "hi", "ok", "okay", "theek hai", "haan", "theek", "yes", "ji")
            
            if _word_count <= 2 and self._last_stt_confidence < _min_confidence and not _is_common:
                logger.info(
                    "Low STT confidence (%.2f < %.2f) on short utterance '%s' — asking for repeat",
                    self._last_stt_confidence, _min_confidence, user_text,
                )
                await self._set_state(BotState.LISTENING)
                # -> NEW DYNAMIC REPROMPT
                reprompt = self._get_dynamic_response("low_confidence_reprompt")
                await self._generate_and_speak(reprompt)
                return

            self._completed_user_turns += 1

            # ── Step 1: Universal Guardrail & Rule Engine check ──
            await self._log_event("[BRAIN]", "Screening input (Safety & Policy)...", "text-indigo-400")
            safe_text, block_action = await self.rule_engine.apply_policies(user_text, RuleScope.INPUT)
            
            if block_action:
                logger.warning("🚫 Guardrail BLOCK triggered (bot=%s, rule=%s)", self._bot_id, block_action["rule_id"])
                # Log the attempted turn for analytics
                self.session.add_turn(TurnRole.USER, user_text)
                if self.db: await self.db.log_turn(self.session.session_id, "user", user_text)
                self._turn_count += 1
                
                # Speak the rejection message and reset state
                await self._set_state(BotState.LISTENING)
                await self._generate_and_speak(block_action["message"])
                return

            if safe_text != user_text:
                logger.info("🛡️ Input Sanitized (Guardrail MASK applied)")

            # Use safe_text for all subsequent checks
            current_text = safe_text

            # ── Step 1.4: Injection Detector ──
            if self._injection_detector:
                inj = self._injection_detector.check(current_text)
                if inj["detected"] and self._guardrail_policy.get("injection_action", "log") == "block":
                    # -> NEW DYNAMIC SECURITY BLOCK
                    msg = self._guardrail_policy.get("injection_block_message") or self._get_dynamic_response("security_block")
                    logger.warning("Injection block (session=%s)", self.session.session_id[:8])
                    self.session.add_turn(TurnRole.USER, current_text)
                    if self.memory:
                        await self.memory.add_history(
                            self.session.session_id, {"role": "user", "content": current_text}
                        )
                    if self.db:
                        await self.db.log_turn(self.session.session_id, "user", current_text)
                    self._turn_count += 1
                    await self._generate_and_speak(msg)
                    return
            
            # ── Step 1.5: Topic Guardrail Check ──
            _topic_check_task: Optional[asyncio.Task] = None
            if self._topic_restriction and self._refuse_off_topic:
                if bool(self._conversation_policy.get("topic_check_async", True)):
                    # 🚀 LOW-LATENCY: Run topic check in parallel with LLM prep
                    _topic_check_task = asyncio.create_task(
                        self._background_topic_check(current_text, self._topic_restriction)
                    )
                else:
                    # Legacy blocking path (opt-in via topic_check_async: false)
                    await self._log_event("[BRAIN]", f"Verifying topic relevance for '{self._topic_restriction}'...", "text-indigo-400")
                    is_on_topic = await self._check_topic_relevance(current_text, self._topic_restriction)
                    if not is_on_topic:
                        # -> NEW DYNAMIC TOPIC BLOCK
                        msg = self._get_dynamic_response("topic_violation", topic=self._topic_restriction)
                        logger.warning("Topic guardrail triggered (session=%s)", self.session.session_id[:8])
                        self.session.add_turn(TurnRole.USER, current_text)
                        if self.memory:
                            await self.memory.add_history(self.session.session_id, {"role": "user", "content": current_text})
                        if self.db:
                            await self.db.log_turn(self.session.session_id, "user", current_text)
                        self._turn_count += 1
                        await self._generate_and_speak(msg)
                        return
            # ── Step 2: Update conversation history & Workflow Analysis ──
            self._last_processed_text = current_text
            self._last_processed_time = time.time()
            self._utterance_buffer = ""
            self._partial_buffer = ""
            
            self.session.add_turn(TurnRole.USER, current_text)
            if self.memory:
                await self.memory.add_history(self.session.session_id, {"role": "user", "content": current_text})
            if self.db:
                await self.db.log_turn(self.session.session_id, "user", current_text)
            self._turn_count += 1
            self._update_task_phase_from_user_text(current_text)

            # Parallel background tasks (fire-and-forget, non-critical path)
            asyncio.create_task(self._analyze_and_emit_sentiment(current_text))
            if self.session.user_id or self.session.session_id:
                asyncio.create_task(self._extract_and_store_entities(current_text))

            # Commitment intelligence — parallel, bounded 250ms before LLM starts
            # Both tasks write to session.metadata so they must complete before _build_system_prompt()
            _commit_tasks = [
                asyncio.create_task(self._extract_commitment(current_text)),
                asyncio.create_task(self._check_commitment_contradiction(current_text)),
            ]
            try:
                await asyncio.wait(_commit_tasks, timeout=0.25)
            except Exception:
                pass  # Voice pipeline proceeds regardless

            # ── Step 2.1: Dynamic Workflow Execution ──
            if self.workflow_engine:
                logger.info("Evaluating text via WorkflowEngine...")
                yield_to_llm = await self.workflow_engine.evaluate(safe_text)
                if not yield_to_llm:
                    self._is_fast_track_turn = True  # ⬅️ Successfully bypassed main Voice LLM
                    self.session.is_bot_speaking = False
                    self._partial_buffer = ""
                    self._utterance_buffer = ""
                    self._turn_start_time = 0.0
                    if not self._interrupt_event.is_set():
                        await self._set_state(BotState.LISTENING)
                    return

            # ── Phase 2: Parallel Pre-processing (RAG + Cache) ──
            logger.info("Phase 2: Parallel pre-processing (RAG + Cache)...")

            system_prompt_snapshot = self._build_system_prompt()

            async def _get_rag():
                if self._enable_rag and hasattr(self, "_vector_memory") and self._vector_memory:
                    try:
                        return await self._vector_memory.retrieve_context(
                            query=safe_text, user_id=self.session.user_id, top_k=3
                        )
                    except Exception as e:
                        logger.debug("RAG error: %s", e)
                return None

            async def _get_cache():
                context = self.session.get_context_window(max_turns=10)
                ctx_serialized = json.dumps(context, sort_keys=True, default=str)
                cache_key_local = hashlib.md5(
                    f"{system_prompt_snapshot}:{ctx_serialized}:{safe_text}".encode()
                ).hexdigest()
                if self.memory:
                    try:
                        return cache_key_local, await self.memory.get_cache(cache_key_local)
                    except Exception:
                        pass
                return cache_key_local, None

            rag_task = asyncio.create_task(_get_rag())
            cache_task = asyncio.create_task(_get_cache())
            rag_results, (cache_key, cached_response) = await asyncio.gather(rag_task, cache_task)

            # Handle Cache Hit
            if cached_response:
                logger.info("⚡ Semantic Cache Hit!")
                await self._log_event("[METRIC]", "Semantic Cache HIT", "text-green-400")
                await self._stream_text_to_tts(cached_response, turn_start)
                await self._finalize_turn(cached_response, turn_start)
                return

            # Handle RAG Injection
            if rag_results:
                rag_snippets = "\n".join(f"- {r['document']}" for r in rag_results if r.get("document"))
                if rag_snippets:
                    self.session.add_turn(TurnRole.SYSTEM, f"[Relevant past context]\n{rag_snippets}")

            # ── Step 2.6: QA cache lookup ──
            if self._enable_rag and self._vector_memory and getattr(self._vector_memory, "_available", False):
                try:
                    _qa_hit = await self._vector_memory.lookup_qa(bot_id=str(self._bot_id), question=safe_text)
                    if _qa_hit:
                        await self._log_event("[METRIC]", "QA Semantic Cache HIT", "text-green-400")
                        await self._stream_text_to_tts(_qa_hit, turn_start)
                        await self._finalize_turn(_qa_hit, turn_start, cache_key=cache_key, _qa_question=safe_text)
                        return
                except Exception: pass

            # ── Step 3: Run the LLM main turn ──
            logger.info("📡 Starting Agentic Turn (session=%s)...", self.session.session_id[:8])
            await self._run_llm_turn(
                cache_key=cache_key,
                _qa_question=safe_text,
                _system_prompt_override=system_prompt_snapshot,
            )
        except Exception as e:
            await self._handle_fatal_error(e, "user_turn_processing_failed")
        finally:
            # 🛡️ CLEANUP: Always cancel the off-critical-path check if it's still running
            if _topic_check_task and not _topic_check_task.done():
                _topic_check_task.cancel()

    async def _analyze_and_emit_sentiment(self, text: str) -> None:
        """
        Classify sentiment of the user's utterance and emit a WebSocket event.

        Runs as a background task — must NOT block the voice pipeline.

        Resolution order (fastest first, no main LLM):
          1. Keyword regex — zero cost, handles the majority of clear-cut cases
          2. Workflow engine's _classify_sentiment (uses classifier LLM, not main voice LLM)
          3. Small Groq sidecar (llama-3.1-8b-instant) when no workflow engine and GROQ_API_KEY is set
          4. Neutral if no classifier is available
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
                else:
                    # Small Groq sidecar — never contend with the main voice LLM quota.
                    label = await self._sentiment_classify_with_sidecar(text)

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
                # -> NEW DYNAMIC ESCALATION
                msg = self._get_dynamic_response("sentiment_escalation")
                await self._generate_and_speak(msg)

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

    # ─── Commitment Intelligence (Self-Learning) ──────────────────────────────

    async def _load_commitment_few_shots(self, task_type: str) -> str:
        """
        Load top-5 confirmed-correct past predictions from DB for dynamic few-shot injection.
        Returns formatted string for {few_shots} placeholder in _COMMITMENT_PROMPTS.
        Falls back to empty string if DB unavailable or no examples yet.
        """
        if not self.db or not hasattr(self.db, "get_commitment_few_shots"):
            return ""
        try:
            examples = await self.db.get_commitment_few_shots(task_type=task_type, limit=5)
            if not examples:
                return ""
            lines = ["Examples from past calls (confirmed correct):\n"]
            for ex in examples:
                lines.append(f'  Input: "{ex["input_text"][:80]}" → {ex["prediction"]}\n')
            lines.append("\n")
            return "".join(lines)
        except Exception:
            return ""

    async def _store_training_example(self, task_type: str, input_text: str, prediction: str) -> None:
        """Fire-and-forget: persist a commitment prediction for self-learning."""
        if self.db and hasattr(self.db, "save_commitment_training_example"):
            try:
                await self.db.save_commitment_training_example(
                    task_type=task_type,
                    input_text=input_text,
                    prediction=prediction,
                    session_id=self.session.session_id,
                )
            except Exception as e:
                logger.debug("Training example save failed (non-critical): %s", e)

    async def _extract_commitment(self, user_text: str) -> None:
        """
        LLM-based commitment extractor. Runs with bounded latency as part of
        parallel pre-turn tasks. Any type of commitment (amount, date, preference,
        promise) is captured as plain-English fact in session.metadata['commitments'].
        Also stores raw prediction for self-learning.
        """
        if not user_text or not user_text.strip():
            return
        few_shots = await self._load_commitment_few_shots("extract_commitment")
        prompt = _COMMITMENT_PROMPTS["extract_commitment"].format(
            text=user_text[:300], few_shots=few_shots
        )
        try:
            chunks = []
            async for chunk in self.llm.stream_completion(
                system_prompt="You are a strict commitment extractor. Reply with ONE sentence or NONE.",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=40,
            ):
                chunks.append(chunk.content or "")
            result = "".join(chunks).strip()
            label = "NONE"
            if result and result.upper() != "NONE" and len(result) > 3:
                commitments: list[dict] = self.session.metadata.setdefault("commitments", [])
                entry = {"text": result, "original": user_text[:120], "turn": self._turn_count}
                commitments.append(entry)
                label = result
                await self._log_event("[COMMITMENT]", result[:80], "text-blue-300")
            asyncio.create_task(self._store_training_example("extract_commitment", user_text[:300], label))
        except Exception as e:
            logger.debug("Commitment extraction failed (non-critical): %s", e)

    async def _check_commitment_contradiction(self, user_text: str) -> None:
        """
        LLM-based contradiction detector. Checks current utterance against
        all prior intra-call commitments. If contradiction found, sets
        session.metadata['contradiction_hint'] which is injected into the LLM
        system prompt for the current turn.
        Stores prediction for self-learning feedback loop.
        """
        commitments: list[dict] = self.session.metadata.get("commitments", [])
        # Only check against commitments from PRIOR turns (not the one being extracted now)
        prior = [c for c in commitments if c.get("turn", 0) < self._turn_count]
        if not prior or not user_text:
            self.session.metadata.pop("contradiction_hint", None)
            return

        commitment_lines = "\n".join(
            f"- (turn {c['turn']}) {c['text']}" for c in prior[-5:]
        )
        few_shots = await self._load_commitment_few_shots("check_contradiction")
        prompt = _COMMITMENT_PROMPTS["check_contradiction"].format(
            commitments=commitment_lines,
            few_shots=few_shots,
            text=user_text[:300],
        )
        try:
            chunks = []
            async for chunk in self.llm.stream_completion(
                system_prompt="You are a strict contradiction detector. Reply CONTRADICTION:... or NONE.",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=60,
            ):
                chunks.append(chunk.content or "")
            result = "".join(chunks).strip()
            if result.upper().startswith("CONTRADICTION:"):
                detail = result[len("CONTRADICTION:"):].strip()
                parts = detail.split("|", 1)
                prior_stmt = parts[0].strip() if parts else detail
                current_stmt = parts[1].strip() if len(parts) > 1 else user_text[:80]
                hint = (
                    f"INTRA-CALL CONTRADICTION: Earlier this call, the user committed: \"{prior_stmt}\". "
                    f"They are now saying: \"{current_stmt}\". "
                    f"Acknowledge this naturally and hold them to their prior statement."
                )
                self.session.metadata["contradiction_hint"] = hint
                await self._log_event("[CONTRADICTION]", f"{prior_stmt[:50]} → {current_stmt[:50]}", "text-red-400")
                asyncio.create_task(self._store_training_example(
                    "check_contradiction",
                    f"commitments: {commitment_lines[:200]} | user: {user_text[:200]}",
                    result[:200],
                ))
            else:
                self.session.metadata.pop("contradiction_hint", None)
        except Exception as e:
            logger.debug("Contradiction check failed (non-critical): %s", e)
            self.session.metadata.pop("contradiction_hint", None)

    async def _guard_tts_segment(self, raw_buffer: str) -> tuple[str, Optional[dict]]:
        """Strip and apply output guard to a TTS phrase. Returns (Masked Text, Block Metadata)"""
        t = (raw_buffer or "").strip()
        if not t:
            return "", None
            
        # [GEMINI-GRADE] Secondary Tool/JSON Stripping
        # This catches tags that were split across LLM chunks or leaked into the buffer.
        import re
        t = re.sub(r'<function.*?</function>', '', t, flags=re.DOTALL)
        t = re.sub(r'\{".*?":\s*".*?"\}', '', t)
        t = re.sub(r'<function.*?>', '', t) # Strip partial opening tags
        t = re.sub(r'.*?</function>', '', t) # Strip partial closing tags
        t = t.strip()
        
        if not t:
            return "", None

        # 🛡️ Universal Rule Engine Output Policy
        sanitized, block = await self.rule_engine.apply_policies(t, RuleScope.OUTPUT)
        return sanitized, block

    async def _emit_tts_audio_stream(self, text: str, turbo: bool = False) -> None:
        """Stream one TTS synthesis to the client; one short log per segment."""
        # 1. Resolve variables [Placeholders]
        t = self._inject_variables(text or "").strip()
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
                # 🥇 TRUE TTFS MEASUREMENT (Phase 3)
                # Compute end-to-end latency from turn start (STT final arrival) 
                # to first byte of audio output reaching the network buffer.
                if self._turn_start_ref > 0:
                    true_ttfs = (time.time() - self._turn_start_ref) * 1000
                    self.session.first_audio_latency_ms = true_ttfs
                    _provider_ttfa = (time.time() - _tts_t0) * 1000
                    
                    logger.info("⚡ TTFS %.0fms | TTS Provider %.0fms | LLM TTFT %.0fms", 
                                true_ttfs, _provider_ttfa, self.session.last_llm_latency_ms)
                    
                    if self._on_metrics:
                        # Fire non-blocking metrics event to avoid stalling the audio stream
                        asyncio.create_task(self._on_metrics({
                            "type": "ttfs",
                            "ttfs_ms": round(true_ttfs, 0),
                            "tts_provider_ms": round(_provider_ttfa, 0),
                            "llm_ttft_ms": round(self.session.last_llm_latency_ms, 0),
                        }))
                    # Reset so subsequent chunks/segments in THIS turn don't re-trigger metrics
                    self._turn_start_ref = 0
                
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
        # Anti-hallucination cleanup: Strip persistent technical artifacts before saving to history.
        clean_response = self._strip_technical_artifacts(full_response)
        
        self.session.add_turn(TurnRole.ASSISTANT, clean_response)

        if self.memory:
            await self.memory.add_history(self.session.session_id, {"role": "assistant", "content": clean_response})
            if cache_key:
                await self.memory.set_cache(cache_key, clean_response, ttl=cache_ttl_seconds)

        # Log to SQLite long-term memory
        if self.db:
            await self.db.log_turn(self.session.session_id, "assistant", clean_response)

        # ── Track total latency ──
        total_latency = (time.time() - turn_start) * 1000
        self.session.last_total_latency_ms = total_latency
        
        # 🧪 [TELEMETRY] Sentiment Score Mapping (-1 to 1)
        _sentiment_map = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}
        current_sentiment = self._sentiment_history[-1] if self._sentiment_history else "neutral"
        sentiment_score = _sentiment_map.get(current_sentiment, 0.0)

        # Audit last interrupt type: Differentiate Barge-in from Noise
        interrupt_type = "clean"
        if self.session.is_interrupted:
             interrupt_type = "barge_in"
        elif self.session.false_interruption_count > 0:
             # Basic heuristic: if we had a false interrupt this turn, let the dashboard know
             interrupt_type = "noise_filter"


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
                "sentiment_score": sentiment_score,
                "interrupt_type": interrupt_type,
                "is_fast_track": getattr(self, "_is_fast_track_turn", False), # ⬅️ New metric
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
                    completion_tokens=completion,
                    sentiment_score=sentiment_score,
                    interrupt_type=interrupt_type
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
            await self._on_bot_transcript(clean_response, True)

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

    def _merge_barge_in_utterance(self) -> str:
        """Combine finalized barge-in text with the latest partial (avoids dropping in-progress speech)."""
        b = (self._barge_in_buffer or "").strip()
        p = (self._partial_buffer or "").strip()
        if not b:
            return p
        if not p:
            return b
        bl, pl = b.lower(), p.lower()
        if pl in bl:
            return b
        if bl in pl:
            return p
        return f"{b} {p}".strip()

    def _get_sentiment_sidecar_llm(self) -> Any:
        if self._sentiment_sidecar_llm_loaded:
            return self._sentiment_sidecar_llm
        self._sentiment_sidecar_llm_loaded = True
        if settings.groq_api_key:
            from voicebot.services.llm.groq_provider import GroqStreamingProvider

            self._sentiment_sidecar_llm = GroqStreamingProvider(
                model=settings.sentiment_classifier_model,
            )
        else:
            self._sentiment_sidecar_llm = None
        return self._sentiment_sidecar_llm

    async def _sentiment_classify_with_sidecar(self, text: str) -> str:
        prov = self._get_sentiment_sidecar_llm()
        if not prov:
            return "neutral"
        prompt = (
            f'Classify the sentiment of this user utterance with ONE word: '
            f'positive, neutral, or negative.\n\nUtterance: "{text[:200]}"'
        )
        chunks: list[str] = []
        try:
            async for chunk in prov.stream_completion(
                system_prompt="You are a sentiment classifier. Reply only: positive, neutral, or negative.",
                messages=[{"role": "user", "content": prompt}],
            ):
                chunks.append(chunk.content or "")
        except Exception:
            return "neutral"
        raw = "".join(chunks).strip().lower()
        if "positive" in raw:
            return "positive"
        if "negative" in raw:
            return "negative"
        return "neutral"

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

        # Cancel the TTS consumer task immediately — do not wait for the next
        # chunk boundary inside _emit_tts_audio_stream.  This is the key change
        # that reduces TTS stop latency from ~200-400ms to <20ms.
        if self._active_tts_consumer_task and not self._active_tts_consumer_task.done():
            self._active_tts_consumer_task.cancel()

        # Notify the frontend to flush its audio queue right away.
        # if self._on_bot_transcript:
        #     await self._on_bot_transcript("Interruption", is_final=True)
                        
        if self._on_audio_interrupt:
            await self._on_audio_interrupt()

        # Cancel a pending silence timer so a ghost turn doesn't fire after the interrupt.
        if self._silence_timer:
            self._silence_timer.cancel()
            self._silence_timer = None

        # Restore any user speech captured during the barge-in debounce window.
        # Without this, short phrases ("stop", "wait", "ok") spoken while the bot
        # was talking are lost and the bot freezes in LISTENING state with no turn to fire.
        # Merge finals (_barge_in_buffer) with the latest partial so mid-utterance text is not dropped.
        self._utterance_buffer = self._merge_barge_in_utterance()
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
        """Define available tools entirely driven by Data Access Scopes."""
        # 1. Base Core Infrastructure Tools (Always On)
        enabled = {"end_voice_session"}
        
        # 2. Add Scope-Driven Business Tools
        scopes = self._data_access_policy.get("enabled_scopes", [])
        has_scopes = bool(scopes and isinstance(scopes, list))
        if has_scopes:
            for s in scopes:
                key = str(s).lower()
                for n in _SCOPE_TOOL_NAMES.get(key, ()):
                    enabled.add(n)

        # 3. Optional explicit tool list: when scopes are set, intersect so tools_enabled
        # cannot grant capabilities outside enabled_scopes (e.g. weather without "weather").
        manual_tools = self._bot_config.get("tools_enabled")
        if manual_tools and isinstance(manual_tools, list):
            manual_set = {str(x) for x in manual_tools}
            if has_scopes:
                enabled = (enabled & manual_set) | {"end_voice_session"}
            else:
                enabled.update(manual_set)
            
        # Fallback default if absolutely nothing was configured
        if len(enabled) <= 1:
            enabled.update([
                "search_knowledge", "book_appointment", "get_appointments", 
                "remember_user_fact", "get_weather"
            ])

        registered_tools = []
        for name in enabled:
            tool_cls = ToolRegistry.get_tool_class(name)
            if tool_cls:
                # We instantiate to get the definition for LLM config AND safety instructions
                tool = tool_cls()
                self._tool_instances[tool.name] = tool
                registered_tools.append(ToolDefinition(
                    name=tool.name,
                    description=tool.description,
                    parameters=tool.parameters
                ))
        return registered_tools

    async def _execute_tools(self, calls: List[ToolCall]) -> List[ToolResult]:
        """Execute tool calls — backed by real SQLite DB where applicable."""
        results = []
        # 🛡️ Global Tool Argument Normalization
        ARG_MAPPINGS = {
            "date_of_birth": "dob",
            "last_4_phone_digits": "phone_last_4",
            "account_id": "account_number",
            "customer_id": "account_number" 
        }
        for call in calls:
            # Normalize arguments before execution
            if call.arguments:
                for hallucinated, official in ARG_MAPPINGS.items():
                    if hallucinated in call.arguments:
                        call.arguments[official] = call.arguments.pop(hallucinated)

            try:
                logger.info("⚙️  Executing tool: %s with args: %s", call.name, call.arguments)
                if self._on_tool_call:
                    await self._on_tool_call(call.name, call.arguments)

                args = call.arguments
                
                # 🛡️ Global Hallucination Interceptor (Generic Dummy Value Check)
                import re
                DUMMY_PATTERNS = [
                    r"^1122$", r"^1234$", r"^0000$", r"dummy", r"test", r"placeholder",
                    r"DD-MM-YYYY", r"01-01-1990", r"lorem", r"ipsum",
                    r"account[_ -]number", r"date[_ -]of[_ -]birth", r"phone[_ -]last[_ -]4",
                    r"last_4_digits", r"awaiting_", r"unknown", r"customer_", r"user_"
                ]
                _is_hallucinated = False
                for key, val in args.items():
                    val_str = str(val).strip()
                    _tool_error_msg: Optional[str] = None

                    # 5a — String dummy patterns
                    if any(re.search(p, val_str, re.IGNORECASE) for p in DUMMY_PATTERNS):
                        _tool_error_msg = f"You provided a placeholder/dummy value '{val}' for '{key}'. You MUST NOT guess or use dummy data. Ask the user for the real information instead."

                    # 5b — Numeric dummy values (0, common test numbers)
                    elif isinstance(val, int) and val in {0, 1111, 1122, 1234, 4321, 9999}:
                        _tool_error_msg = f"You provided a placeholder numeric value '{val}' for '{key}'. Ask the user for the real value."

                    # 5c — Account number plausibility (must be 5–20 digits)
                    elif key in ("account_number", "account_id"):
                        acc_digits = re.sub(r'\D', '', str(val))
                        if not (5 <= len(acc_digits) <= 20):
                            _tool_error_msg = f"The account number '{val}' is not valid (must be 5–20 digits). Ask the user to confirm their account number."

                    # 5d — Date validity (reject future dates, pre-1900, or unparseable)
                    elif key in ("dob", "date_of_birth", "date"):
                        from datetime import datetime as _dt
                        _parsed_date = None
                        for _fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                            try:
                                _parsed_date = _dt.strptime(str(val), _fmt)
                                break
                            except ValueError:
                                continue
                        if _parsed_date is None:
                            _tool_error_msg = f"'{val}' for '{key}' is not a recognizable date. Ask the user for their date in DD-MM-YYYY format."
                        elif _parsed_date.year < 1900:
                            _tool_error_msg = f"The date '{val}' for '{key}' has an invalid year. Ask the user for the correct date."
                        elif key != "date" and _parsed_date > _dt.now():
                            _tool_error_msg = f"The date '{val}' for '{key}' is in the future, which is not valid. Ask the user for the correct date."

                    if _tool_error_msg:
                        logger.warning("🚫 Blocking hallucinated tool call: %s with dummy arg: %s=%s", call.name, key, val)
                        results.append(ToolResult(
                            tool_call_id=call.id,
                            name=call.name,
                            content=f"TOOL_ERROR: {_tool_error_msg}"
                        ))
                        _is_hallucinated = True
                        break  # Break inner loop

                if _is_hallucinated:
                    continue # Skip execution for this specific tool call

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

    def _choose_latency_filler_no_repeat(self, pool: tuple[str, ...]) -> str:
        choices = list(pool)
        if not choices:
            return "One moment."
        if len(choices) == 1:
            self._last_latency_filler = choices[0]
            return choices[0]
        last = self._last_latency_filler
        for _ in range(10):
            pick = random.choice(choices)
            if pick != last:
                self._last_latency_filler = pick
                return pick
        pick = random.choice(choices)
        self._last_latency_filler = pick
        return pick

    def _pick_latency_watchdog_filler(self, lang: str, user_text: str) -> str:
        """
        Short thinking-bridge line when the LLM is slow. No extra LLM call.

        Override: conversation_policy.latency_fillers or bot_config.latency_fillers
        as a list of strings, or dict with keys en / hi / default.
        """
        custom = self._conversation_policy.get("latency_fillers")
        if custom is None:
            custom = self._bot_config.get("latency_fillers")
        if isinstance(custom, list):
            opts = [str(x).strip() for x in custom if str(x).strip()]
            if opts:
                return self._choose_latency_filler_no_repeat(tuple(opts))
        if isinstance(custom, dict):
            lang_l = (lang or "en").lower()
            key = "hi" if ("hi" in lang_l or lang_l.startswith("hi")) else "en"
            raw = custom.get(key) or custom.get("default") or []
            if isinstance(raw, list):
                opts = [str(x).strip() for x in raw if str(x).strip()]
                if opts:
                    return self._choose_latency_filler_no_repeat(tuple(opts))

        lang_l = (lang or "en").lower()
        ut = (user_text or "").strip()
        ut_lower = ut.lower()
        is_hi_family = (
            "hi" in lang_l
            or lang_l.startswith("hi")
            or self.is_hindi(ut)
        )
        has_question = "?" in ut or any(
            w in ut_lower
            for w in (
                "what ",
                "how ",
                "when ",
                "why ",
                "where ",
                "which ",
                "kya ",
                "kaise ",
                "kab ",
                "kahan ",
                "kitna ",
            )
        )
        words = ut_lower.split()
        is_ack = bool(ut) and len(words) <= 4 and any(
            ut_lower == w
            or ut_lower.startswith(w + " ")
            or ut_lower.endswith(" " + w)
            or (len(words) == 1 and words[0].startswith(w))
            for w in (
                "yes",
                "yeah",
                "yep",
                "ok",
                "okay",
                "sure",
                "ha",
                "haan",
                "han",
                "ji",
                "theek",
                "thik",
                "sahi",
            )
        )
        is_frustration = any(
            w in ut_lower
            for w in (
                "sorry",
                "problem",
                "issue",
                "frustrat",
                "angry",
                "wait",
                "slow",
                "samajh",
                "galat",
                "galti",
                "help",
                "madad",
            )
        )

        if is_hi_family:
            if is_frustration:
                pool = _LATENCY_FILLERS_HI_FRUSTRATION
            elif has_question:
                pool = _LATENCY_FILLERS_HI_QUESTION
            elif is_ack:
                pool = _LATENCY_FILLERS_HI_ACK
            else:
                pool = _LATENCY_FILLERS_HI_DEFAULT
        else:
            if is_frustration:
                pool = _LATENCY_FILLERS_EN_FRUSTRATION
            elif has_question:
                pool = _LATENCY_FILLERS_EN_QUESTION
            elif is_ack:
                pool = _LATENCY_FILLERS_EN_ACK
            else:
                pool = _LATENCY_FILLERS_EN_DEFAULT

        return self._choose_latency_filler_no_repeat(pool)

    def _register_latency_watchdog_task(self, task: asyncio.Task) -> None:
        self._pending_latency_watchdogs.append(task)

        def _drop(t: asyncio.Task) -> None:
            try:
                self._pending_latency_watchdogs.remove(t)
            except ValueError:
                pass

        task.add_done_callback(_drop)

    def _cancel_all_latency_watchdogs(self) -> None:
        for t in list(self._pending_latency_watchdogs):
            if not t.done():
                t.cancel()
        self._pending_latency_watchdogs.clear()

    def _lang_instruction_block(self, lang: str) -> str:
        if lang == "en":
            return ""
        style = str(
            self._conversation_policy.get("language_style")
            or self._bot_config.get("language_style")
            or ""
        ).lower().strip()
        _tail = (
            "\nDo NOT invent or guess data bits."
            "\n\n[CRITICAL VERIFICATION RULES]"
            "\n- You MUST NOT call 'verify_customer' with placeholder values like 'account_number', 'date_of_birth', or 'last_4_digits'."
            "\n- You MUST collect ALL three pieces of information (16-digit account, DOB in DD-MM-YYYY, and last 4 phone digits) BEFORE calling the verification tool."
            "\n- If any detail is missing, ask the user for it instead of calling the tool."
            "\n- NEVER guess or auto-complete an account number. If a user says '1212', do NOT assume it starts with '1234 5678 9012'."
        )
        if style == "hinglish":
            return (
                "\nIMPORTANT: Speak in natural Hinglish — mix Hindi and English the way many Indian "
                "customers do on phone calls (Roman Hindi + English product terms is fine). "
                "Mirror the user's code-switching: more English if they lean English; more Hindi if they lean Hindi. "
                "Do not force stiff formal textbook Hindi when the user sounds casual or mixed."
                + _tail
            )
        return (
            f"\nIMPORTANT: The user is speaking in '{lang}'. "
            f"You MUST respond in the SAME language ('{lang}'). "
            f"Do NOT switch to English unless the user speaks English. "
            + _tail
        )

    def _static_system_prompt_cache_key(self) -> str:
        spec_block = render_agent_task_spec_appendix(self._agent_task_spec)
        db_prompt = (self._bot_config.get("system_prompt") or "").strip()
        if db_prompt:
            raw = f"db|{db_prompt}|{spec_block}"
            return hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()[:40]
        tool_bits: list[str] = []
        if self._tool_instances:
            for tool_name in sorted(self._tool_instances.keys()):
                inst = self._tool_instances[tool_name]
                if hasattr(inst, "safety_instructions") and inst.safety_instructions:
                    tool_bits.append(f"{tool_name}:{inst.safety_instructions}")
        custom_rules = self._bot_config.get("guardrails") or self._bot_config.get("negative_constraints") or ""
        base = f"default:{self._bot_config.get('name', '')}"
        raw = f"{base}|{custom_rules}|{spec_block}|{'||'.join(tool_bits)}"
        return hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()[:40]

    def _compute_static_system_prompt_fragment(self, lang: str) -> str:
        lang_instruction = self._lang_instruction_block(lang)
        spec_block = render_agent_task_spec_appendix(self._agent_task_spec)

        tool_safety_block = ""
        if self._tool_instances:
            instructions = []
            for tool_name, tool_instance in self._tool_instances.items():
                if hasattr(tool_instance, "safety_instructions") and tool_instance.safety_instructions:
                    instructions.append(f"- {tool_name.upper()}: {tool_instance.safety_instructions}")
            if instructions:
                tool_safety_block = "\n\n[CAPABILITY SAFETY RULES]\n" + "\n".join(instructions)

        bot_guardrails = ""
        custom_rules = self._bot_config.get("guardrails") or self._bot_config.get("negative_constraints")
        if custom_rules:
            bot_guardrails = f"\n\n[USER-DEFINED GUARDRAILS]\n{custom_rules}"

        dynamic_safety = f"{tool_safety_block}{bot_guardrails}"

        tool_instruction_block = ""
        if self._tool_instances:
            tool_instruction_block = (
                "\n\n[SYSTEM: TOOL CALLING RULES — MANDATORY]\n"
                "When you need to call a tool, use ONLY the native tool_calls API. NEVER write tool calls as text. This means:\n"
                "  - NEVER write XML tags like <function=tool_name>...</function>\n"
                "  - NEVER write JSON code blocks like ```json {\"name\": \"tool_name\"} ```\n"
                "  - NEVER write Python-style calls like tool_name(arg1='val1')\n"
                "  - NEVER say 'I will call X' — just call it silently via the API\n"
                "  - NEVER write bracket annotations like [TOOL: tool_name] {args}\n"
                "Base tool parameters ONLY on information the user has explicitly provided. "
                "Never guess, invent, or use placeholder values for tool arguments."
            )

        # Conversation style block — injected for all bots, critical for natural voice feel
        call_direction = (self._bot_config.get("call_direction") or "outbound").lower()
        
        outbound_rule = ""
        if call_direction == "outbound":
            outbound_rule = (
                "\n"
                "RULE 6 — OUTBOUND BEHAVIOUR:\n"
                "You initiated this call. The customer did NOT call you for help.\n"
                "Phrases like 'Yes?', 'Tell me', 'Haan', 'Bataiye' mean 'go ahead, state your purpose'. "
                "NEVER respond to these with 'How can I help you?'.\n"
                "Treat these as a green light — immediately state your call objective.\n"
                "BAD: 'Okay, so how can I assist you today?'\n"
                "GOOD: 'Great. [User Name], I am calling regarding [State Objective]...'\n"
            )

        conversation_style_block = (
            "\n\n[CONVERSATION STYLE — MANDATORY]\n"
            "Speak like a confident, warm human agent on a phone call. Never sound like a bot or a script.\n"
            "\n"
            "RULE 1 — NO ECHOING (most critical):\n"
            "NEVER repeat, paraphrase, or translate the user's words back to them.\n"
            "When a user says a short affirmative ('yes', 'haan', 'okay', 'right') — do NOT say 'I understand you are available' or 'You said yes'.\n"
            "Just use a single pivot word ('Okay,' / 'Great,' / 'Right,') and continue naturally.\n"
            "BAD: 'Since you said yes, I will now tell you...'\n"
            "GOOD: 'Great. [State the next point directly]'\n"
            "\n"
            "RULE 2 — NO MID-CALL GREETINGS:\n"
            "NEVER use greetings ('Hello', 'Namaste', 'Good morning') once the conversation has started.\n"
            "Greetings are strictly for the very first message. After that, go straight to the point.\n"
            "\n"
            "RULE 3 — NO INTENT ANNOUNCING:\n"
            "NEVER announce what you are about to do (e.g., 'I want to talk to you about X'). Just talk about X.\n"
            "BAD: 'Now I want to discuss your account...'\n"
            "GOOD: 'Regarding your account...'\n"
            "\n"
            "RULE 4 — BE DIRECT AND PERSONAL:\n"
            "Use the caller's name naturally if you know it. Match their language: Hindi/Hinglish response → reply in Hinglish. English → English.\n"
            "\n"
            "RULE 5 — ASSUME AFFIRMATIVE ON UNCLEAR INPUT:\n"
            "In a voice call, transcriptions are often imperfect. "
            "If user input is short and garbled but starts with an affirmative sound ('ha', 'yep', 'hmm', 'ji') — assume YES.\n"
            "NEVER say 'I didn't understand' for a 1-2 word affirmative.\n"
            "BAD: 'I didn't quite catch that, could you repeat?'\n"
            "GOOD: 'Got it. [Continue with objective]'\n"
            f"{outbound_rule}"
        )

        # Build full prompt
        if self._bot_config.get("system_prompt"):
            return (
                self._bot_config["system_prompt"]
                + conversation_style_block
                + lang_instruction
                + spec_block
                + dynamic_safety
                + tool_instruction_block
            )

        bot_name = self._bot_config.get("name", "Assistant")
        return (
            f"You are {bot_name}, a helpful, friendly AI voice assistant. "
            "You are having a real-time voice conversation with a human.\n\n"
            "Guidelines:\n"
            "- Keep responses concise and conversational (1-3 sentences)\n"
            "- Speak naturally — use contractions, filler words sparingly\n"
            "- Emotion & Tone: Dynamically adapt your tone based on context. "
            "If the user is frustrated, be empathetic. If they are happy, be enthusiastic. "
            "You may use descriptive emotion cues like [excited], [thoughtful], or [concerned] at the start of your turn to help the voice engine adapt.\n"
            "- Never use markdown, bullet points, or formatting-only tags\n"
            "\n[SYSTEM NOTE: LATENCY FILLERS]\n"
            "You may occasionally see '[system_filler]' tokens in history. IGNORE them. Do NOT repeat or acknowledge them.\n"
            "- Never mention that you are an AI unless directly asked\n"
            "- If you don't understand, ask for clarification\n"
            "- Be warm, empathetic, and professional\n"
            "- Never reveal sensitive information (passwords, OTPs, card numbers)\n"
            f"{conversation_style_block}{lang_instruction}{spec_block}{dynamic_safety}{tool_instruction_block}"
        )


    def _get_static_system_prompt_fragment(self, lang: str) -> str:
        _sty = str(
            self._conversation_policy.get("language_style")
            or self._bot_config.get("language_style")
            or ""
        ).lower().strip()
        ck = f"{self._static_system_prompt_cache_key()}:{lang}:{_sty}"
        if ck not in self._llm_static_prompt_cache:
            self._llm_static_prompt_cache[ck] = self._compute_static_system_prompt_fragment(lang)
        return self._llm_static_prompt_cache[ck]

    def _build_dynamic_system_suffix(self) -> str:
        extra = ""
        if getattr(self.session, "interrupt_prompt_pending", False):
            extra = "\n\n[Context: The user interrupted your previous spoken reply. Acknowledge briefly and respond to what they say next.]"
            self.session.interrupt_prompt_pending = False
        if kb_only_mode(self._guardrail_policy):
            extra += (
                "\n\nFor factual questions about the business, policies, or services, "
                "use the search_knowledge tool and base answers on retrieved text; do not invent details."
            )

        phase_hint = self._format_task_phase_hint()

        memory_block = ""
        if self._cross_session_context:
            memory_block = (
                "\n\n[CALLER MEMORY — use this to personalize your responses]\n"
                + self._cross_session_context
                + "\n[END CALLER MEMORY]"
            )

        contradiction_block = ""
        hint = self.session.metadata.get("contradiction_hint")
        if hint:
            contradiction_block = f"\n\n[LIVE CONTEXT]\n{hint}\n[END LIVE CONTEXT]"

        # Caller context: expose all non-internal workflow session_data to the LLM
        # This ensures the LLM knows the caller's name, captured amounts, etc. after workflow yield
        caller_context_block = ""
        _workflow_data = {}
        if self.workflow_engine:
            _workflow_data = getattr(self.workflow_engine, "session_data", {})
        caller_context_lines = [
            f"  {k}: {str(v)[:80]}"
            for k, v in _workflow_data.items()
            if not str(k).startswith("_") and v and str(v) not in ("NONE", "None", "")
        ]
        if caller_context_lines:
            caller_context_block = (
                "\n\n[CALLER CONTEXT — facts established so far this call]\n"
                + "\n".join(caller_context_lines)
                + "\n[END CALLER CONTEXT]\n"
                "Use the above naturally in conversation. "
                "Never say you don't know something that is listed above."
            )

        return f"{extra}{memory_block}{contradiction_block}{caller_context_block}{phase_hint}"

    def _build_system_prompt(self) -> str:
        """
        Build the system prompt for the LLM.
        Static portions (persona, tool safety, language rules) are cached per bot revision + language.
        """
        lang = self.session.detected_language or "en"
        return self._get_static_system_prompt_fragment(lang) + self._build_dynamic_system_suffix()

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
        self._persona_id = bot_config.get("persona_id")
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
        self._llm_static_prompt_cache.clear()
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
        
        # 🛡️ Load UI-Defined (No-Code) Tools
        await self._load_custom_tools()

    async def _load_custom_tools(self) -> None:
        """Register any custom tools created via the UI."""
        if not self.db:
            return
            
        try:
            custom_tools = await self.db.list_custom_tools()
            if not custom_tools:
                return
                
            from voicebot.shared.models.tools import ToolDefinition
            from voicebot.core.tools.implementations.configurable import DynamicAPITool
            
            for config in custom_tools:
                # To prevent naming collisions with hardcoded tools,
                # we only register if not already present.
                if config["name"] in self._tool_instances:
                    continue
                    
                tool = DynamicAPITool(config=config, session=self.session, db=self.db, brain=self)
                self._tool_instances[tool.name] = tool
                
                # 🛡️ Resiliency Fix: Many custom tools are saved with flat parameter dicts 
                # (e.g. {"id": "string"}). We MUST wrap these in a proper JSON Schema 
                # or strict LLM SDKs (like Gemini/Pydantic v2) will crash.
                tool_params = tool.parameters or {"type": "object", "properties": {}}
                if isinstance(tool_params, dict) and "properties" not in tool_params and len(tool_params) > 0:
                    logger.warning("🛡️ Auto-repairing custom tool '%s': wrapping flat params into JSON Schema", tool.name)
                    tool_params = {
                        "type": "object",
                        "properties": {
                            k: (v if isinstance(v, dict) and "type" in v else {"type": "string", "description": str(v)})
                            for k, v in tool_params.items()
                        },
                        "required": list(tool_params.keys())
                    }

                # Append to the list of tools presented to the LLM
                self._tools.append(ToolDefinition(
                    name=tool.name,
                    description=tool.description,
                    parameters=tool_params
                ))
            logger.info("🛡️  Registered %d custom (no-code) tools", len(custom_tools))
        except Exception as e:
            logger.error("Failed to load custom tools: %s", e)

    async def _post_call_reflection(self) -> None:
        """
        Extract insights from the finished conversation to update long-term memory.
        Uses a 'Heavy' model (GPT-4 / Gemini Pro) for high-quality extraction.
        """
        if not self._vector_memory or not self.session.conversation_history:
            return
            
        logger.info("🧠 [REFLECTION] Starting post-call analysis for user %s", self.session.user_id)
        
        try:
            # 1. Prepare history for the analyst
            transcript_lines = []
            for turn in self.session.conversation_history:
                role = turn.role.upper()
                content = turn.content or "[Action Taken]"
                transcript_lines.append(f"{role}: {content}")
            
            full_transcript = "\n".join(transcript_lines)
            
            # 2. Call the reflection engine (Non-streaming, high-intelligence)
            # NOTE: We use the direct provider call to avoid speech/guardrail overhead.
            prompt = _POST_CALL_REFLECTION_PROMPT.format(transcript=full_transcript)
            
            # Try to pick a 'Heavy' model if using OpenRouter
            heavy_model = "google/gemini-2.0-flash-001" 
            if hasattr(self.llm, "provider") and self.llm.provider == "openrouter":
                 # Use a reasoning-heavy or high-context model for post-call analysis
                 reflection_resp = await self.llm.complete(
                     system_prompt="You are an expert conversation analyst.",
                     messages=[{"role": "user", "content": prompt}]
                 )
            else:
                 # Fallback to current provider's default complete if available
                 if hasattr(self.llm, "complete"):
                     reflection_resp = await self.llm.complete(
                         system_prompt="You are an expert conversation analyst.",
                         messages=[{"role": "user", "content": prompt}]
                     )
                 else:
                     logger.warning("[REFLECTION] LLM provider does not support non-streaming '.complete()'")
                     return

            # 3. Parse and Store
            try:
                # Extract JSON from potential markdown wrapping
                json_match = re.search(r"\{.*\}", reflection_resp, re.DOTALL)
                if not json_match:
                    logger.warning("[REFLECTION] No JSON found in response")
                    return
                
                insights = json.loads(json_match.group(0))
                
                # A. Store Call Summary
                summary = insights.get("outcome_summary", "")
                if summary:
                    try:
                        await self._vector_memory.store_conversation(
                            session_id=self.session.session_id,
                            summary=summary,
                            user_id=self.session.user_id
                        )
                    except Exception as e:
                        logger.error("[REFLECTION] Failed to store summary: %s", e)
                
                # B. Store User Facts
                for item in insights.get("user_facts", []):
                    fact = item.get("fact") if isinstance(item, dict) else str(item)
                    conf = item.get("confidence", 0.7) if isinstance(item, dict) else 0.7
                    if not fact: continue
                    
                    try:
                        await self._vector_memory.store_fact(
                            bot_id=str(self._bot_id),
                            fact=fact,
                            source="reflection",
                            category="user_context",
                            confidence=conf # Pass to metadata
                        )
                    except Exception as e:
                        logger.error("[REFLECTION] Failed to store fact: %s", e)
                
                # C. Store Successful Tactics (learned behavior)
                for item in insights.get("successful_tactics", []):
                    tactic = item.get("tactic") if isinstance(item, dict) else str(item)
                    conf = item.get("confidence", 0.7) if isinstance(item, dict) else 0.7
                    if not tactic: continue
                    
                    try:
                        await self._vector_memory.store_fact(
                            bot_id=str(self._bot_id),
                            fact=f"Tactical Insight: {tactic}",
                            source="reflection",
                            category="successful_tactics",
                            confidence=conf
                        )
                    except Exception as e:
                        logger.error("[REFLECTION] Failed to store tactic: %s", e)
                    
                logger.info("✅ [REFLECTION] Complete for user %s. Insights stored.", self.session.user_id)
                
            except (json.JSONDecodeError, KeyError) as parse_err:
                logger.error("[REFLECTION] Failed to parse model output: %s", parse_err)
                
        except Exception as e:
            logger.error("[REFLECTION] Error during analysis: %s", e)

    async def cleanup(self) -> None:
        """Clean up resources when the session ends."""
        self._cancel_all_latency_watchdogs()
        if self._silence_timer:
            self._silence_timer.cancel()
        if self._proactive_timer:
            self._proactive_timer.cancel()
        if self._inactivity_timer:
            self._inactivity_timer.cancel()
        if self._current_task:
            self._current_task.cancel()
        if self._current_turn_task:
            self._current_turn_task.cancel()
            self._current_turn_task = None
        if self._active_tts_consumer_task and not self._active_tts_consumer_task.done():
            self._active_tts_consumer_task.cancel()
            self._active_tts_consumer_task = None
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
                    "hallucinations_recovered": getattr(self, "_hallucination_count_this_session", 0),
                }
                await self.db.close_session(self.session.session_id, turn_count=self._turn_count, metadata=stats)
            except Exception:
                pass

        logger.info("Brain cleanup complete — session=%s", self.session.session_id[:8])
        
        # 🧠 PHASE 5: Post-Call Reflection (Self-Learning)
        # We run this in the background after the session is closed to the user.
        if self.session.user_id:
             reflection_task = asyncio.create_task(self._post_call_reflection())
             # Ensure the task is not garbage collected early and is tracked
             if not hasattr(self, "_background_tasks"):
                 self._background_tasks = set()
             self._background_tasks.add(reflection_task)
             reflection_task.add_done_callback(self._background_tasks.discard)

    # ─── Logic Helpers (Delegated to TurnDetector) ───────────────────

    def _strip_technical_artifacts(self, text: str) -> str:
        """Strip technical hallucinations like <function> or (function=...) tags or raw JSON from spoken text."""
        import re
        if not text: return ""
        # 1. Strip ALL variations of function tags (handles XML-spec, parenthesis-style, and malformed tags)
        # Matches: <function=name...>, (function=name...), function=name... (naked), etc.
        patterns = [
            r'<[\s/]*?function.*?>.*?</[\s/]*?function>', # <function>...</function>
            r'\(function=.*?\)<?function>?',             # (function...)<function>
            r'\(function=.*?\)',                         # (function...)
            r'<function=.*?>',                            # <function=...>
            r'function=[a-zA-Z0-9_-]+>.*?<\/function>',   # Naked starting tag: function=name>.../function
            r'function=[a-zA-Z0-9_-]+>.*?$',              # Partial naked tag at end of stream
            r'<function=.*?$',                            # Partial XML format at end of stream
        ]
        for p in patterns:
            text = re.sub(p, '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # 2. Strip leftover raw JSON-like blocks that aren't inside tags
        text = re.sub(r'\{[^{}]*?"[^{}]*?":.*?\}(?!\s*<)', '', text, flags=re.DOTALL | re.IGNORECASE)

        # 3. Clean up any leftover boundary characters from technical IDs
        text = re.sub(r'\[METRIC\].*?$', '', text, flags=re.DOTALL)
        
        return text.strip()

    def _extract_hallucinated_tool_calls(self, text: str) -> list[ToolCall]:
        """
        Recover tool calls from hallucinated text in 8 known LLM formats:
          1. XML:        <function=name>{"arg":"val"}</function>
          2. Paren+end:  (function=name>{"arg":"val"}<function>
          3. Loose paren:(function=name>{"arg":"val"})
          4. MD block:   ```json {"name":"tool","arguments":{}} ```
          5. Raw JSON:   {"name":"tool","arguments":{...}}
          6. Python call: tool_name(arg1="val1") — known tools only
          7. Bracket:    [TOOL: tool_name] {"arg":"val"}
          8. Natural lang: "I'll call tool_name" → empty args → dummy guard fires TOOL_ERROR
        """
        import re
        import json
        from voicebot.shared.models.tools import ToolCall

        # Balanced JSON extractor (avoids catastrophic backtracking from greedy .*)
        _BALANCED_JSON = r'(\{(?:[^{}]|\{[^{}]*\})*\})'

        def _try_parse_json(raw: str) -> Optional[dict]:
            """Find and parse first balanced JSON object in raw string."""
            for m in re.finditer(_BALANCED_JSON, raw, flags=re.DOTALL):
                try:
                    return json.loads(m.group(1))
                except Exception:
                    continue
            return None

        def _validate_tool(name: str) -> bool:
            if name not in self._tool_instances:
                logger.warning("🚫 [HALLUCINATION] Extracted tool '%s' not in _tool_instances", name)
                return False
            return True

        def _normalize_args(args: dict) -> dict:
            """Normalize hallucinated parameter names to official names."""
            ARG_MAPPINGS = {
                "date_of_birth": "dob",
                "last_4_phone_digits": "phone_last_4",
                "account_id": "account_number",
                "customer_id": "account_number",
            }
            for hallucinated, official in ARG_MAPPINGS.items():
                if hallucinated in args:
                    args[official] = args.pop(hallucinated)
            return args

        calls: list[ToolCall] = []
        seen: set[str] = set()
        if not text:
            return calls

        def _add_call(name: str, args: dict) -> None:
            args = _normalize_args(args)
            key = f"{name}:{json.dumps(args, sort_keys=True)}"
            if key not in seen:
                seen.add(key)
                calls.append(ToolCall(id=f"hallucinated_{name}_{len(calls)}", name=name, arguments=args))
                logger.info("🧠 Recovered hallucinated tool call: %s(%s)", name, args)

        # ── Pattern 1: XML <function=name>args</function> ──────────────────────
        for m in re.finditer(r'<function=([a-zA-Z0-9_-]+)(.*?)</function>', text, flags=re.DOTALL | re.IGNORECASE):
            name = m.group(1)
            if not _validate_tool(name):
                continue
            raw = re.sub(r'^>', '', m.group(2).strip())
            args = _try_parse_json(raw) or ({"query": raw} if raw else {})
            _add_call(name, args)

        # ── Pattern 2: Paren+trailing (function=name>args<function> ────────────
        for m in re.finditer(r'\(function=([a-zA-Z0-9_-]+)>(.*?)<function>', text, flags=re.DOTALL | re.IGNORECASE):
            name = m.group(1)
            if not _validate_tool(name):
                continue
            raw = m.group(2).strip()
            args = _try_parse_json(raw) or ({"query": raw} if raw else {})
            _add_call(name, args)

        # ── Pattern 3: Loose paren (function=name>args) ────────────────────────
        for m in re.finditer(r'\(function=([a-zA-Z0-9_-]+)>(.*?)\)', text, flags=re.DOTALL | re.IGNORECASE):
            name = m.group(1)
            if not _validate_tool(name):
                continue
            raw = m.group(2).strip()
            args = _try_parse_json(raw) or ({"query": raw} if raw else {})
            _add_call(name, args)

        # ── Pattern 4: Markdown code block ```json {"name":"tool",...} ``` ──────
        for m in re.finditer(r'```(?:json)?\s*(\{.*?\})\s*```', text, flags=re.DOTALL | re.IGNORECASE):
            try:
                obj = json.loads(m.group(1))
                name = obj.get("name") or obj.get("tool") or obj.get("function")
                if name and _validate_tool(name):
                    args = obj.get("arguments") or obj.get("args") or obj.get("parameters") or {}
                    _add_call(name, args)
            except Exception:
                pass

        # ── Pattern 5: Raw JSON {"name":"tool","arguments":{...}} ──────────────
        for m in re.finditer(_BALANCED_JSON, text, flags=re.DOTALL):
            try:
                obj = json.loads(m.group(1))
                name = obj.get("name") or obj.get("tool") or obj.get("function")
                if name and isinstance(name, str) and _validate_tool(name):
                    args = obj.get("arguments") or obj.get("args") or obj.get("parameters") or {}
                    if isinstance(args, dict):
                        _add_call(name, args)
            except Exception:
                pass

        # ── Pattern 6: Python-style call tool_name(key="val") — known tools only
        for tool_name in self._tool_instances:
            escaped = re.escape(tool_name)
            for m in re.finditer(rf'\b{escaped}\s*\(([^)]*)\)', text, flags=re.DOTALL):
                raw_kwargs = m.group(1).strip()
                args: dict = {}
                if raw_kwargs:
                    for kv in re.finditer(r'(\w+)\s*=\s*["\']?([^,"\']+)["\']?', raw_kwargs):
                        args[kv.group(1)] = kv.group(2).strip()
                _add_call(tool_name, args)

        # ── Pattern 7: Bracket annotation [TOOL: tool_name] {args} ────────────
        for m in re.finditer(r'\[TOOL:\s*([a-zA-Z0-9_-]+)\]\s*' + _BALANCED_JSON, text, flags=re.DOTALL | re.IGNORECASE):
            name = m.group(1)
            if not _validate_tool(name):
                continue
            args = _try_parse_json(m.group(2)) or {}
            _add_call(name, args)

        # ── Pattern 8: Natural language "I'll call verify_customer" ────────────
        # Recover with empty args so dummy guard fires TOOL_ERROR and asks user
        for tool_name in self._tool_instances:
            escaped = re.escape(tool_name)
            if re.search(rf"(?:call|invoke|use|run|execute)\s+{escaped}\b", text, flags=re.IGNORECASE):
                # Only add if not already captured by a more specific pattern
                key = f"{tool_name}:{{}}"
                if key not in seen:
                    _add_call(tool_name, {})

        return calls

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

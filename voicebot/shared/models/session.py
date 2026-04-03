"""
Session and conversation data models shared across all services.
These models represent the in-flight state of a voice conversation.
"""

from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class TurnRole(str, Enum):
    """Who is speaking in a conversation turn."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationTurn(BaseModel):
    """A single turn in the conversation history."""
    role: TurnRole
    content: str
    timestamp: float = Field(default_factory=time.time)
    language: Optional[str] = None  # Detected language code (e.g. "en", "hi")
    duration_ms: Optional[float] = None  # Audio duration of this turn
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionState(BaseModel):
    """
    Complete state of a voice session.
    Stored in Redis for fast access by the Orchestrator.
    """
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    # Conversation history (short-term, kept in Redis)
    conversation_history: list[ConversationTurn] = Field(default_factory=list)

    # Current state flags
    is_active: bool = True
    is_user_speaking: bool = False
    is_bot_speaking: bool = False
    is_interrupted: bool = False

    # Language tracking
    detected_language: str = "en"
    preferred_language: Optional[str] = None

    # Pipeline state — tracks what's currently being processed
    current_transcript: str = ""
    pending_llm_response: str = ""

    # Latency tracking (milliseconds)
    last_stt_latency_ms: float = 0.0
    last_llm_latency_ms: float = 0.0
    last_tts_latency_ms: float = 0.0
    last_total_latency_ms: float = 0.0

    # Voice smoothness telemetry — populated by AgenticBrain each turn
    first_audio_latency_ms: float = 0.0    # Time from user speech end → first audio byte
    inter_segment_gap_ms: float = 0.0      # Avg gap between consecutive TTS segments this turn
    tts_provider_used: str = ""            # 'deepgram_ws' | 'deepgram_http' | 'elevenlabs' | 's2s'
    false_interruption_count: int = 0      # Echo-triggered self-interruptions this session

    # Resource usage tracking
    cumulative_prompt_tokens: int = 0
    cumulative_completion_tokens: int = 0
    cumulative_total_tokens: int = 0

    # Metadata for the session (task phase, slots, counters — see AgenticBrain)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Server-initiated voice session end (after final assistant audio / TTS)
    voice_session_end_requested: bool = False
    voice_session_end_reason: Optional[str] = None

    # Barge-in flow control
    interrupt_prompt_pending: bool = False

    def add_turn(self, role: TurnRole, content: str, **kwargs: Any) -> None:
        """Add a conversation turn and update the timestamp."""
        self.conversation_history.append(
            ConversationTurn(role=role, content=content, **kwargs)
        )
        self.updated_at = time.time()

    def get_context_window(self, max_turns: int = 20) -> list[dict[str, str]]:
        """
        Return the most recent turns formatted for LLM context injection.
        Limits to max_turns to control token usage.
        """
        recent = self.conversation_history[-max_turns:]
        return [{"role": t.role.value, "content": t.content} for t in recent]

    def mark_interrupted(self) -> None:
        """Mark that the user interrupted the bot's response."""
        self.is_interrupted = True
        self.is_bot_speaking = False
        self.pending_llm_response = ""
        self.updated_at = time.time()

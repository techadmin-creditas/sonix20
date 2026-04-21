"""
Event schemas for inter-service communication via Kafka/RabbitMQ.
All events are self-describing and include routing metadata.
"""

from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Types of events flowing through the event bus."""
    # Pipeline events
    AUDIO_CHUNK_RECEIVED = "audio.chunk.received"
    STT_PARTIAL_TRANSCRIPT = "stt.partial.transcript"
    STT_FINAL_TRANSCRIPT = "stt.final.transcript"
    LLM_TOKEN_GENERATED = "llm.token.generated"
    LLM_RESPONSE_COMPLETE = "llm.response.complete"
    TTS_AUDIO_CHUNK = "tts.audio.chunk"
    TTS_AUDIO_COMPLETE = "tts.audio.complete"

    # Session events
    SESSION_STARTED = "session.started"
    SESSION_ENDED = "session.ended"
    SESSION_ERROR = "session.error"

    # Control events
    INTERRUPTION_DETECTED = "control.interruption"
    TURN_CHANGE = "control.turn_change"
    LANGUAGE_DETECTED = "control.language_detected"

    # Security events
    GUARDRAIL_TRIGGERED = "security.guardrail_triggered"
    PII_DETECTED = "security.pii_detected"


class VoiceEvent(BaseModel):
    """
    Canonical event envelope for all inter-service communication.
    Every event is uniquely identified and traceable.
    """
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType
    session_id: str
    timestamp: float = Field(default_factory=time.time)
    source_service: str  # e.g., "stt-service", "orchestrator"

    # Payload — flexible dict for event-specific data
    payload: dict[str, Any] = Field(default_factory=dict)

    # Tracing
    correlation_id: Optional[str] = None
    parent_event_id: Optional[str] = None

    class Config:
        use_enum_values = True

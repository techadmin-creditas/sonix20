"""
Semantic Turn Detector — Intelligent Voice Activity Detection.

Unlike simple silence detection, this module uses:
  1. Silence duration (primary signal)
  2. Transcript completeness heuristics (secondary signal)
  3. Sentence boundary detection

This helps avoid cutting off users mid-sentence when they pause briefly.
"""

from __future__ import annotations

import re
import logging
from typing import Any, Set

logger = logging.getLogger(__name__)


class TurnDetector:
    """
    Determines when a user has finished their turn.
    """
    # Advanced: Linguistic VAD Signals
    # Ends with these words → likely mid-thought pause
    TRAILING_INCOMPLETE: Set[str] = {
        "and", "but", "or", "so", "because", "when", "if", "the", "a", "an",
        "to", "for", "with", "ki", "par", "lekin", "aur", "agar", "jab",
        "kya", "toh", "hai",
    }

    def __init__(
        self,
        min_silence_ms: float = 600,
        max_silence_ms: float = 2000,
        confidence_threshold: float = 0.7,
    ):
        self.min_silence_ms = min_silence_ms
        self.max_silence_ms = max_silence_ms
        self.confidence_threshold = confidence_threshold

    def compute_turn_complete_confidence(
        self,
        transcript: str,
        silence_duration_ms: float,
    ) -> float:
        """
        Compute a confidence score (0.0 to 1.0) that the user has finished speaking.
        """
        if not transcript.strip():
            return 0.0

        score = 0.0
        text = transcript.strip()

        # ── Signal 1: Silence duration ──
        if silence_duration_ms >= self.max_silence_ms:
            score += 0.5
        elif silence_duration_ms >= self.min_silence_ms:
            ratio = (silence_duration_ms - self.min_silence_ms) / (
                self.max_silence_ms - self.min_silence_ms
            )
            score += 0.3 * ratio

        # ── Signal 2: Sentence completeness ──
        if text[-1] in ".!?":
            score += 0.3
        elif text[-1] in ",;:":
            score += 0.1

        question_words = {
            "what", "where", "when", "how", "why", "who", "can", "could", "would",
            "is", "are", "do", "does", "kya", "kab", "kahan", "kaise", "kyon",
            "kaun", "kabtak", "kitna",
        }
        first_word = text.split()[0].lower() if text.split() else ""
        if first_word in question_words or text.endswith("?"):
            score += 0.15

        # ── Signal 5: Trailing conjunction/preposition (incomplete) ──
        last_word = text.split()[-1].lower().rstrip(".,!?") if text.split() else ""
        if last_word in self.TRAILING_INCOMPLETE:
            score -= 0.25

        return max(0.0, min(1.0, score))

    def is_turn_complete(
        self,
        transcript: str,
        silence_duration_ms: float,
        **kwargs: Any
    ) -> bool:
        """
        Determine if the user's turn is complete.
        Returns True if confidence exceeds threshold or silence exceeds dynamic max.
        """
        threshold_ms = self.get_recommended_threshold(transcript, self.max_silence_ms, **kwargs)
        if silence_duration_ms >= threshold_ms:
            return True

        confidence = self.compute_turn_complete_confidence(transcript, silence_duration_ms)
        
        # Penalize confidence if 'mid-thought' signals are present
        words = transcript.lower().split()
        if words and words[-1].rstrip(".,!?") in self.TRAILING_INCOMPLETE:
            confidence *= 0.5

        return confidence >= self.confidence_threshold

    def get_recommended_threshold(
        self,
        transcript: str,
        base_max_threshold_ms: float,
        **kwargs: Any
    ) -> float:
        """
        Calculate a dynamic silence threshold based on linguistic signals.
        If the user ends with a conjunction, increase the patience window.
        """
        transcript = (transcript or "").strip()
        if not transcript:
            return base_max_threshold_ms

        words = transcript.lower().split()
        last_word = words[-1].rstrip(".,!?") if words else ""
        
        # Base patience mapping from confidence
        # (calculated without silence duration to see linguistic completeness)
        confidence = self.compute_turn_complete_confidence(transcript, 0)
        
        # Low confidence (Mid-sentence pause) → Patient response (1500ms+)
        if confidence > 0.8:
            dynamic_threshold = 600.0
        elif confidence > 0.5:
            dynamic_threshold = 800.0
        else:
            dynamic_threshold = 1500.0

        # Apply conjunction multiplier (Advanced Linguistic VAD)
        if last_word in self.TRAILING_INCOMPLETE:
            dynamic_threshold *= 2.0
            
        # Prosody extension (Future Expansion)
        if kwargs.get("pitch_signal") == "flat":
            dynamic_threshold *= 1.5

        # Safety: never wait longer than double the configured max threshold
        return min(dynamic_threshold, base_max_threshold_ms * 2.0)

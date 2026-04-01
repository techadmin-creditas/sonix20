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

logger = logging.getLogger(__name__)


class TurnDetector:
    """
    Determines when a user has finished their turn.

    Uses a combination of:
      - Silence duration
      - Linguistic completeness signals
      - Energy-based VAD (placeholder for future ML model)
    """

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

        Higher confidence → more likely the turn is complete.
        Used by the brain to decide the silence threshold dynamically.
        """
        if not transcript.strip():
            return 0.0

        score = 0.0
        text = transcript.strip()

        # ── Signal 1: Silence duration ──
        # More silence → higher confidence
        if silence_duration_ms >= self.max_silence_ms:
            score += 0.5
        elif silence_duration_ms >= self.min_silence_ms:
            # Linear interpolation between min and max
            ratio = (silence_duration_ms - self.min_silence_ms) / (
                self.max_silence_ms - self.min_silence_ms
            )
            score += 0.3 * ratio

        # ── Signal 2: Sentence completeness ──
        # Ends with punctuation → likely complete
        if text[-1] in ".!?":
            score += 0.3
        elif text[-1] in ",;:":
            score += 0.1  # Partial completion

        # questions often signal turn completion
        question_words = {
            "what", "where", "when", "how", "why", "who", "can", "could", "would",
            "is", "are", "do", "does", "kya", "kab", "kahan", "kaise", "kyon",
            "kaun", "kabtak", "kitna",
        }
        first_word = text.split()[0].lower() if text.split() else ""
        if first_word in question_words or text.endswith("?"):
            score += 0.15

        # ── Signal 5: Trailing conjunction/preposition (incomplete) ──
        # Ends with "and", "but", "or", etc. or Hindi equivalents → likely incomplete
        trailing_incomplete = {
            "and", "but", "or", "so", "because", "when", "if", "the", "a", "an",
            "to", "for", "with", "ki", "par", "lekin", "aur", "agar", "jab",
            "kya", "toh", "hai",
        }
        last_word = text.split()[-1].lower().rstrip(".,!?") if text.split() else ""
        if last_word in trailing_incomplete:
            score -= 0.25  # Penalize — likely incomplete

        return max(0.0, min(1.0, score))

    def is_turn_complete(
        self,
        transcript: str,
        silence_duration_ms: float,
    ) -> bool:
        """
        Determine if the user's turn is complete.
        Returns True if confidence exceeds threshold.
        """
        confidence = self.compute_turn_complete_confidence(
            transcript, silence_duration_ms
        )

        # Always complete if silence exceeds max threshold
        if silence_duration_ms >= self.max_silence_ms:
            return True

        return confidence >= self.confidence_threshold

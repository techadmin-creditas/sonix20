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
from typing import Any, Set, Optional

logger = logging.getLogger(__name__)

# Verbal nods that should not trigger a full interruption or state change
_DEFAULT_BACKCHANNEL_WORDS: Set[str] = {
    "yeah", "mhm", "okay", "right", "sure", "theek hai", "ji", "haan",
    "theek", "understood", "got it", "hmm", "hm", "accha", "bilkul",
}


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
        min_silence_ms: float = 400,
        max_silence_ms: float = 1000,
        confidence_threshold: float = 0.7,
        extra_backchannels: Optional[list[str]] = None,
    ):
        self.min_silence_ms = min_silence_ms
        self.max_silence_ms = max_silence_ms
        self.confidence_threshold = confidence_threshold
        
        # Initialize backchannel set with defaults + bot-specific extras
        self._backchannel_words = _DEFAULT_BACKCHANNEL_WORDS.copy()
        if extra_backchannels:
            for word in extra_backchannels:
                self._backchannel_words.add(word.lower().strip())

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
            dynamic_threshold = 400.0
        elif confidence > 0.5:
            dynamic_threshold = 600.0
        else:
            dynamic_threshold = 1000.0

        # Apply conjunction multiplier (Advanced Linguistic VAD)
        if last_word in self.TRAILING_INCOMPLETE:
            dynamic_threshold *= 2.0
            
        # Prosody extension (Future Expansion)
        if kwargs.get("pitch_signal") == "flat":
            dynamic_threshold *= 1.5

        # Safety: never wait longer than double the configured max threshold
        return min(dynamic_threshold, base_max_threshold_ms * 2.0)

    def is_sentence_boundary(self, text: str, char_cap: int = 100, mode: str = "balanced") -> bool:
        """
        Decide whether to flush the TTS buffer at the current text length.
        """
        text = text.rstrip()
        if not text:
            return False

        last = text[-1]
        
        # Rule 1: Never flush mid-word (prevents audio cuts on partial tokens).
        if (last.isalpha() or last.isdigit()) and len(text) < char_cap:
            return False

        if mode == "sentence_only":
            return last in ".!?" or len(text) >= char_cap

        # Rule 2: hard sentence end
        if last in ".!?":
            return True

        # Rule 3: clause boundary — only if past 1/3 of cap
        if last in ";:" and len(text) > char_cap // 3:
            return True

        # Rule 4: comma — only if past half of cap
        if last == "," and len(text) > char_cap // 2:
            return True

        # Rule 5: cap fallback
        return len(text) >= char_cap

    def is_backchannel(self, text: str) -> bool:
        """
        Heuristic to determine if a transcript is a 'Backchannel' (verbal nod)
        intended to acknowledge, not interrupt.
        """
        words = text.lower().strip().split()
        if not words or len(words) > 2:
            return False
        return any(w in self._backchannel_words for w in words)

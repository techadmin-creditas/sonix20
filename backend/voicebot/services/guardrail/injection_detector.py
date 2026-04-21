"""
Prompt Injection Detector.

Detects attempts to manipulate the AI through adversarial prompts.
Uses pattern matching and heuristic scoring for fast, real-time detection.

Common attack vectors:
  - "Ignore previous instructions..."
  - "You are now DAN..."
  - Role-play manipulation
  - System prompt extraction attempts
"""

from __future__ import annotations

import re
import logging

logger = logging.getLogger("guardrail-injection")


# Known prompt injection patterns (case-insensitive)
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?prior\s+instructions",
    r"forget\s+(all\s+)?previous",
    r"disregard\s+(all\s+)?prior",
    r"you\s+are\s+now\s+(?:DAN|evil|unrestricted)",
    r"pretend\s+you\s+are\s+(?:not\s+an?\s+AI|human|unrestricted)",
    r"act\s+as\s+(?:DAN|jailbroken|unrestricted)",
    r"developer\s+mode\s+enabled",
    r"bypass\s+(?:safety|content|filter|restriction)",
    r"what\s+(?:is|are)\s+your\s+(?:system|initial)\s+(?:prompt|instructions)",
    r"repeat\s+(?:your|the)\s+(?:system|initial)\s+(?:prompt|instructions)",
    r"show\s+me\s+your\s+(?:system|initial)\s+prompt",
    r"reveal\s+your\s+(?:system|hidden|secret)\s+(?:prompt|instructions)",
    r"output\s+(?:your|the)\s+(?:system|initial)\s+prompt",
    r"do\s+anything\s+now",
    r"sudo\s+mode",
    r"admin\s+override",
    r"jailbreak",
]

COMPILED_PATTERNS = [
    re.compile(pattern, re.IGNORECASE) for pattern in INJECTION_PATTERNS
]


class InjectionDetector:
    """
    Detects prompt injection attempts using pattern matching.

    Returns a confidence score (0.0 - 1.0) indicating the likelihood
    of a prompt injection attempt.
    """

    def __init__(self, threshold: float = 0.4):
        self.threshold = threshold

    def check(self, text: str) -> dict:
        """
        Check text for prompt injection attempts.

        Returns:
            {
                "detected": bool,
                "confidence": float,
                "matched_patterns": list[str]
            }
        """
        if not text.strip():
            return {"detected": False, "confidence": 0.0, "matched_patterns": []}

        matched = []
        score = 0.0

        for i, pattern in enumerate(COMPILED_PATTERNS):
            if pattern.search(text):
                matched.append(INJECTION_PATTERNS[i])
                score += 0.4  # Each match adds significant confidence

        # Additional heuristic signals
        text_lower = text.lower()

        # Long inputs with instruction-like language
        if len(text) > 200 and any(
            kw in text_lower
            for kw in ["instruction", "prompt", "system", "ignore", "override"]
        ):
            score += 0.2

        # Contains code-like syntax (potential code injection)
        if any(marker in text for marker in ["```", "<script", "eval(", "exec("]):
            score += 0.3

        # Cap at 1.0
        confidence = min(1.0, score)
        detected = confidence >= self.threshold

        if detected:
            logger.warning(
                "Injection detected (conf=%.2f): '%s'",
                confidence,
                text[:80],
            )

        return {
            "detected": detected,
            "confidence": confidence,
            "matched_patterns": matched,
        }

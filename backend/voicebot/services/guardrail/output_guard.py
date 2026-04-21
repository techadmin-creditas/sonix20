"""
Output Guard Layer — Response Filtering and Masking.

Protects the user from potential LLM hallucinations, forbidden topics,
and ensures that sensitive bot-generated data is caught before TTS.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict

logger = logging.getLogger("guardrail-output")


class OutputGuard:
    """
    Validates and masks bot-generated responses.
    """

    def __init__(self, forbidden_patterns: list[str] = None):
        # Default forbidden patterns (PII, tokens, internal secrets)
        self.patterns = forbidden_patterns or [
            r"password: \w+",
            r"api_key: \w+",
            r"secret_key: \w+",
            r"bearer [A-Za-z0-9\-\.\_]+",
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", # Email
        ]

    def validate_and_mask(self, text: str) -> Dict[str, Any]:
        """
        Check if the text contains forbidden content and mask it.
        """
        detected = False
        masked_text = text

        for pattern in self.patterns:
            if re.search(pattern, text, re.IGNORECASE):
                detected = True
                masked_text = re.sub(pattern, "[MASKED]", masked_text, flags=re.IGNORECASE)

        if detected:
            logger.warning("Output Guard detected sensitive data in bot response!")

        return {
            "is_safe": not detected,
            "masked_text": masked_text,
            "violations_detected": detected
        }

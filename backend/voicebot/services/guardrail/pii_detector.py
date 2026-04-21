"""
PII Detector — Detects and masks Personally Identifiable Information.

Uses regex patterns to detect:
  - Credit/debit card numbers (Visa, MC, Amex, etc.)
  - OTPs (4-6 digit codes in context)
  - Email addresses
  - Phone numbers (Indian and international formats)
  - Aadhaar numbers (Indian national ID)
  - PAN numbers (Indian tax ID)
  - SSN (US Social Security Numbers)

All detected PII is replaced with type-specific masks
(e.g., "****-****-****-1234" for cards).
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger("guardrail-pii")


class PIIDetector:
    """
    Regex-based PII detection and masking engine.
    Fast enough for real-time use (~<5ms per check).
    """

    # Pre-compiled patterns for performance
    PATTERNS = {
        "credit_card": {
            "pattern": re.compile(
                r"\b(?:4[0-9]{12}(?:[0-9]{3})?|"  # Visa
                r"5[1-5][0-9]{14}|"  # MasterCard
                r"3[47][0-9]{13}|"  # Amex
                r"6(?:011|5[0-9]{2})[0-9]{12}|"  # Discover
                r"(?:2131|1800|35\d{3})\d{11})\b"  # JCB
            ),
            "mask": "****-****-****-XXXX",
            "severity": "critical",
        },
        "credit_card_spaced": {
            "pattern": re.compile(
                r"\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b"
            ),
            "mask": "****-****-****-XXXX",
            "severity": "critical",
        },
        "otp": {
            "pattern": re.compile(
                r"(?:otp|code|pin|verification|verify|confirm)\s*(?:is|:|-|=)?\s*(\d{4,6})\b",
                re.IGNORECASE,
            ),
            "mask": "[OTP REDACTED]",
            "severity": "critical",
        },
        "email": {
            "pattern": re.compile(
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
            ),
            "mask": "[EMAIL REDACTED]",
            "severity": "high",
        },
        "phone_indian": {
            "pattern": re.compile(
                r"\b(?:\+91[\s-]?)?[6-9]\d{9}\b"
            ),
            "mask": "[PHONE REDACTED]",
            "severity": "high",
        },
        "phone_international": {
            "pattern": re.compile(
                r"\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"
            ),
            "mask": "[PHONE REDACTED]",
            "severity": "high",
        },
        "aadhaar": {
            "pattern": re.compile(
                r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"
            ),
            "mask": "[AADHAAR REDACTED]",
            "severity": "critical",
        },
        "pan": {
            "pattern": re.compile(
                r"\b[A-Z]{5}\d{4}[A-Z]\b"
            ),
            "mask": "[PAN REDACTED]",
            "severity": "high",
        },
        "ssn": {
            "pattern": re.compile(
                r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"
            ),
            "mask": "[SSN REDACTED]",
            "severity": "critical",
        },
        "cvv": {
            "pattern": re.compile(
                r"(?:cvv|cvc|security\s*code)\s*(?:is|:|-|=)?\s*(\d{3,4})\b",
                re.IGNORECASE,
            ),
            "mask": "[CVV REDACTED]",
            "severity": "critical",
        },
    }

    def detect_and_mask(self, text: str) -> dict[str, Any]:
        """
        Detect PII in text and return masked version.

        Returns:
            {
                "detected": bool,
                "masked_text": str,
                "detections": [{"type": str, "severity": str, "match": str}]
            }
        """
        detections = []
        masked_text = text

        for pii_type, config in self.PATTERNS.items():
            matches = config["pattern"].findall(text)
            if matches:
                for match in matches:
                    match_str = match if isinstance(match, str) else match
                    detections.append({
                        "type": pii_type,
                        "severity": config["severity"],
                        "match": match_str[:4] + "****",  # Partial for logging
                    })
                # Replace all matches with the mask
                masked_text = config["pattern"].sub(config["mask"], masked_text)

        return {
            "detected": len(detections) > 0,
            "masked_text": masked_text,
            "detections": detections,
        }

    def has_sensitive_data(self, text: str) -> bool:
        """Quick check: does the text contain any PII?"""
        for config in self.PATTERNS.values():
            if config["pattern"].search(text):
                return True
        return False

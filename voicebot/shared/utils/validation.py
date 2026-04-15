"""
Shared validation utilities for the voice bot platform.
Includes checks for credentials, PII patterns, and common configuration errors.
"""

from __future__ import annotations
from typing import Optional
import re


def is_valid_api_key(key: Optional[str], service: str = "any") -> bool:
    """
    Validate that an API key is present and is not a known placeholder.
    
    Args:
        key: The API key to validate.
        service: Optional service name to target specific placeholder patterns.
        
    Returns:
        bool: True if the key is likely a functional, non-placeholder key.
    """
    if not key or not isinstance(key, str):
        return False
        
    k = key.strip().lower()
    
    # Common placeholder substrings that should never be part of a real key
    forbidden_patterns = [
        "your_openai_api_key",
        "your_openai_key",
        "your_groq_api_key",
        "your_groq_key",
        "your_openrouter_api_key",
        "your_openrouter_key",
        "your_anthropic_api_key",
        "your_anthropic_key",
        "your_gemini_api_key",
        "your_gemini_key",
        "your_key_here",
        "enter_key_here",
        "put_your_key",
        "sk-or-v1-placeholder",
        "demo_key",
        "12345",
        "dummy_",
        "placeholder",
    ]
    
    # Explicit check for the literal "your_key_here" which is sometimes found in .env.example
    if k == "":
        return False
        
    for p in forbidden_patterns:
        if p in k:
            return False
            
    # Generic length check (most real keys are > 20 chars; few are < 10)
    # OpenRouter keys: sk-or-... (>40 chars)
    # OpenAI keys: sk-... (>40 chars or newer)
    # Anthropic: sk-ant-... (>50 chars)
    if len(k) < 10:
        return False
        
    return True

"""Parse bot-level JSON policies from SQLite / API (guardrails, data access, conversation)."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional


def parse_json_dict(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value or "{}")
        except json.JSONDecodeError:
            return {}
    return {}


def output_guard_extra_patterns(policy: Dict[str, Any]) -> List[str]:
    raw = policy.get("output_forbidden_regex") or policy.get("output_patterns") or []
    if isinstance(raw, list):
        return [str(x) for x in raw if x]
    return []


def cache_ttl_seconds(policy: Dict[str, Any]) -> int:
    ttl = policy.get("semantic_cache_ttl_seconds")
    if ttl is not None:
        try:
            return max(60, min(int(ttl), 86400))
        except (TypeError, ValueError):
            pass
    return 3600


def kb_only_mode(policy: Dict[str, Any]) -> bool:
    return bool(policy.get("kb_only_factual", False))


def injection_enabled(policy: Dict[str, Any]) -> bool:
    return bool(policy.get("injection_check_enabled", False))


def injection_threshold(policy: Dict[str, Any]) -> float:
    try:
        return float(policy.get("injection_threshold", 0.4))
    except (TypeError, ValueError):
        return 0.4


def expand_env_in_str(s: str) -> str:
    """Replace ${VAR_NAME} with environment values."""

    def repl(m: re.Match) -> str:
        key = m.group(1)
        return os.environ.get(key, "")

    return re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}", repl, s)


def tts_flush_mode(policy: Dict[str, Any]) -> str:
    """balanced | sentence_only — see AgenticBrain._is_sentence_boundary.

    Default sentence_only: fewer TTS round-trips than flushing on every comma (balanced),
    which reduces audible gaps between phrase chunks in the browser.
    """
    raw = policy.get("tts_flush_mode")
    m = str(raw if raw is not None else "sentence_only").lower().strip()
    return m if m in ("balanced", "sentence_only") else "sentence_only"


def tts_streaming_mode(policy: Dict[str, Any]) -> str:
    """chunked | whole_turn — chunked streams TTS per segment; whole_turn batches one TTS per LLM leg."""
    m = str(policy.get("tts_streaming_mode") or "chunked").lower().strip()
    return m if m in ("chunked", "whole_turn") else "chunked"


def tts_pipeline_llm(policy: Dict[str, Any]) -> bool:
    """When True with chunked mode, LLM token loop runs ahead of TTS via a segment queue (less dead air)."""
    v = policy.get("tts_pipeline_llm")
    if v is None:
        return True
    return bool(v)

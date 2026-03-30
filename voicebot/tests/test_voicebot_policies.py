"""Lightweight policy / brain regression tests (no live STT/LLM)."""

from __future__ import annotations

import pytest

from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.shared.models.session import SessionState
from voicebot.shared.agent_task_spec import render_agent_task_spec_appendix
from voicebot.shared.policy import (
    cache_ttl_seconds,
    output_guard_extra_patterns,
    parse_json_dict,
    tts_flush_mode,
    tts_pipeline_llm,
    tts_streaming_mode,
)


def test_parse_json_dict() -> None:
    assert parse_json_dict(None) == {}
    assert parse_json_dict({"a": 1}) == {"a": 1}
    assert parse_json_dict('{"b": 2}') == {"b": 2}


def test_output_guard_extra_patterns() -> None:
    p = {"output_forbidden_regex": [r"ACME_INTERNAL"]}
    assert "ACME_INTERNAL" in output_guard_extra_patterns(p)


def test_cache_ttl_from_guardrail_policy() -> None:
    assert cache_ttl_seconds({"semantic_cache_ttl_seconds": 120}) == 120
    assert cache_ttl_seconds({}) == 3600


def test_render_agent_task_spec_appendix() -> None:
    assert render_agent_task_spec_appendix({}) == ""
    out = render_agent_task_spec_appendix({"spec_version": 1, "call_purpose": "Test goal"})
    assert "Task contract" in out
    assert "Test goal" in out


def test_tts_conversation_policy_helpers() -> None:
    assert tts_flush_mode({}) == "sentence_only"
    assert tts_flush_mode({"tts_flush_mode": "balanced"}) == "balanced"
    assert tts_flush_mode({"tts_flush_mode": "sentence_only"}) == "sentence_only"
    assert tts_streaming_mode({"tts_streaming_mode": "whole_turn"}) == "whole_turn"
    assert tts_pipeline_llm({}) is True
    assert tts_pipeline_llm({"tts_pipeline_llm": False}) is False
    assert tts_pipeline_llm({"tts_pipeline_llm": True}) is True


def test_is_sentence_boundary_sentence_only() -> None:
    b = AgenticBrain(
        SessionState(session_id="boundary-so"),
        bot_config={
            "conversation_policy": {"tts_flush_mode": "sentence_only", "max_tts_buffer_chars": 100},
        },
    )
    assert b._is_sentence_boundary("Hello world") is False
    assert b._is_sentence_boundary("Hello world.") is True
    assert b._is_sentence_boundary("x" * 100) is True
    assert b._is_sentence_boundary("a" * 50 + ",") is False


def test_is_sentence_boundary_balanced_comma() -> None:
    b = AgenticBrain(
        SessionState(session_id="boundary-bal"),
        bot_config={
            "conversation_policy": {"tts_flush_mode": "balanced", "max_tts_buffer_chars": 80},
        },
    )
    assert b._is_sentence_boundary("a" * 50 + ",") is True


def test_tool_scope_filters_weather() -> None:
    b = AgenticBrain(
        SessionState(session_id="test-scope"),
        memory_handler=None,
        bot_config={
            "id": "1",
            "tools_enabled": ["search_knowledge", "get_weather"],
            "data_access_policy": {"enabled_scopes": ["knowledge"]},
        },
    )
    names = {t.name for t in b._tools}
    assert "search_knowledge" in names
    assert "get_weather" not in names


@pytest.mark.asyncio
async def test_finalize_turn_writes_semantic_cache() -> None:
    class Mem:
        def __init__(self) -> None:
            self.cache: dict[str, str] = {}

        async def add_history(self, *args, **kwargs) -> None:
            pass

        async def set_cache(self, k: str, v: str, ttl: int = 3600) -> None:
            self.cache[k] = v

        async def get_cache(self, k: str) -> None:
            return None

    mem = Mem()
    b = AgenticBrain(
        SessionState(session_id="cache-test"),
        memory_handler=mem,
        bot_config={
            "id": "1",
            "guardrail_policy": {"semantic_cache_ttl_seconds": 600},
        },
    )
    ttl = cache_ttl_seconds(b._guardrail_policy)
    await b._finalize_turn("cached reply", 0.0, cache_key="deadbeef", cache_ttl_seconds=ttl)
    assert mem.cache.get("deadbeef") == "cached reply"

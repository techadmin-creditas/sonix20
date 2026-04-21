"""Tests for LLM fallback, barge-in merge, and static prompt cache."""

from __future__ import annotations

import asyncio
import pytest

from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.services.llm.fallback_provider import FallbackStreamingProvider
from voicebot.shared.exceptions import ServiceExhaustedError
from voicebot.shared.models.session import SessionState
from voicebot.shared.models.tools import LLMResponse


class _Exhausted:
    async def stream_completion(self, **kwargs):
        if True:
            raise ServiceExhaustedError("primary down")
        yield LLMResponse(content="")  # pragma: no cover


class _Ok:
    def __init__(self, text: str = "ok") -> None:
        self.text = text

    async def stream_completion(self, **kwargs):
        yield LLMResponse(content=self.text)


@pytest.mark.asyncio
async def test_fallback_provider_switches_on_service_exhausted():
    out: list[str] = []
    fb = FallbackStreamingProvider([_Exhausted(), _Ok("hi")], labels=["bad", "good"])
    async for ch in fb.stream_completion(
        system_prompt="s",
        messages=[{"role": "user", "content": "u"}],
    ):
        out.append(ch.content or "")
    assert "".join(out) == "hi"


def test_merge_barge_in_utterance_combines_final_and_partial():
    session = SessionState(session_id="test-merge")
    brain = AgenticBrain(
        session=session,
        bot_config={
            "id": "t1",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {},
        },
    )
    brain._barge_in_buffer = "stop"
    brain._partial_buffer = "I meant tomorrow"
    assert brain._merge_barge_in_utterance() == "stop I meant tomorrow"


def test_merge_barge_in_substring_dedup():
    session = SessionState(session_id="test-dedup")
    brain = AgenticBrain(
        session=session,
        bot_config={
            "id": "t2",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {},
        },
    )
    brain._barge_in_buffer = "hello there"
    brain._partial_buffer = "there"
    assert brain._merge_barge_in_utterance() == "hello there"


def test_latency_filler_context_buckets():
    session = SessionState(session_id="filler-ctx")
    brain = AgenticBrain(
        session=session,
        bot_config={
            "id": "tf1",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {},
        },
    )
    q = brain._pick_latency_watchdog_filler("hi", "kya yeh sahi hai?")
    assert q
    a = brain._pick_latency_watchdog_filler("en", "yes")
    assert a

    custom = AgenticBrain(
        session=SessionState(session_id="filler-custom"),
        bot_config={
            "id": "tf2",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {"latency_fillers": ["Only custom filler."]},
        },
    )
    assert custom._pick_latency_watchdog_filler("en", "anything") == "Only custom filler."


def test_static_system_prompt_cache_hit():
    session = SessionState(session_id="cache-hit")
    brain = AgenticBrain(
        session=session,
        bot_config={
            "id": "t3",
            "name": "TestBot",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {},
        },
    )
    session.detected_language = "hi"
    a = brain._get_static_system_prompt_fragment("hi")
    b = brain._get_static_system_prompt_fragment("hi")
    assert a == b
    assert len(brain._llm_static_prompt_cache) >= 1


@pytest.mark.asyncio
async def test_latency_watchdog_cancelled_when_stream_fails_before_token(monkeypatch):
    """Orphan watchdog must not run TTS after immediate stream failure."""
    emitted: list[str] = []

    class FailStream:
        async def stream_completion(self, **kwargs):
            if True:
                raise ServiceExhaustedError("rate limit")
            yield LLMResponse(content="")  # pragma: no cover

    session = SessionState(session_id="wd-test")
    brain = AgenticBrain(
        session=session,
        llm_handler=FailStream(),
        bot_config={
            "id": "t4",
            "guardrail_policy": {},
            "data_access_policy": {},
            "conversation_policy": {},
        },
    )

    async def _no_tts(text: str, turbo: bool = False) -> None:
        emitted.append(text)

    monkeypatch.setattr(brain, "_emit_tts_audio_stream", _no_tts)

    async def _noop_fatal(_e: Exception, _ctx: str = "") -> None:
        return

    monkeypatch.setattr(brain, "_handle_fatal_error", _noop_fatal)

    await brain._run_llm_turn()
    await asyncio.sleep(0.65)
    assert emitted == []

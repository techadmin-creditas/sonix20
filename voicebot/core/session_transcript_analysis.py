"""
On-demand and post-call transcript summary + intent using each bot's configured LLM.

Uses the same provider selection as voice turns (`voice_llm_factory._instantiate_voice_llm`).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Tuple

from voicebot.shared.config import get_settings
from voicebot.services.llm.voice_llm_factory import _instantiate_voice_llm

logger = logging.getLogger("voicebot.session_analysis")
settings = get_settings()


def make_summariser_llm(bot_config: dict) -> Any:
    """
    Resolve an LLM for summarization: bot's llm_provider + llm_model first,
    then OpenRouter (slash models / default), then Groq.
    """
    prov = str(bot_config.get("llm_provider") or "").lower().strip()
    model = (bot_config.get("llm_model") or "").strip()

    llm = _instantiate_voice_llm(prov, model, settings)
    if llm is not None:
        return llm

    if "/" in model and settings.openrouter_api_key:
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider

        return OpenRouterStreamingProvider(
            model=model or settings.openrouter_default_model
            or "meta-llama/llama-3.3-70b-instruct"
        )

    if settings.openrouter_api_key:
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider

        return OpenRouterStreamingProvider(
            model=settings.openrouter_default_model
            or "meta-llama/llama-3.3-70b-instruct"
        )

    from voicebot.services.llm.groq_provider import GroqStreamingProvider

    return GroqStreamingProvider(model="llama-3.3-70b-versatile")


def _parse_insight_lines(text: str) -> List[str]:
    """Turn model output into up to 5 plain insight strings."""
    out: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        for prefix in ("- ", "* ", "• ", "– "):
            if line.startswith(prefix):
                line = line[len(prefix) :].strip()
                break
        if len(line) > 2 and line[0].isdigit():
            # "1) foo" / "1. foo"
            for sep in (") ", ". ", "\t"):
                if sep in line[:4]:
                    line = line.split(sep, 1)[-1].strip()
                    break
        if line:
            out.append(line)
        if len(out) >= 5:
            break
    return out[:5]


def _parse_entity_tuples(text: str) -> List[Tuple[str, str]]:
    """
    Parse LLM JSON into (fact, category) rows. Categories are stored as
    ``session_extracted.<label>`` so they can be replaced on re-run without
    touching tool-created ``remember_user_fact`` rows.
    """
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    data: Any = None
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        i = t.find("[")
        j = t.rfind("]")
        if i >= 0 and j > i:
            try:
                data = json.loads(t[i : j + 1])
            except json.JSONDecodeError:
                return []
    if not isinstance(data, list):
        return []
    allowed = {
        "identity",
        "preference",
        "account",
        "contact",
        "schedule",
        "product",
        "other",
    }
    out: list[tuple[str, str]] = []
    for item in data[:8]:
        if not isinstance(item, dict):
            continue
        fact = str(item.get("fact", "")).strip()
        if not fact:
            continue
        raw_cat = str(item.get("category", "other")).strip().lower() or "other"
        if raw_cat not in allowed:
            raw_cat = "other"
        out.append((fact, f"session_extracted.{raw_cat}"))
    return out


def _llm_label(sum_llm: Any) -> str:
    prov = getattr(sum_llm, "provider", None) or type(sum_llm).__name__
    mod = (
        getattr(sum_llm, "model", None)
        or getattr(sum_llm, "model_name", None)
        or "?"
    )
    return f"{prov}:{mod}"


async def analyze_transcript_with_bot_llm(
    log_entries: List[Dict],
    bot_config: dict,
    *,
    respect_enable_post_call_flag: bool = True,
) -> tuple[str, str, List[str], bool, List[Tuple[str, str]]]:
    """
    Return (summary, intent, insights, llm_ran, entity_rows).

    ``entity_rows`` are (fact, category) pairs persisted as ``user_facts`` with
    categories ``session_extracted.*`` (replaced on each successful NLP run).

    ``llm_ran`` is True when the model completed all steps without error (used to set
    ``llm_analysis_at`` in session metadata so clients do not repeat work).

    When ``respect_enable_post_call_flag`` is True and ``ENABLE_POST_CALL_SUMMARY`` is
    False, returns defaults and llm_ran=False (automatic post-call archive).
    """
    transcript_text = "\n".join(
        f"{e['role']}: {e['content']}"
        for e in log_entries
        if e.get("role") in ("user", "assistant")
    )
    summary = "No meaningful conversation occurred."
    intent = "Unknown"
    insights: list[str] = []

    if len(log_entries) <= 1 or not transcript_text.strip():
        return summary, intent, insights, False, []

    if respect_enable_post_call_flag and not settings.enable_post_call_summary:
        logger.info(
            "Skipping LLM transcript analysis (ENABLE_POST_CALL_SUMMARY is False)."
        )
        return summary, intent, insights, False, []

    try:
        sum_llm = make_summariser_llm(bot_config)
        logger.info(
            "Transcript analysis (%s) using: %s",
            (bot_config.get("id") or bot_config.get("name") or "bot")[:16],
            _llm_label(sum_llm),
        )

        sum_prompt = (
            "Summarize the following conversation in exactly 1 or 2 concise sentences. "
            "Focus solely on the user's primary intent and the resolution. "
            "Do not add conversational filler:\n\n" + transcript_text
        )
        sum_parts: list[str] = []
        async for chunk in sum_llm.stream_completion(
            system_prompt="You are a concise summarizer.",
            messages=[{"role": "user", "content": sum_prompt}],
        ):
            if chunk.content:
                sum_parts.append(chunk.content)
        if sum_parts:
            summary = "".join(sum_parts).strip()

        intent_prompt = (
            "Based on the following conversation, provide a strict 1-3 word noun phrase "
            "representing the core operational intent (e.g. 'Password Reset', "
            "'Technical Inquiry', 'General Chat'). Output ONLY the tag:\n\n"
            + transcript_text
        )
        intent_parts: list[str] = []
        async for chunk in sum_llm.stream_completion(
            system_prompt="You are a concise intent classifier.",
            messages=[{"role": "user", "content": intent_prompt}],
        ):
            if chunk.content:
                intent_parts.append(chunk.content)
        if intent_parts:
            intent = "".join(intent_parts).strip()

        ins_prompt = (
            "Read this conversation transcript. Produce exactly 3 to 5 short insights, "
            "one per line, for an operations dashboard. Each line is one sentence about "
            "sentiment, friction, opportunity, risk, or recommended follow-up. "
            "No numbering, no markdown, no preamble—only the lines:\n\n"
            + transcript_text
        )
        ins_parts: list[str] = []
        async for chunk in sum_llm.stream_completion(
            system_prompt="You output only plain insight lines, one per line.",
            messages=[{"role": "user", "content": ins_prompt}],
        ):
            if chunk.content:
                ins_parts.append(chunk.content)
        if ins_parts:
            insights = _parse_insight_lines("".join(ins_parts))

        entity_rows: list[tuple[str, str]] = []
        try:
            ent_prompt = (
                "From the USER lines in this transcript only, extract durable factual entities "
                "(names, amounts, dates, preferences, account references, phone/email). "
                "Output ONLY valid JSON: an array of up to 8 objects, each "
                '{"fact": string, "category": string}. '
                "category must be one of: identity, preference, account, contact, schedule, product, other. "
                "Do not invent facts; skip if none. No markdown, no explanation.\n\n"
                + transcript_text
            )
            ent_parts: list[str] = []
            async for chunk in sum_llm.stream_completion(
                system_prompt="You output only a JSON array of entity objects.",
                messages=[{"role": "user", "content": ent_prompt}],
            ):
                if chunk.content:
                    ent_parts.append(chunk.content)
            if ent_parts:
                entity_rows = _parse_entity_tuples("".join(ent_parts))
        except Exception as ent_err:
            logger.warning("Entity extraction step failed: %s", ent_err)

    except Exception as llm_err:
        logger.error("LLM transcript analysis failed: %s", llm_err, exc_info=True)
        return summary, intent, insights, False, []

    return summary, intent, insights, True, entity_rows

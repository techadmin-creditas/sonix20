from __future__ import annotations

from typing import Iterable

ALLOWED_DISPOSITIONS: tuple[str, ...] = (
    "resolved_satisfied",
    "callback_requested",
    "user_declined",
    "payment_pending",
    "needs_assistance",
    "needs_more_time",
    "unknown",
)

_ALIASES: dict[str, str] = {
    "ended_success": "resolved_satisfied",
    "ended_successfully": "resolved_satisfied",
    "success": "resolved_satisfied",
    "satisfied": "resolved_satisfied",
    "callback": "callback_requested",
    "call_back_requested": "callback_requested",
    "callback_required": "callback_requested",
    "denied": "user_declined",
    "denied_to_talk": "user_declined",
    "refused": "user_declined",
    "ready_to_pay": "payment_pending",
    "pending_payment": "payment_pending",
    "pending_bills": "payment_pending",
    "needs_help": "needs_assistance",
    "more_assistance": "needs_assistance",
    "need_more_assistance": "needs_assistance",
    "need_more_time": "needs_more_time",
    "requested_more_time": "needs_more_time",
}

DISPOSITION_LLM_INSTRUCTION = (
    "You are a strict post-call outcome classifier.\n"
    "Read the conversation and output exactly one token from this list:\n"
    "- resolved_satisfied\n"
    "- callback_requested\n"
    "- user_declined\n"
    "- payment_pending\n"
    "- needs_assistance\n"
    "- needs_more_time\n"
    "- unknown\n"
    "Rules:\n"
    "1) Output only the token, no punctuation or explanation.\n"
    "2) If the conversation is ambiguous, output unknown.\n"
)


def _sanitize(raw: str) -> str:
    token = (raw or "").strip().lower()
    token = token.strip("`\"' \n\r\t")
    token = token.replace("-", "_").replace(" ", "_")
    return token


def _candidates(token: str) -> Iterable[str]:
    yield token
    if token.startswith("disposition:"):
        yield token.split(":", 1)[1].strip()
    if "." in token:
        yield token.split(".", 1)[-1]


def normalize_disposition(raw: str) -> str:
    token = _sanitize(raw)
    for candidate in _candidates(token):
        candidate = _sanitize(candidate)
        if candidate in ALLOWED_DISPOSITIONS:
            return candidate
        mapped = _ALIASES.get(candidate)
        if mapped:
            return mapped
    return "unknown"

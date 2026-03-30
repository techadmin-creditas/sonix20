"""Parse and render optional per-bot agent_task_spec JSON into a system-prompt appendix."""

from __future__ import annotations

import json
from typing import Any, Dict

from voicebot.shared.policy import parse_json_dict


def parse_agent_task_spec(value: Any) -> Dict[str, Any]:
    return parse_json_dict(value)


def render_agent_task_spec_appendix(spec: Dict[str, Any]) -> str:
    """Turn agent_task_spec into a structured block for the LLM (voice-friendly)."""
    if not spec:
        return ""
    ver = spec.get("spec_version", 1)
    lines = [
        "\n\n--- Task contract (follow for this voice session) ---",
        f"spec_version: {ver}",
    ]
    for key in (
        "call_purpose",
        "opening_script_hint",
        "verification_policy",
        "value_props",
        "objection_handling",
        "off_topic_behavior",
        "tool_policy",
        "exit_conditions",
        "max_persuasion_rounds",
        "escalation_triggers",
    ):
        val = spec.get(key)
        if val is None or val == "":
            continue
        if isinstance(val, (list, dict)):
            val = json.dumps(val, ensure_ascii=False)
        lines.append(f"{key}: {val}")
    lines.append(
        "Voice style: short natural sentences, no markdown or bullet lists, one question at a time when collecting information."
    )
    lines.append(
        "When the conversation is complete (user declined help, goal achieved, or polite exit), "
        "say a brief goodbye and call the end_voice_session tool with a short reason."
    )
    return "\n".join(lines)

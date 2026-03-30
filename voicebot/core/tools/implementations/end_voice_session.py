"""End the voice WebSocket session after the assistant has finished speaking."""

from __future__ import annotations

from typing import Any, Dict

from voicebot.core.tools.base import BaseTool


class EndVoiceSessionTool(BaseTool):
    """
    Signals the server to close the voice session after the current turn completes.
    The model should speak a brief goodbye in the same turn before or alongside this tool.
    """

    def __init__(self, session: Any = None, db: Any = None, data_access_policy: Any = None, brain: Any = None):
        super().__init__(session=session, db=db, data_access_policy=data_access_policy)
        self._brain = brain

    @property
    def name(self) -> str:
        return "end_voice_session"

    @property
    def description(self) -> str:
        return (
            "End the voice call gracefully after you have finished speaking a polite closing line "
            "(e.g. thank you, goodbye). Call only when the conversation is complete: user declined, "
            "goal achieved, or you are exiting per task instructions. Do not call mid-sentence before your goodbye."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Short reason: e.g. user_declined, goal_complete, polite_exit, user_disconnect",
                }
            },
            "required": ["reason"],
        }

    async def execute(self, **kwargs) -> str:
        reason = str(kwargs.get("reason") or "completed").strip() or "completed"
        if self._brain and hasattr(self._brain, "request_voice_session_end"):
            self._brain.request_voice_session_end(reason)
        return f"Voice session will end after this turn completes ({reason})."

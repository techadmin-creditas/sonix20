"""
Speech-to-speech bridge — implemented via OpenAI Realtime API.

See voicebot/services/voice/openai_realtime.py for the active implementation.
This stub is kept for legacy import compatibility only.
"""


class SpeechToSpeechNotAvailable(Exception):
    """Raised when S2S is requested but the provider cannot be reached."""

    def __init__(self) -> None:
        super().__init__(
            "Speech-to-speech mode requires OPENAI_API_KEY to be set."
        )

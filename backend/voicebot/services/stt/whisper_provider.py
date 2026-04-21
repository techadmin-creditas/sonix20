"""
Whisper STT Provider — Fallback for Deepgram.

Uses OpenAI's Whisper model for speech-to-text transcription.
This is a batch-based provider (not streaming), used as a fallback
when Deepgram is unavailable or for offline processing.

Latency: ~500-1500ms depending on audio length and model size.
"""

from __future__ import annotations

import asyncio
import io
import logging
import tempfile
from typing import Optional

from voicebot.shared.config import get_settings

logger = logging.getLogger("stt-whisper")
settings = get_settings()


class WhisperProvider:
    """
    Whisper-based STT provider.
    Processes audio in batches (not streaming).
    Supports local model or OpenAI Whisper API.
    """

    def __init__(
        self,
        model_size: str = "base",
        use_api: bool = False,
        api_key: Optional[str] = None,
    ):
        self.model_size = model_size or settings.stt.whisper_model_size
        self.use_api = use_api
        self.api_key = api_key
        self._model = None
        self._audio_buffer = bytearray()

    async def initialize(self) -> None:
        """Load the Whisper model (local mode)."""
        if not self.use_api:
            # Run model loading in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(
                None, self._load_model
            )
            logger.info("Whisper model loaded: %s", self.model_size)

    def _load_model(self):
        """Load the Whisper model (blocking, run in executor)."""
        try:
            import whisper
            return whisper.load_model(self.model_size)
        except ImportError:
            logger.error(
                "whisper package not installed. "
                "Install with: pip install openai-whisper"
            )
            return None

    async def send_audio(self, audio_bytes: bytes) -> None:
        """Buffer audio chunks for batch processing."""
        self._audio_buffer.extend(audio_bytes)

    async def transcribe_buffer(self) -> Optional[dict]:
        """
        Transcribe the accumulated audio buffer.

        Returns:
            dict with keys: text, language, confidence
            None if no audio or transcription fails
        """
        if not self._audio_buffer:
            return None

        audio_data = bytes(self._audio_buffer)
        self._audio_buffer.clear()

        if self.use_api:
            return await self._transcribe_api(audio_data)
        else:
            return await self._transcribe_local(audio_data)

    async def _transcribe_local(self, audio_data: bytes) -> Optional[dict]:
        """Transcribe using local Whisper model."""
        if not self._model:
            logger.error("Whisper model not loaded")
            return None

        try:
            # Write audio to temp file (Whisper requires file input)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
                f.write(audio_data)
                f.flush()

                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: self._model.transcribe(f.name),
                )

            return {
                "text": result["text"].strip(),
                "language": result.get("language", "en"),
                "confidence": 1.0,  # Whisper doesn't provide confidence
            }
        except Exception as e:
            logger.error("Whisper transcription failed: %s", e)
            return None

    async def _transcribe_api(self, audio_data: bytes) -> Optional[dict]:
        """Transcribe using OpenAI Whisper API."""
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files={"file": ("audio.wav", audio_data, "audio/wav")},
                    data={"model": "whisper-1"},
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

            return {
                "text": data.get("text", "").strip(),
                "language": "en",
                "confidence": 1.0,
            }
        except Exception as e:
            logger.error("Whisper API transcription failed: %s", e)
            return None

    async def disconnect(self) -> None:
        """Clean up resources."""
        self._audio_buffer.clear()
        self._model = None
        logger.info("Whisper provider disconnected")

"""
Deepgram TTS Provider.

Converts text to speech using Deepgram's Aura TTS API.
Optimized for ultra-low TTFT (Time to First Token).
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Optional

import httpx
from voicebot.shared.config import get_settings

from voicebot.shared.logging.logger import setup_logger
settings = get_settings()
logger = setup_logger("tts-deepgram", level=settings.log_level)


class DeepgramTTSProvider:
    """
    Async streaming interface to Deepgram's Aura TTS API.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "aura-asteria-en",
        output_format: str = "linear16",
        sample_rate: int = 16000,
    ):
        self.api_key = api_key or settings.deepgram_api_key
        if not self.api_key:
            logger.warning("Deepgram TTS initialized WITHOUT an API Key.")
        else:
            logger.info("Deepgram TTS initialized successfully.")
        
        self.model = model
        self.output_format = output_format
        self.sample_rate = sample_rate
        
        self._url = "https://api.deepgram.com/v1/speak"
        self._stopped = False

    async def stream_speech(
        self,
        text: str,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio chunks for the given text.
        """
        if not text.strip():
            return

        self._stopped = False

        params = {
            "model": self.model,
            "encoding": self.output_format,
            "sample_rate": self.sample_rate,
        }

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {"text": text}

        try:
            logger.info("Deepgram TTS starting: model=%s, text='%s'", self.model, text[:40])
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST", self._url, params=params, headers=headers, json=payload
                ) as response:
                    if response.status_code != 200:
                        logger.error("Deepgram TTS error status: %d", response.status_code)
                        # Avoid reading response here if it might hang
                        return

                    chunk_count = 0
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if self._stopped:
                            break
                        chunk_count += 1
                        if chunk_count % 5 == 0:
                            logger.debug("Received TTS chunk %d (size=%d bytes)", chunk_count, len(chunk))
                        yield chunk
                    logger.info("Deepgram TTS streaming complete (total chunks: %d)", chunk_count)

        except Exception as e:
            logger.error("Deepgram TTS streaming error: %s", e)

    async def stop(self) -> None:
        """Stop current TTS playback."""
        self._stopped = True

    async def disconnect(self) -> None:
        """Cleanup resources."""
        self._stopped = True
        logger.info("Deepgram TTS provider disconnected")

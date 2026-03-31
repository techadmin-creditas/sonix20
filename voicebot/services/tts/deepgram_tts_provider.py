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
        # Persistent HTTP client — reused across TTS calls to avoid TCP handshake
        # overhead (~150-300ms) on every synthesis.
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Lazy-init a persistent httpx client (HTTP/2 keepalive)."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
                http2=True,
            )
        return self._http_client

    async def stream_speech(
        self,
        text: str,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio chunks for the given text.
        Reuses a persistent HTTP client to avoid per-call TCP connection overhead.
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
            client = await self._get_http_client()
            async with client.stream(
                "POST", self._url, params=params, headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    logger.error("Deepgram TTS error status: %d", response.status_code)
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

        except httpx.HTTPStatusError as hse:
            try:
                error_body = await hse.response.aread()
                logger.error("Deepgram TTS API error (%d): %s", hse.response.status_code, error_body.decode())
            except Exception:
                logger.error("Deepgram TTS API error (%d)", hse.response.status_code)
        except Exception as e:
            logger.error("Deepgram TTS streaming error: %s", e)

    async def stop(self) -> None:
        """Stop current TTS playback."""
        self._stopped = True

    async def disconnect(self) -> None:
        """Cleanup resources and close the persistent HTTP client."""
        self._stopped = True
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None
        logger.info("Deepgram TTS provider disconnected")

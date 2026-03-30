"""
ElevenLabs Streaming TTS Provider.

Converts text to speech using ElevenLabs' streaming API.
Optimized for low latency:
  - Streams audio chunks as they're generated
  - Uses v1/text-to-speech/{voice_id}/stream endpoint
  - Supports PCM and MP3 output formats
  - Integrates with Redis audio cache for common phrases

Typical latency: ~200-400ms to first audio chunk.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import AsyncIterator, Optional

from voicebot.shared.config import get_settings

logger = logging.getLogger("tts-elevenlabs")
settings = get_settings()


class ElevenLabsStreamingProvider:
    """
    Async streaming interface to ElevenLabs Text-to-Speech API.

    Usage:
        provider = ElevenLabsStreamingProvider()
        async for audio_chunk in provider.stream_speech("Hello there!"):
            # Send audio_chunk to the client
            pass
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: str = "EXAVITQu4vr4xnSDxMaL",
        model_id: str = "eleven_multilingual_v2",
        output_format: str = "pcm_16000",
    ):
        self.api_key = api_key or settings.elevenlabs_api_key
        self.voice_id = voice_id or settings.elevenlabs_voice_id
        self.model_id = model_id
        self.output_format = output_format
        
        self._cache = None
        self._stopped = False
        self._url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream"

    # Redis audio cache TTL for pre-rendered phrases (1 hour default)
    _CACHE_TTL = 3600

    async def stream_speech(
        self,
        text: str,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio chunks for the given text.

        When a Redis cache backend is attached via set_cache(), commonly spoken
        phrases (greetings, disclaimers, hold messages) are served from cache
        on subsequent calls — eliminating the ElevenLabs round-trip entirely.

        Args:
            text: Text to convert to speech
            stability: Voice stability (0.0 = variable, 1.0 = stable)
            similarity_boost: How closely to match the voice (0.0 - 1.0)
            style: Style exaggeration (0.0 = none, 1.0 = max)

        Yields:
            bytes: Raw audio chunks (PCM or MP3 depending on output_format)
        """
        if not text.strip():
            return

        self._stopped = False

        # ── Redis audio cache check ──────────────────────────────────────────
        cache_key = f"tts_audio:{self.voice_id}:{hashlib.md5(text.encode()).hexdigest()}"
        if self._cache is not None:
            try:
                cached_audio = await self._cache.get_cache(cache_key)
                if cached_audio:
                    # Cache hit: decode from hex and yield in 4 KB chunks
                    logger.debug("TTS cache HIT for '%s' (%d chars)", text[:40], len(text))
                    raw = bytes.fromhex(cached_audio)
                    chunk_size = 4096
                    for i in range(0, len(raw), chunk_size):
                        if self._stopped:
                            return
                        yield raw[i : i + chunk_size]
                    return
            except Exception as cache_err:
                logger.debug("TTS cache read error (non-critical): %s", cache_err)

        # ── Stream from ElevenLabs API ───────────────────────────────────────
        import httpx

        url = f"{self._url}?output_format={self.output_format}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg" if "mp3" in self.output_format else "audio/pcm",
        }

        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": True,
            },
        }

        accumulated: list[bytes] = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        logger.error("ElevenLabs error %d: %s", response.status_code, error_text)
                        return

                    logger.info("ElevenLabs: HTTP %d response, model=%s, content-type=%s", response.status_code, self.model_id, response.headers.get("content-type"))
                    _chunk_count = 0
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if self._stopped:
                            logger.debug("TTS streaming stopped (interrupted)")
                            return
                        _chunk_count += 1
                        if _chunk_count == 1:
                            logger.info("ElevenLabs: First audio chunk received (%d bytes)", len(chunk))
                        accumulated.append(chunk)
                        yield chunk
                    logger.info("ElevenLabs: Streaming complete. Total chunks: %d", _chunk_count)

        except Exception as e:
            logger.error("ElevenLabs streaming error: %s", e)
            return

        # ── Cache the rendered audio for future calls ────────────────────────
        if self._cache is not None and accumulated:
            try:
                audio_hex = b"".join(accumulated).hex()
                await self._cache.set_cache(cache_key, audio_hex, ttl=self._CACHE_TTL)
                logger.debug("TTS cache SET for '%s' (%d bytes)", text[:40], len(audio_hex) // 2)
            except Exception as cache_err:
                logger.debug("TTS cache write error (non-critical): %s", cache_err)

    async def stop(self) -> None:
        """Stop current TTS streaming (called on interruption)."""
        self._stopped = True
        logger.debug("TTS stop signal sent")

    def set_cache(self, cache) -> None:
        """Attach a cache backend (Redis) for audio caching."""
        self._cache = cache

    async def disconnect(self) -> None:
        """Clean up resources."""
        self._stopped = True
        logger.info("ElevenLabs provider disconnected")

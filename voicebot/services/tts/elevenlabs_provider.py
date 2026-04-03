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
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.exceptions import AuthError, ServiceExhaustedError, VoiceBotError

logger = setup_logger("tts-elevenlabs", level="INFO")
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
        model_id: str = "eleven_flash_v2_5",
        output_format: str = "pcm_16000",
    ):
        self.api_key = api_key or settings.elevenlabs_api_key
        self.voice_id = voice_id or settings.elevenlabs_voice_id
        self.model_id = model_id
        self.output_format = output_format
        
        self._cache = None
        self._stopped = False
        # WebSocket URL for ElevenLabs
        self._ws_url = f"wss://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream-input?model_id={self.model_id}&output_format={self.output_format}"

    # Redis audio cache TTL for pre-rendered phrases (1 hour default)
    _CACHE_TTL = 3600

    async def stream_speech(
        self,
        text: str,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
        **kwargs,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio chunks for the given text via WebSocket.
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
                    logger.debug("TTS cache HIT for '%s'", text[:40])
                    raw = bytes.fromhex(cached_audio)
                    chunk_size = 4096
                    for i in range(0, len(raw), chunk_size):
                        if self._stopped:
                            return
                        yield raw[i : i + chunk_size]
                    return
            except Exception as cache_err:
                logger.debug("TTS cache read error: %s", cache_err)

        # ── WebSocket Stream from ElevenLabs ─────────────────────────────────
        import websockets
        import base64

        accumulated: list[bytes] = []
        try:
            # 🚀 PRODUCTION OPTIMIZATION: Persistent WebSocket
            # Reuse the connection if possible to skip TCP/TLS handshake (~200ms saving)
            # Reuse the connection if possible to skip TCP/TLS handshake (~200ms saving)
            # websockets >= 14.0 uses different state checks, .closed is safer than .open
            if not hasattr(self, "_ws") or self._ws is None or getattr(self._ws, "closed", True):
                if hasattr(self, "_ws") and self._ws:
                    logger.debug("Closing stale ElevenLabs connection...")
                logger.debug("Establishing new ElevenLabs WebSocket...")
                self._ws = await websockets.connect(self._ws_url)

            ws = self._ws
            
            # 1. Send initial configuration and text
            init_msg = {
                "text": text + " ",
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "style": style,
                    "use_speaker_boost": True,
                },
                "xi_api_key": self.api_key,
            }
            await ws.send(json.dumps(init_msg))
            
            # 2. Signal end of text to start generation immediately
            await ws.send(json.dumps({"text": ""}))

            # 3. Listen for audio chunks
            _chunk_count = 0
            while True:
                if self._stopped:
                    break
                
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=5.0)
                except asyncio.TimeoutError:
                    logger.warning("ElevenLabs WS recv timeout")
                    break
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("ElevenLabs WS connection closed prematurely")
                    self._ws = None
                    break
                
                data = json.loads(message)
                if data.get("audio"):
                    chunk = base64.b64decode(data["audio"])
                    _chunk_count += 1
                    if _chunk_count == 1:
                        logger.info("ElevenLabs (WS): First chunk received. Model: %s", self.model_id)
                    
                    accumulated.append(chunk)
                    yield chunk
                
                if data.get("isFinal"):
                    break

            logger.info("ElevenLabs (WS): Streaming complete. Total chunks: %d", _chunk_count)

        except Exception as e:
            logger.error("ElevenLabs WebSocket error: %s", e)
            self._ws = None # Drop the stale connection

            # FALLBACK to HTTP if WS fails (Resilience)
            logger.warning("Falling back to HTTP for TTS turn...")
            async for chunk in self._fallback_http_stream(text, stability, similarity_boost, style):
                accumulated.append(chunk)
                yield chunk

        # ── Cache the rendered audio ─────────────────────────────────────────
        if self._cache is not None and accumulated and not self._stopped:
            try:
                audio_hex = b"".join(accumulated).hex()
                await self._cache.set_cache(cache_key, audio_hex, ttl=self._CACHE_TTL)
            except Exception as cache_err:
                logger.debug("TTS cache write error: %s", cache_err)

    async def _fallback_http_stream(self, text, stability, similarity_boost, style):
        """Standard HTTP POST fallback for reliability."""
        import httpx
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream?output_format={self.output_format}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {"stability": stability, "similarity_boost": similarity_boost, "style": style}
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code == 200:
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if self._stopped: return
                        yield chunk

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

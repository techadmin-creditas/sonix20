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
        # 🛡️ Robustness: Strip trailing comments/whitespace if accidentally loaded from .env
        if self.api_key:
            self.api_key = self.api_key.split('#')[0].split(' ')[0].strip()
        self.voice_id = voice_id or settings.elevenlabs_voice_id
        
        # 🛡️ Validate model_id: If it looks like an LLM model, fallback to a safe TTS default.
        if model_id and any(x in model_id.lower() for x in ["llama", "gpt-", "claude", "gemini", "instruct", "instant", "versatile"]):
            logger.warning("Detected non-TTS model ID '%s' passed to ElevenLabs. Falling back to 'eleven_flash_v2_5'.", model_id)
            model_id = "eleven_flash_v2_5"
            
        self.model_id = model_id or "eleven_flash_v2_5"
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
        Stream audio chunks for the given text.
        PRIMARY: HTTP POST streaming (reliable, works on all plans).
        FAST PATH: WebSocket streaming (lower latency when available).

        NOTE: WS is currently disabled by default because the stream-input endpoint
        is rejecting connections (likely plan/model restriction). Set _use_ws_primary=True
        on the instance to re-enable WS once confirmed working.
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

        accumulated: list[bytes] = []

        # ── WS diagnostic fast-path (disabled until WS confirmed working) ────
        # To re-enable: set `provider._use_ws_primary = True` on the instance.
        if getattr(self, "_use_ws_primary", False):
            import websockets
            import base64
            _ws_ok = False
            try:
                logger.debug("ElevenLabs WS attempt (url=%s)...", self._ws_url[-60:])
                async with websockets.connect(self._ws_url) as ws:
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
                    await ws.send(json.dumps({"text": ""}))

                    _chunk_count = 0
                    while True:
                        if self._stopped:
                            break
                        try:
                            message = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        except asyncio.TimeoutError:
                            logger.warning("ElevenLabs WS recv timeout")
                            break
                        except websockets.exceptions.ConnectionClosed as cc:
                            # Log the close code/reason to diagnose WS rejections
                            logger.warning(
                                "ElevenLabs WS closed: code=%s reason=%r",
                                getattr(cc, "code", "?"),
                                getattr(cc, "reason", ""),
                            )
                            break

                        data = json.loads(message)
                        if data.get("audio"):
                            chunk = base64.b64decode(data["audio"])
                            _chunk_count += 1
                            if _chunk_count == 1:
                                logger.info("ElevenLabs (WS): First chunk. model=%s", self.model_id)
                            accumulated.append(chunk)
                            yield chunk
                        if data.get("isFinal"):
                            break

                if _chunk_count > 0:
                    _ws_ok = True
                    logger.info("ElevenLabs (WS): %d chunks streamed", _chunk_count)
                else:
                    logger.warning("ElevenLabs WS: 0 chunks — falling back to HTTP")
            except Exception as e:
                logger.error("ElevenLabs WS error: %s", e)

            if _ws_ok or self._stopped:
                # WS succeeded — cache and return
                if self._cache is not None and accumulated and not self._stopped:
                    try:
                        await self._cache.set_cache(cache_key, b"".join(accumulated).hex(), ttl=self._CACHE_TTL)
                    except Exception:
                        pass
                return

            # WS failed — fall through to HTTP below
            accumulated.clear()

        # ── PRIMARY: HTTP POST streaming ──────────────────────────────────────
        # Reliable on all ElevenLabs plans, ~200-400ms TTFA.
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
        """HTTP POST streaming — primary TTS path, works on all ElevenLabs plans."""
        import httpx
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream?output_format={self.output_format}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {"stability": stability, "similarity_boost": similarity_boost, "style": style}
        }
        logger.debug("ElevenLabs HTTP TTS: voice=%s model=%s len=%d", self.voice_id, self.model_id, len(text))
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code == 200:
                    _chunks = 0
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if self._stopped:
                            return
                        _chunks += 1
                        if _chunks == 1:
                            logger.info("ElevenLabs (HTTP): First chunk received. voice=%s", self.voice_id)
                        yield chunk
                    logger.info("ElevenLabs (HTTP): Streaming complete. Total chunks: %d", _chunks)
                else:
                    body = await response.aread()
                    logger.error(
                        "ElevenLabs HTTP error: status=%d voice=%s model=%s body=%s",
                        response.status_code, self.voice_id, self.model_id, body[:200]
                    )

    async def stop(self) -> None:
        """Stop current TTS streaming (called on interruption)."""
        self._stopped = True
        logger.debug("TTS stop signal sent")

    async def prewarm(self) -> None:
        """
        🚀 Pre-open the ElevenLabs WebSocket connection in the background.
        Called by the brain when the first LLM token arrives, so by the time
        a complete sentence is buffered (~300-500ms later), the TTS connection
        is already established — saving ~200ms TCP/TLS handshake latency.
        """
        try:
            if not hasattr(self, "_ws") or self._ws is None or getattr(self._ws, "closed", True):
                import websockets
                logger.debug("🚀 TTS WebSocket pre-warming...")
                self._ws = await websockets.connect(self._ws_url)
                logger.debug("🚀 TTS WebSocket pre-warmed successfully")
        except Exception as e:
            logger.debug("TTS prewarm failed (non-fatal): %s", e)
            self._ws = None

    def set_cache(self, cache) -> None:
        """Attach a cache backend (Redis) for audio caching."""
        self._cache = cache

    async def get_voices(self) -> List[Dict[str, str]]:
        """Fetch the available voice list from ElevenLabs API."""
        import httpx
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {"xi-api-key": self.api_key}
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    voices = []
                    for v in data.get("voices", []):
                        voices.append({
                            "id": v["voice_id"],
                            "name": v["name"],
                            "provider": "elevenlabs",
                            "preview_url": v.get("preview_url", ""),
                            "labels": v.get("labels", {})
                        })
                    return voices
                else:
                    logger.error("ElevenLabs get_voices error: %d", response.status_code)
                    return []
        except Exception as e:
            logger.error("ElevenLabs get_voices exception: %s", e)
            return []

    async def disconnect(self) -> None:
        """Clean up resources."""
        self._stopped = True
        logger.info("ElevenLabs provider disconnected")

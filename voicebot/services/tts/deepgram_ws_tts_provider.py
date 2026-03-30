"""
Deepgram WebSocket TTS Provider (Persistent Connection).

Maintains a single WebSocket to Deepgram's streaming TTS API for the entire
session lifetime, eliminating the per-segment HTTP connection overhead that
costs 200–400 ms with the HTTP POST provider.

Protocol:
  Client → {"type": "Speak",  "text": "..."}   → queues synthesis
  Client → {"type": "Flush"}                    → force-emit buffered audio
  Client → {"type": "Reset"}                    → discard buffered synthesis
  Server → binary frames                        → PCM audio bytes (~50 ms TTFS)
  Server → {"type": "Flushed"}                  → all audio for last Flush sent

Expected TTFS: ~50 ms (vs 200–400 ms for the HTTP provider).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Callable, Optional

from voicebot.shared.config import get_settings

logger = logging.getLogger("tts-deepgram-ws")
settings = get_settings()


class DeepgramWSTTSProvider:
    """
    Persistent WebSocket interface to Deepgram's streaming TTS API.

    Drop-in replacement for DeepgramTTSProvider.  Exposes the same
    `stream_speech(text)` interface plus `reset()` for interruptions and
    `connect()` / `disconnect()` for lifecycle management.

    Usage:
        provider = DeepgramWSTTSProvider()
        await provider.connect()
        async for chunk in provider.stream_speech("Hello there!"):
            await output(chunk)
        await provider.disconnect()
    """

    WS_BASE = "wss://api.deepgram.com/v1/speak"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "aura-asteria-en",
        sample_rate: int = 16000,
        encoding: str = "linear16",
    ) -> None:
        self.api_key = api_key or settings.deepgram_api_key
        self.model = model
        self.sample_rate = sample_rate
        self.encoding = encoding

        self._ws = None
        self._connected = False
        self._receive_task: Optional[asyncio.Task] = None

        # Audio chunks from the current Speak request land here.
        self._audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        # Signals that all audio for the last Flush has been delivered.
        self._flushed_event = asyncio.Event()
        # Protects concurrent speak() calls (only one segment at a time).
        self._speak_lock = asyncio.Lock()
        # Set while a Reset is in-flight; silences stale audio chunks.
        self._resetting = False

    # ─── Lifecycle ────────────────────────────────────────────────────────────

    async def connect(self) -> None:
        """Open the persistent TTS WebSocket for this session."""
        import websockets

        url = (
            f"{self.WS_BASE}"
            f"?model={self.model}"
            f"&encoding={self.encoding}"
            f"&sample_rate={self.sample_rate}"
        )
        headers = {"Authorization": f"Token {self.api_key}"}

        try:
            # Use `certifi` CA bundle so TLS verification works in dev
            # environments that may not have the expected system trust store.
            import ssl
            ssl_context: ssl.SSLContext | None = None
            try:
                import certifi  # type: ignore

                ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                ssl_context = None

            connect_kwargs: dict[str, object] = {
                "additional_headers": headers,
                "ping_interval": 20,
                "ping_timeout": 10,
            }
            if ssl_context is not None:
                connect_kwargs["ssl"] = ssl_context

            self._ws = await websockets.connect(url, **connect_kwargs)
            self._connected = True
            self._receive_task = asyncio.create_task(self._receive_loop())
            logger.info(
                "Connected to Deepgram WS TTS (model=%s, %dHz %s)",
                self.model, self.sample_rate, self.encoding,
            )
        except Exception as exc:
            logger.error("Failed to connect to Deepgram WS TTS: %s", exc)
            self._connected = False
            raise

    async def disconnect(self) -> None:
        """Close the TTS WebSocket at session end."""
        self._connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        # Unblock any waiting stream_speech caller.
        await self._audio_queue.put(None)
        logger.info("Disconnected from Deepgram WS TTS")

    # ─── Public API ───────────────────────────────────────────────────────────

    async def stream_speech(self, text: str) -> AsyncIterator[bytes]:
        """
        Send text for synthesis and yield audio chunks as they arrive.

        The connection is kept alive between calls so subsequent segments
        get audio in ~50 ms instead of the 200–400 ms for a new HTTP POST.
        """
        text = (text or "").strip()
        if not text or not self._connected:
            return

        async with self._speak_lock:
            self._flushed_event.clear()
            self._resetting = False

            # Drain any stale chunks from a previous call.
            while not self._audio_queue.empty():
                self._audio_queue.get_nowait()

            try:
                logger.debug("Deepgram WS TTS: sending text segment (model=%s, len=%d)", self.model, len(text))
                await self._ws.send(json.dumps({"type": "Speak", "text": text}))
                await self._ws.send(json.dumps({"type": "Flush"}))
            except Exception as exc:
                logger.error("WS TTS send error: %s", exc)
                self._connected = False
                return

            # Yield audio until the server signals Flushed.
            while True:
                try:
                    chunk = await asyncio.wait_for(
                        self._audio_queue.get(), timeout=10.0
                    )
                except asyncio.TimeoutError:
                    logger.warning("WS TTS: timeout waiting for audio chunk")
                    break

                if chunk is None:
                    # Sentinel — Flushed event received or disconnected.
                    break
                if not self._resetting:
                    yield chunk

    async def reset(self) -> None:
        """
        Discard Deepgram's synthesis buffer immediately (use on interruption).

        Sends a Reset command and marks in-flight audio as stale so
        stream_speech() stops yielding leftover chunks from the previous turn.
        """
        if not self._connected or not self._ws:
            return
        self._resetting = True
        try:
            await self._ws.send(json.dumps({"type": "Reset"}))
        except Exception as exc:
            logger.warning("WS TTS reset send error: %s", exc)
        # Unblock any waiting stream_speech caller.
        await self._audio_queue.put(None)
        logger.debug("WS TTS: Reset sent")

    async def stop(self) -> None:
        """Alias for reset() — matches HTTP provider interface."""
        await self.reset()

    # ─── Background receive loop ──────────────────────────────────────────────

    async def _receive_loop(self) -> None:
        """Receive audio frames and server control messages from Deepgram."""
        if not self._ws:
            return
        try:
            async for message in self._ws:
                if isinstance(message, bytes):
                    # Raw PCM audio frame.
                    await self._audio_queue.put(message)
                else:
                    try:
                        event = json.loads(message)
                    except json.JSONDecodeError:
                        continue
                    etype = event.get("type", "")
                    if etype == "Flushed":
                        # All audio for the last Speak+Flush sequence delivered.
                        await self._audio_queue.put(None)
                        self._flushed_event.set()
                    elif etype == "Metadata":
                        logger.debug("WS TTS metadata: %s", event)
                    elif etype == "Warning":
                        logger.warning("WS TTS warning: %s", event.get("description"))
                    elif etype == "Error":
                        logger.error("WS TTS error: %s", event.get("description"))
        except Exception as exc:
            if self._connected:
                logger.error("WS TTS receive error: %s", exc)
        finally:
            self._connected = False
            # Unblock any waiting stream_speech.
            await self._audio_queue.put(None)

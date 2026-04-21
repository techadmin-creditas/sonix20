"""
OpenAI Realtime API Bridge — speech-to-speech pipeline.

When `pipeline_mode == "speech_speech"` this module replaces the entire
STT → LLM → TTS stack with a single bidirectional WebSocket to OpenAI's
Realtime API (gpt-4o-realtime-preview).

Audio contract:
  Client  →  server : PCM16, 16 kHz, mono  (same as classic mode)
  Server  →  client : PCM16, 16 kHz, mono  (same as classic mode)

OpenAI Realtime uses PCM16 at 24 kHz internally, so resampling is applied
transparently in both directions.

Outbound JSON messages are identical to the classic pipeline so the
frontend works without any changes:
  {"type": "status",         "state": "listening|processing|speaking"}
  {"type": "transcript",     "text": "...", "is_final": bool}
  {"type": "bot_transcript", "text": "...", "is_final": bool}
  {"type": "log",            "tag": "[S2S]", "message": "...", "color": "..."}
  {"type": "error",          "message": "...", "code": "..."}
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import Any, Callable, Coroutine, Optional

from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("s2s-openai", level="INFO")

# Stable realtime model; override via bot_config["s2s_model"]
_DEFAULT_MODEL = "gpt-4o-realtime-preview-2024-12-17"
_OPENAI_SAMPLE_RATE = 24_000
_CLIENT_SAMPLE_RATE = 16_000

# Map Deepgram / ElevenLabs voice IDs → closest OpenAI Realtime voice
_VOICE_MAP: dict[str, str] = {
    "aura-asteria-en": "shimmer",
    "aura-luna-en":    "alloy",
    "aura-stella-en":  "sage",
    "aura-athena-en":  "coral",
}
_OPENAI_VOICES = {"alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"}


# ─── Audio resampling ────────────────────────────────────────────────────────

def _resample_pcm16(data: bytes, in_rate: int, out_rate: int) -> bytes:
    """
    Linear-interpolation resample for PCM16 mono audio.
    Handles 16 kHz ↔ 24 kHz conversions used by this bridge.
    Falls back to audioop when numpy is absent.
    """
    if not data or in_rate == out_rate:
        return data
    try:
        import numpy as np  # type: ignore
        samples = np.frombuffer(data, dtype="<i2").astype(np.float64)
        n_out = max(1, int(len(samples) * out_rate / in_rate))
        x_in  = np.linspace(0, len(samples) - 1, len(samples))
        x_out = np.linspace(0, len(samples) - 1, n_out)
        resampled = np.interp(x_out, x_in, samples).astype("<i2")
        return resampled.tobytes()
    except ImportError:
        try:
            import audioop  # type: ignore  # deprecated in 3.11, removed in 3.13
            out, _ = audioop.ratecv(data, 2, 1, in_rate, out_rate, None)
            return out
        except Exception:
            return data  # pass-through; audio quality degrades but session won't crash


def _resolve_voice(bot_config: dict) -> str:
    """Pick the OpenAI Realtime voice name from bot_config, with fallbacks."""
    # 1. Explicit s2s_voice field takes priority
    explicit = (bot_config.get("s2s_voice") or "").strip().lower()
    if explicit in _OPENAI_VOICES:
        return explicit

    # 2. Map from existing voice_id (Deepgram / ElevenLabs)
    vid = (bot_config.get("voice_id") or "").strip()
    mapped = _VOICE_MAP.get(vid.lower())
    if mapped:
        return mapped

    return "alloy"


# ─── Bridge class ────────────────────────────────────────────────────────────

class OpenAIRealtimeBridge:
    """
    Bridges a FastAPI WebSocket session to OpenAI's Realtime API.

    Lifecycle:
        bridge = OpenAIRealtimeBridge(...)
        ok = await bridge.connect()          # opens upstream WS, configures session
        # ... route audio / text via send_audio() / send_text_query() ...
        await bridge.disconnect()            # clean teardown
    """

    def __init__(
        self,
        api_key: str,
        session_id: str,
        bot_config: dict,
        send_json: Callable[[dict], Coroutine[Any, Any, None]],
        send_bytes: Callable[[bytes], Coroutine[Any, Any, None]],
        db: Any = None,
        language: str = "en",
    ) -> None:
        self._api_key    = api_key
        self.session_id  = session_id
        self._bot_config = bot_config
        self._send_json  = send_json
        self._send_bytes = send_bytes
        self._db         = db
        self._language   = language

        # Upstream WebSocket state
        self._ws = None
        self._connected          = False
        self._receive_task: Optional[asyncio.Task] = None
        self._session_ready      = asyncio.Event()

        # Response tracking (for interrupt support)
        self._response_active    = False
        self._current_response_id: Optional[str] = None

        # Bot transcript accumulation
        self._bot_transcript_buf = ""

        # ── Per-turn latency tracking (for live UI metrics) ─────────────
        # We anchor the turn at `input_audio_buffer.speech_stopped`.
        # Then compute:
        # - STT Latency: speech_stopped -> input_audio_transcription.completed
        # - LLM TTFT: speech_stopped -> first response.audio_transcript.delta
        # - TTS Latency: first transcript delta -> first response.audio.delta
        # - Total RTT: speech_stopped -> response.audio.done
        self._turn_start_ts: Optional[float] = None
        self._stt_first_ts: Optional[float] = None
        self._llm_first_ts: Optional[float] = None
        self._tts_first_ts: Optional[float] = None

        # Derived config
        self._voice = _resolve_voice(bot_config)
        self._model = (bot_config.get("s2s_model") or _DEFAULT_MODEL).strip()

    # ── Public API ────────────────────────────────────────────────────────

    async def connect(self) -> bool:
        """
        Open the OpenAI Realtime WebSocket, configure the session,
        and trigger the greeting. Returns True on success.
        """
        import websockets  # type: ignore

        url = f"wss://api.openai.com/v1/realtime?model={self._model}"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "OpenAI-Beta":   "realtime=v1",
        }

        try:
            self._ws = await websockets.connect(
                url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=10,
            )
            self._connected = True
            logger.info("Connected to OpenAI Realtime (model=%s, session=%s)",
                        self._model, self.session_id[:8])
        except Exception as exc:
            logger.error("OpenAI Realtime connect failed (session=%s): %s",
                         self.session_id[:8], exc)
            return False

        # Start receive loop BEFORE waiting for session.created
        self._receive_task = asyncio.create_task(self._receive_loop())

        try:
            await asyncio.wait_for(self._session_ready.wait(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.error("Timed out waiting for session.created (session=%s)", self.session_id[:8])
            await self.disconnect()
            return False

        # Configure session
        await self._ws.send(json.dumps(self._build_session_update()))
        logger.info("Session configured (voice=%s, session=%s)", self._voice, self.session_id[:8])

        # Trigger greeting
        await self._trigger_greeting()

        return True

    async def send_audio(self, audio_bytes: bytes) -> None:
        """
        Forward a raw PCM16 16 kHz audio chunk from the client to OpenAI.
        Resamples to 24 kHz before sending.
        """
        if not self._connected or not self._ws or not audio_bytes:
            return
        try:
            upsampled = _resample_pcm16(audio_bytes, _CLIENT_SAMPLE_RATE, _OPENAI_SAMPLE_RATE)
            b64 = base64.b64encode(upsampled).decode()
            await self._ws.send(json.dumps({
                "type":  "input_audio_buffer.append",
                "audio": b64,
            }))
        except Exception as exc:
            logger.warning("send_audio error (session=%s): %s", self.session_id[:8], exc)

    async def send_text_query(self, text: str) -> None:
        """
        Simulator mode: inject a text turn and force a bot response.
        Mirrors `text_query` handling in the classic pipeline.
        """
        if not self._connected or not self._ws or not text.strip():
            return
        try:
            # Simulator mode: there is no VAD speech_stopped event, so start a
            # measurement window right away.
            self._turn_start_ts = time.time()
            self._stt_first_ts = None
            self._llm_first_ts = None
            self._tts_first_ts = None

            # Echo transcript to client so UI shows the typed text
            await self._send_json({"type": "transcript", "text": text, "is_final": True})

            # Commit any pending audio buffer first to avoid race conditions
            await self._ws.send(json.dumps({"type": "input_audio_buffer.clear"}))

            # Create text conversation item
            await self._ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": text}],
                },
            }))

            # Force a response
            await self._ws.send(json.dumps({"type": "response.create"}))
            logger.info("Text query injected (session=%s): %s", self.session_id[:8], text[:60])
        except Exception as exc:
            logger.warning("send_text_query error (session=%s): %s", self.session_id[:8], exc)

    async def handle_interrupt(self) -> None:
        """
        Cancel the active OpenAI response (user barged in).
        """
        if not self._connected or not self._ws:
            return
        try:
            if self._response_active:
                await self._ws.send(json.dumps({"type": "response.cancel"}))
                logger.info("Interrupt sent to OpenAI (session=%s)", self.session_id[:8])
            self._response_active = False
            self._bot_transcript_buf = ""
            # Drop latency measurement window for interrupted turn.
            self._turn_start_ts = None
            self._stt_first_ts = None
            self._llm_first_ts = None
            self._tts_first_ts = None
            await self._send_json({"type": "status", "state": "listening"})
        except Exception as exc:
            logger.warning("handle_interrupt error (session=%s): %s", self.session_id[:8], exc)

    async def disconnect(self) -> None:
        """Clean up the upstream WebSocket and background task."""
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
        logger.info("OpenAI Realtime bridge disconnected (session=%s)", self.session_id[:8])

    # ── Internal helpers ─────────────────────────────────────────────────

    def _build_session_update(self) -> dict:
        """Build the session.update event payload from bot_config."""
        system_prompt = (
            self._bot_config.get("system_prompt")
            or f"You are {self._bot_config.get('name', 'an AI assistant')}, "
               f"a {self._bot_config.get('persona', 'helpful and friendly')} voice assistant. "
               "Keep responses concise and natural for spoken conversation. "
               "Never use markdown formatting."
        )

        # Language instruction
        lang = self._language
        if lang and lang != "en":
            system_prompt += (
                f"\n\nIMPORTANT: The user is speaking in '{lang}'. "
                f"Respond in '{lang}' only unless the user switches to English."
            )

        temp = float(self._bot_config.get("temperature") or 0.7)
        max_tok = int(self._bot_config.get("max_tokens") or 4096)

        return {
            "type": "session.update",
            "session": {
                "modalities":   ["text", "audio"],
                "instructions": system_prompt,
                "voice":        self._voice,
                "input_audio_format":  "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1",
                },
                "turn_detection": {
                    "type":                "server_vad",
                    "threshold":           0.5,
                    "prefix_padding_ms":   300,
                    "silence_duration_ms": 500,
                    "create_response":     True,
                },
                "temperature": temp,
                "max_response_output_tokens": min(max_tok, 4096),
            },
        }

    async def _trigger_greeting(self) -> None:
        """Send a response.create to make the bot deliver its opening greeting."""
        greeting = (self._bot_config.get("greeting") or "").strip()
        instructions = (
            f'Start the conversation with this exact greeting: "{greeting}"'
            if greeting
            else "Greet the user warmly and invite them to speak."
        )
        try:
            await self._ws.send(json.dumps({
                "type": "response.create",
                "response": {
                    "modalities":   ["text", "audio"],
                    "instructions": instructions,
                },
            }))
        except Exception as exc:
            logger.warning("Failed to trigger greeting (session=%s): %s",
                           self.session_id[:8], exc)

    # ── Receive loop ─────────────────────────────────────────────────────

    async def _receive_loop(self) -> None:
        """Background task: drain events from OpenAI Realtime and dispatch them."""
        if not self._ws:
            return
        try:
            async for raw in self._ws:
                try:
                    event = json.loads(raw)
                    await self._handle_openai_event(event)
                except json.JSONDecodeError:
                    logger.warning("Non-JSON from OpenAI Realtime (session=%s)", self.session_id[:8])
        except Exception as exc:
            if self._connected:  # not expected — log properly
                logger.error("OpenAI Realtime receive error (session=%s): %s",
                             self.session_id[:8], exc)
        finally:
            self._connected = False

    async def _handle_openai_event(self, event: dict) -> None:
        """Dispatch an OpenAI Realtime event to the appropriate handler."""
        t = event.get("type", "")

        # ── Session lifecycle ─────────────────────────────────────────────
        if t == "session.created":
            self._session_ready.set()
            logger.info("OpenAI session.created (session=%s)", self.session_id[:8])

        elif t == "session.updated":
            pass  # no-op; config acknowledged

        # ── VAD / user audio events ──────────────────────────────────────
        elif t == "input_audio_buffer.speech_started":
            await self._send_json({"type": "status", "state": "listening"})
            await self._send_json({
                "type": "log", "tag": "[VAD]",
                "message": "User speech detected", "color": "text-green-400",
            })

        elif t == "input_audio_buffer.speech_stopped":
            # Start latency measurements at end-of-user-speech.
            self._turn_start_ts = time.time()
            self._stt_first_ts = None
            self._llm_first_ts = None
            self._tts_first_ts = None

            await self._send_json({"type": "status", "state": "processing"})

        elif t == "input_audio_buffer.committed":
            pass  # acknowledged

        # ── User transcript ──────────────────────────────────────────────
        elif t == "conversation.item.input_audio_transcription.completed":
            transcript = (event.get("transcript") or "").strip()
            if transcript:
                if self._turn_start_ts is not None and self._stt_first_ts is None:
                    self._stt_first_ts = time.time()
                await self._send_json({
                    "type": "transcript", "text": transcript, "is_final": True,
                })
                await self._log_turn("user", transcript)
                logger.info("User said (session=%s): %s", self.session_id[:8], transcript[:80])

        elif t == "conversation.item.input_audio_transcription.failed":
            logger.warning("STT transcription failed (session=%s): %s",
                           self.session_id[:8], event.get("error", {}))

        # ── Bot response lifecycle ───────────────────────────────────────
        elif t == "response.created":
            self._response_active    = True
            self._bot_transcript_buf = ""
            self._current_response_id = event.get("response", {}).get("id")
            await self._send_json({"type": "status", "state": "speaking"})

        elif t == "response.audio_transcript.delta":
            delta = event.get("delta", "")
            if delta:
                if self._turn_start_ts is not None and self._llm_first_ts is None:
                    self._llm_first_ts = time.time()
                self._bot_transcript_buf += delta
                await self._send_json({
                    "type":     "bot_transcript",
                    "text":     self._bot_transcript_buf,
                    "is_final": False,
                })

        elif t == "response.audio_transcript.done":
            text = (event.get("transcript") or self._bot_transcript_buf).strip()
            if text:
                await self._send_json({
                    "type": "bot_transcript", "text": text, "is_final": True,
                })
                await self._log_turn("assistant", text)
                logger.info("Bot said (session=%s): %s", self.session_id[:8], text[:80])
            self._bot_transcript_buf = ""

        # ── Bot audio output ─────────────────────────────────────────────
        elif t == "response.audio.delta":
            b64 = event.get("delta", "")
            if b64:
                try:
                    raw = base64.b64decode(b64)
                    # Resample 24 kHz → 16 kHz for the client
                    client_pcm = _resample_pcm16(raw, _OPENAI_SAMPLE_RATE, _CLIENT_SAMPLE_RATE)
                    if self._turn_start_ts is not None and self._tts_first_ts is None:
                        self._tts_first_ts = time.time()
                    await self._send_bytes(client_pcm)
                except Exception as exc:
                    logger.warning("Audio delta decode error (session=%s): %s",
                                   self.session_id[:8], exc)

        elif t == "response.audio.done":
            # Emit live latency metrics for this turn.
            if self._turn_start_ts is not None:
                now = time.time()
                stt_ms = max(0.0, (self._stt_first_ts - self._turn_start_ts) * 1000) if self._stt_first_ts is not None else 0.0
                llm_ms = max(0.0, (self._llm_first_ts - self._turn_start_ts) * 1000) if self._llm_first_ts is not None else 0.0
                tts_ms = max(0.0, (self._tts_first_ts - self._llm_first_ts) * 1000) if (self._tts_first_ts is not None and self._llm_first_ts is not None) else 0.0
                total_ms = max(0.0, (now - self._turn_start_ts) * 1000)

                await self._send_json({
                    "type": "metrics",
                    "stt": round(stt_ms, 0),
                    "llm": round(llm_ms, 0),
                    "tts": round(tts_ms, 0),
                    "total": round(total_ms, 0),
                })

            # Reset measurement window for next turn.
            self._turn_start_ts = None
            self._stt_first_ts = None
            self._llm_first_ts = None
            self._tts_first_ts = None

            await self._send_json({"type": "status", "state": "listening"})

        # ── Response done ────────────────────────────────────────────────
        elif t == "response.done":
            self._response_active     = False
            self._current_response_id = None
            status = event.get("response", {}).get("status", "")
            if status == "cancelled":
                await self._send_json({"type": "status", "state": "listening"})

        elif t == "response.cancelled":
            self._response_active = False
            self._turn_start_ts = None
            self._stt_first_ts = None
            self._llm_first_ts = None
            self._tts_first_ts = None
            await self._send_json({"type": "status", "state": "listening"})

        # ── Rate limit info (informational) ─────────────────────────────
        elif t == "rate_limits.updated":
            limits = event.get("rate_limits", [])
            for lim in limits:
                if lim.get("remaining", 999) < 10:
                    logger.warning("OpenAI rate limit low (session=%s): %s",
                                   self.session_id[:8], lim)

        # ── Errors ──────────────────────────────────────────────────────
        elif t == "error":
            err = event.get("error", {})
            msg = err.get("message", "Unknown OpenAI Realtime error")
            code = err.get("code", "openai_error")
            logger.error("OpenAI Realtime error (session=%s): %s [%s]",
                         self.session_id[:8], msg, code)
            await self._send_json({
                "type":    "error",
                "message": f"Realtime API error: {msg}",
                "code":    "S2S_OPENAI_ERR",
            })

        else:
            logger.debug("Unhandled OpenAI event: %s (session=%s)", t, self.session_id[:8])

    # ── DB logging ───────────────────────────────────────────────────────

    async def _log_turn(self, role: str, text: str) -> None:
        if self._db and text:
            try:
                await self._db.log_turn(self.session_id, role, text)
            except Exception as exc:
                logger.warning("DB log_turn failed (session=%s): %s", self.session_id[:8], exc)

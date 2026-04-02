"""
Gemini Live speech-to-speech bridge (server-side).

This adapts `gemini code/gemini_live.py`-style Gemini Live streaming into the
existing `pipeline_mode == "speech_speech"` frontend protocol:
- Frontend -> backend:
  - binary PCM16 mono @16kHz audio frames
  - JSON { "type": "interrupt" }
  - JSON { "type": "text_query", "text": "..." } (simulator mode)
- Backend -> frontend:
  - JSON { "type": "status", "state": "listening|processing|speaking" }
  - JSON { "type": "transcript", "text": "...", "is_final": bool }
  - JSON { "type": "bot_transcript", "text": "...", "is_final": bool }
  - JSON { "type": "audio_interrupt" }
  - binary PCM16 mono @16kHz audio bytes
  - JSON { "type": "error", ... } on failures
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from array import array
from typing import Any, Callable, Coroutine, Optional

from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("s2s-gemini", level="INFO")

# Gemini demo plays returned audio at 24kHz; frontend expects 16kHz PCM16.
_GEMINI_OUT_SAMPLE_RATE = 24_000
_CLIENT_SAMPLE_RATE = 16_000
_CLIENT_CHANNELS = 1


def _resample_pcm16(data: bytes, in_rate: int, out_rate: int) -> bytes:
    """
    Linear-ish resample for PCM16 mono audio.
    Pure-Python implementation (no `audioop` dependency) with optional numpy
    acceleration when available.
    """
    if not data or in_rate == out_rate:
        return data

    try:
        import numpy as np  # type: ignore

        samples = np.frombuffer(data, dtype="<i2").astype(np.float64)
        n_out = max(1, int(len(samples) * out_rate / in_rate))
        x_in = np.linspace(0, len(samples) - 1, num=len(samples))
        x_out = np.linspace(0, len(samples) - 1, num=n_out)
        resampled = np.interp(x_out, x_in, samples).astype("<i2")
        return resampled.tobytes()
    except Exception:
        # Pure Python linear interpolation:
        # - decode PCM16 little-endian to int16 samples
        # - resample into out_rate space
        if len(data) % 2 != 0:
            data = data[:-1]
        if not data:
            return b""

        pcm = array("h")
        pcm.frombytes(data)
        if sys.byteorder != "little":
            pcm.byteswap()

        in_len = len(pcm)
        if in_len == 0:
            return b""

        n_out = max(1, int(in_len * out_rate / in_rate))
        if n_out == 1:
            v = max(-32768, min(32767, int(round(pcm[0]))))
            return array("h", [v]).tobytes()

        out = array("h")

        # Avoid float drift by computing x each iteration.
        denom = float(n_out - 1)
        for i in range(n_out):
            x = (i * float(in_len - 1)) / denom
            j = int(x)
            if j >= in_len - 1:
                v = int(round(pcm[in_len - 1]))
            else:
                frac = x - j
                v = int(round(pcm[j] * (1.0 - frac) + pcm[j + 1] * frac))
            if v < -32768:
                v = -32768
            elif v > 32767:
                v = 32767
            out.append(v)

        return out.tobytes()


# Map existing voice_id (Deepgram/ElevenLabs style) to Gemini Live prebuilt voice names.
# Gemini demo uses Puck/Charon/Kore/Fenrir/Aoede/Leda/Orus/Zephyr.
_VOICE_MAP: dict[str, str] = {
    # ElevenLabs-style aura voices
    "aura-asteria-en": "Puck",
    "aura-luna-en": "Charon",
    "aura-stella-en": "Kore",
    "aura-athena-en": "Fenrir",
}


class GeminiLiveS2SBridge:
    """
    Opens a Gemini Live session and forwards audio + transcripts to/from
    the voicebot frontend.
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
        gemini_model: Optional[str] = None,
    ) -> None:
        self._api_key = api_key
        self.session_id = session_id
        self._bot_config = bot_config or {}
        self._send_json = send_json
        self._send_bytes = send_bytes
        self._db = db
        self._language = language

        # Gemini Live model: allow per-bot override; otherwise use a safe default.
        # (Gemini demo default is "gemini-3.1-flash-live-preview", but we keep it configurable.)
        self._model = (gemini_model or self._bot_config.get("s2s_model") or "gemini-3.1-flash-live-preview").strip()

        # Prebuilt voice name required by Gemini Live.
        self._voice_name = self._resolve_voice_name()

        # Gemini system prompt/instructions.
        self._system_prompt = (self._bot_config.get("system_prompt") or "You are a helpful assistant.").strip()

        # Session + background tasks
        self._client = None
        self._session = None
        self._session_cm = None
        self._receive_task: Optional[asyncio.Task] = None
        self._send_audio_task: Optional[asyncio.Task] = None
        self._send_text_task: Optional[asyncio.Task] = None

        # Input queues
        self._audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self._text_queue: asyncio.Queue[Optional[str]] = asyncio.Queue()

        # Interrupt state: when true, suppress forwarding audio output until next turn completes.
        self._interrupt_suppression = False

        # Transcript accumulation
        self._user_transcript_buf = ""
        self._bot_transcript_buf = ""

    def _resolve_voice_name(self) -> str:
        vid = str(self._bot_config.get("voice_id") or "").strip().lower()
        mapped = _VOICE_MAP.get(vid)
        if mapped:
            return mapped
        # Default to the Gemini demo voice.
        return "Puck"

    async def connect(self) -> bool:
        """
        Open the Gemini Live WebSocket session and start background tasks.
        Returns True on successful session connection.
        """
        try:
            from google import genai
            from google.genai import types
        except Exception as exc:
            logger.error("Missing google-genai dependency: %s", exc)
            return False

        self._client = genai.Client(api_key=self._api_key)

        # Prepare queues and reset buffers
        self._interrupt_suppression = False
        self._user_transcript_buf = ""
        self._bot_transcript_buf = ""

        # Gemini Live config (audio + transcriptions)
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=self._voice_name
                    )
                )
            ),
            system_instruction=types.Content(parts=[types.Part(text=self._system_prompt)]),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                # Keep Gemini engaged while audio activity is present.
                turn_coverage="TURN_INCLUDES_ONLY_ACTIVITY",
            ),
            # Tools are intentionally not wired in STS mode (frontend tool panel expects classic pipeline).
            tools=[],
        )

        # Manually manage async context so we can keep the session alive after connect().
        self._session_cm = self._client.aio.live.connect(model=self._model, config=config)
        try:
            self._session = await self._session_cm.__aenter__()
        except Exception as exc:
            logger.error("Gemini Live connect failed (session=%s): %s", self.session_id[:8], exc)
            return False

        # Start background tasks
        self._send_audio_task = asyncio.create_task(self._send_audio_loop(types=types))
        self._send_text_task = asyncio.create_task(self._send_text_loop(types=types))
        self._receive_task = asyncio.create_task(self._receive_loop(types=types))

        # Start the conversation by sending the opening greeting (as JSON string
        # format used by the Gemini demo).
        greeting = (self._bot_config.get("greeting") or "").strip()
        if greeting:
            await self._text_queue.put(json.dumps({"text": greeting}))

        await self._send_json({"type": "status", "state": "listening"})
        return True

    async def disconnect(self) -> None:
        """Close the Gemini Live session and cancel tasks."""
        self._interrupt_suppression = True

        # Unblock loops
        await self._audio_queue.put(None)
        await self._text_queue.put(None)

        for t in (self._send_audio_task, self._send_text_task, self._receive_task):
            if t:
                t.cancel()
        for t in (self._send_audio_task, self._send_text_task, self._receive_task):
            if t:
                try:
                    await t
                except Exception:
                    pass

        # Close upstream session
        try:
            if self._session_cm:
                await self._session_cm.__aexit__(None, None, None)
        except Exception:
            pass

    async def send_audio(self, audio_bytes: bytes) -> None:
        """Queue a PCM16 mono @16kHz audio chunk coming from the frontend."""
        if not audio_bytes:
            return
        await self._audio_queue.put(audio_bytes)

    async def send_text_query(self, text: str) -> None:
        """
        Simulator mode: inject a text turn to make Gemini speak.
        Gemini demo enqueues a JSON string: {"text": "..."}.
        """
        if not text or not text.strip():
            return
        await self._text_queue.put(json.dumps({"text": text.strip()}))

    async def handle_interrupt(self) -> None:
        """
        Manual interruption requested by UI.
        We suppress forwarding of Gemini output audio until Gemini reports
        an `interrupted` or the next `turn_complete`.
        """
        self._interrupt_suppression = True
        self._user_transcript_buf = ""
        self._bot_transcript_buf = ""
        await self._send_json({"type": "status", "state": "listening"})
        await self._send_json({"type": "audio_interrupt"})

    # ──────────────────────────────────────────────────────────────
    # Internal loops
    # ──────────────────────────────────────────────────────────────

    async def _send_audio_loop(self, *, types: Any) -> None:
        """Stream queued audio chunks into Gemini Live session."""
        if not self._session:
            return
        try:
            while True:
                chunk = await self._audio_queue.get()
                if chunk is None:
                    return
                # Gemini Live expects PCM bytes with a matching mime_type.
                await self._session.send_realtime_input(
                    audio=types.Blob(
                        data=chunk,
                        mime_type="audio/pcm;rate=16000",
                    )
                )
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.error("Gemini send_audio error (session=%s): %s", self.session_id[:8], exc)

    async def _send_text_loop(self, *, types: Any) -> None:
        """Send queued text prompts into Gemini Live session."""
        if not self._session:
            return
        try:
            while True:
                text = await self._text_queue.get()
                if text is None:
                    return
                await self._session.send_realtime_input(text=text)
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.error("Gemini send_text error (session=%s): %s", self.session_id[:8], exc)

    async def _receive_loop(self, *, types: Any) -> None:
        """Receive Gemini events, forward transcripts + audio bytes to the client."""
        if not self._session:
            return
        try:
            # Gemini's `receive()` iterator can end after a turn; keep re-entering
            # so text queries after the first response still produce audio.
            while True:
                async for response in self._session.receive():
                    server_content = getattr(response, "server_content", None)
                    if not server_content:
                        continue

                    # Audio output parts (PCM16 at 24kHz per Gemini demo)
                    if getattr(server_content, "model_turn", None) and getattr(server_content.model_turn, "parts", None):
                        for part in server_content.model_turn.parts:
                            inline_data = getattr(part, "inline_data", None)
                            if not inline_data:
                                continue

                            audio_bytes = inline_data.data
                            if audio_bytes and not self._interrupt_suppression:
                                try:
                                    pcm16_out = _resample_pcm16(
                                        audio_bytes,
                                        in_rate=_GEMINI_OUT_SAMPLE_RATE,
                                        out_rate=_CLIENT_SAMPLE_RATE,
                                    )
                                    await self._send_bytes(pcm16_out)
                                except Exception:
                                    # Fail-open: ignore broken audio chunks.
                                    continue

                    # User transcript updates
                    input_trans = getattr(server_content, "input_transcription", None)
                    if input_trans and getattr(input_trans, "text", None):
                        self._user_transcript_buf = (input_trans.text or "").strip()
                        if self._user_transcript_buf:
                            await self._send_json({
                                "type": "transcript",
                                "text": self._user_transcript_buf,
                                "is_final": False,
                            })

                    # Bot transcript updates
                    output_trans = getattr(server_content, "output_transcription", None)
                    if output_trans and getattr(output_trans, "text", None):
                        self._bot_transcript_buf = (output_trans.text or "").strip()
                        if self._bot_transcript_buf:
                            await self._send_json({
                                "type": "bot_transcript",
                                "text": self._bot_transcript_buf,
                                "is_final": False,
                            })

                    # Interruption event (Gemini detected barge-in)
                    if getattr(server_content, "interrupted", False):
                        self._interrupt_suppression = True
                        await self._send_json({"type": "audio_interrupt"})
                        await self._send_json({"type": "status", "state": "listening"})

                    # Turn complete event: send final transcripts and resume audio forwarding.
                    if getattr(server_content, "turn_complete", False):
                        self._interrupt_suppression = False

                        if self._user_transcript_buf:
                            await self._send_json({
                                "type": "transcript",
                                "text": self._user_transcript_buf,
                                "is_final": True,
                            })
                            await self._log_turn_safe("user", self._user_transcript_buf)

                        if self._bot_transcript_buf:
                            await self._send_json({
                                "type": "bot_transcript",
                                "text": self._bot_transcript_buf,
                                "is_final": True,
                            })
                            await self._log_turn_safe("assistant", self._bot_transcript_buf)

                        # Reset buffers for the next turn.
                        self._user_transcript_buf = ""
                        self._bot_transcript_buf = ""

                        await self._send_json({"type": "status", "state": "listening"})

        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.error("Gemini receive_loop error (session=%s): %s", self.session_id[:8], exc)
            try:
                await self._send_json({
                    "type": "error",
                    "message": f"Gemini Live error: {exc}",
                    "code": "S2S_GEMINI_ERR",
                })
            except Exception:
                pass

    async def _log_turn_safe(self, role: str, text: str) -> None:
        if not self._db or not text:
            return
        try:
            await self._db.log_turn(self.session_id, role, text)
        except Exception:
            return


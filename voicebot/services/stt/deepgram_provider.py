"""
Deepgram Streaming STT Provider.

Uses Deepgram's real-time WebSocket API for ultra-low latency
speech-to-text transcription with:
  - Partial transcript streaming (interim results)
  - Language detection
  - Punctuation and formatting
  - Smart endpointing

Deepgram typically delivers TTFT (Time to First Transcript) in ~200ms.
"""

from __future__ import annotations

import asyncio
import json
import logging
import ssl
import websockets
from typing import Any, AsyncIterator, Callable, Optional

from voicebot.services.vad.silero_gate import SileroVADGate
from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError

logger = setup_logger("voicebot.stt.deepgram", level="INFO")
settings = get_settings()


class DeepgramStreamingProvider:
    """
    Async streaming interface to Deepgram's real-time transcription API.

    Usage:
        provider = DeepgramStreamingProvider(api_key="...")
        await provider.connect(on_transcript=callback)
        await provider.send_audio(audio_bytes)
        await provider.disconnect()
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        language: str = "en",
        model: str = "nova-2",
        sample_rate: int = 16000,
        channels: int = 1,
        encoding: str = "linear16",
    ):
        self.api_key = api_key or settings.deepgram_api_key
        self.language = language
        self.model = model
        self.sample_rate = sample_rate
        self.channels = channels
        self.encoding = encoding
        self.provider = "deepgram"

        self._ws = None
        self._connected = False
        self._on_transcript: Optional[Callable] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._vad_gate = SileroVADGate(threshold=500.0) # RMS energy gate; normal speech = 1000–8000
        self._is_user_talking = False
        self._silence_padding_frames = 0
        self.MAX_SILENCE_PADDING = 25          # 500 ms trailing silence buffer
        self._silent_frames_since_keepalive = 0
        # Send KeepAlive every ~5 s of silence (250 frames × 20 ms)
        self.KEEPALIVE_INTERVAL_FRAMES = 250
        # Grace period: always forward audio for first N frames of each turn
        # so Deepgram/VAD warm up before the user's first word is judged
        self._grace_frames_remaining = 0
        self.GRACE_FRAMES = 10                 # 200ms warmup — avoids TTS echo window

    async def connect(
        self,
        on_transcript: Optional[Callable] = None,
        detect_language: bool = True,
    ) -> None:
        """
        Open a WebSocket connection to Deepgram's streaming API.

        Args:
            on_transcript: Callback(text: str, is_final: bool, language: str, confidence: float)
            detect_language: Enable automatic language detection
        """
        import websockets

        self._on_transcript = on_transcript

        # Optimized for low-latency barge-in and accurate turn-taking.
        #
        # Note: Deepgram's listen WebSocket rejects some query params with HTTP 400
        # (notably `utterance_end_ms` / `no_delay` / `filler_words` for our current setup).
        # Keep to the known-good parameter set so STT actually connects and we get
        # real transcripts from mic audio.
        #
        # endpointing=300: 300 ms silence before sending a final.
        # punctuate=true: provides richer sentence boundaries.
        # vad_events=true: enable VAD events for better turn-taking.
        # Build language/detect_language params based on session language.
        #
        # • "auto" / "detect" / "multilingual" → detect_language=true only
        # • any specific language code         → language=<code> only
        _lang = (self.language or "hi").lower().strip() # Default to 'hi' (Hinglish) for this environment
        if _lang in ("auto", "detect", "multilingual"):
            _lang_params: dict = {"detect_language": "true"}
        elif _lang == "en":
            _lang_params = {"language": "hi"}
        elif _lang in ("hi", "hindi"):
            _lang_params = {"language": "hi"}
        elif _lang == "hi-in":
            _lang_params = {"language": "hi"}
        else:
            # Pin to the requested language; do NOT add detect_language alongside it.
            _lang_params = {"language": _lang}

        params = {
            "model": self.model or "nova-2",
            "encoding": "linear16",
            "sample_rate": "16000",
            "channels": "1",
            "interim_results": "true",
            "smart_format": "true",
            "punctuate": "true",
            "vad_events": "true",        # Fires SpeechStarted immediately for barge-in
            "endpointing": "150",        # Snappy production endpointing (150ms)
            **_lang_params,
        }
        logger.info("Deepgram Params: %s", params)
        # Filter out None values
        query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        url = f"wss://api.deepgram.com/v1/listen?{query}"

        headers = {"Authorization": f"Token {self.api_key}"}

        # websockets/ssl in some environments may not pick up the system trust store
        # correctly; using `certifi`'s CA bundle makes TLS verify work reliably.
        import ssl
        ssl_context: Optional[ssl.SSLContext] = None
        try:
            import certifi  # type: ignore

            ssl_context = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ssl_context = None

        try:
            connect_kwargs: dict[str, Any] = {
                "additional_headers": headers,
                "ping_interval": 20,
                "ping_timeout": 10,
            }
            if ssl_context is not None:
                connect_kwargs["ssl"] = ssl_context

            self._ws = await websockets.connect(url, **connect_kwargs)
            self._connected = True
            logger.info("Connected to Deepgram streaming API")

            # Start receiving transcripts in background
            self._receive_task = asyncio.create_task(self._receive_loop())

        except Exception as e:
            logger.error("Failed to connect to Deepgram: %s", e)
            self._connected = False
            raise

    def reset_vad(self) -> None:
        """
        Reset VAD state at the start of each listening turn.
        Call this whenever the bot transitions from speaking → listening so
        that Silero's internal model state (biased toward silence) is cleared.
        """
        self._vad_gate.reset_states()
        self._is_user_talking = False
        self._silence_padding_frames = 0
        self._grace_frames_remaining = self.GRACE_FRAMES
        self._silent_frames_since_keepalive = 0

    async def tick_keepalive(self) -> None:
        """
        Maintain the Deepgram connection during non-listening states (SPEAKING, PROCESSING)
        WITHOUT sending any audio bytes. Sends a KeepAlive JSON message every ~5s.
        """
        if not self._connected or not self._ws:
            return
        self._silent_frames_since_keepalive += 1
        if self._silent_frames_since_keepalive >= self.KEEPALIVE_INTERVAL_FRAMES:
            self._silent_frames_since_keepalive = 0
            try:
                await self._ws.send(json.dumps({"type": "KeepAlive"}))
                logger.debug("Sent KeepAlive to Deepgram")
            except Exception as e:
                logger.error("KeepAlive error: %s", e)
                self._connected = False

    async def finalize(self) -> None:
        """
        Send Finalize to Deepgram before starting a new listening turn.
        Flushes any buffered audio/transcripts from the previous period,
        preventing stale TTS-echo results from appearing in the new turn.
        """
        if not self._connected or not self._ws:
            return
        try:
            await self._ws.send(json.dumps({"type": "Finalize"}))
            logger.debug("Sent Finalize to Deepgram")
        except Exception as e:
            logger.error("Finalize error: %s", e)

    async def send_audio(self, audio_bytes: bytes) -> None:
        """
        Send an audio chunk to Deepgram for transcription.
        
        COST OPTIMIZATION: Only sends real PCM bytes to Deepgram when local VAD 
        detects speech (plus some trailing padding). This significantly reduces 
        Deepgram costs as idle/bot-speech silence is not billed as PCM.
        
        LOW LATENCY: Uses manual finalize() on transition from speech to silence
        (ignoring the trailing padding for finalization) to force immediate 
        transcription results without waiting for Deepgram endpointing.
        """
        if not self._connected or not self._ws:
            return

        # Track speech state via local Energy gate
        speech_detected = self._vad_gate.is_speech(audio_bytes)
        _was_talking = self._is_user_talking

        if speech_detected:
            self._is_user_talking = True
            # Reset padding whenever speech is detected
            # 20ms frames * padding = buffer_ms
            self._silence_padding_frames = self.MAX_SILENCE_PADDING
        else:
            if self._silence_padding_frames > 0:
                self._silence_padding_frames -= 1
            else:
                if self._is_user_talking:
                    self._is_user_talking = False

        # 🚀 AGGRESSIVE FORCE-FINALIZE:
        # We call finalize() as soon as the SPEECH is gone, EVEN IF we are still
        # sending padding frames. This tells Deepgram 'I am done speaking' 
        # instantly, while the padding frames ensure Deepgram hears the full 
        # acoustic decay (preventing cut-off suffixes).
        if _was_talking and not speech_detected:
             logger.debug("🧠 STT Latency Fix: Speech stopped, triggering immediate finalize.")
             asyncio.create_task(self.finalize())

        # GATED SEND: Only send audio bytes if there is speech or padding
        if speech_detected or self._silence_padding_frames > 0:
            self._silent_frames_since_keepalive = 0
            try:
                await self._ws.send(audio_bytes)
            except Exception as e:
                logger.error("Error sending audio to Deepgram: %s", e)
                self._connected = False
        else:
            # Silent: Maintain connection with zero-billed KeepAlive JSON messages
            await self.tick_keepalive()


    async def _receive_loop(self) -> None:
        """
        Background task that receives and processes transcripts from Deepgram.
        Runs continuously while the connection is open.
        """
        if not self._ws:
            return

        try:
            async for message in self._ws:
                try:
                    data = json.loads(message)
                    await self._process_response(data)
                except json.JSONDecodeError:
                    logger.warning("Non-JSON message from Deepgram: %s", message[:100])
        except Exception as e:
            if self._connected:
                logger.error("Deepgram receive error: %s", e)
        finally:
            self._connected = False

    async def _process_response(self, data: dict[str, Any]) -> None:
        """
        Process a response from Deepgram.

        Response types:
          - Results: Contains transcript alternatives
          - UtteranceEnd: Signals end of an utterance
          - SpeechStarted: VAD detected speech start
          - Metadata: Connection metadata
        """
        msg_type = data.get("type", "")

        if msg_type == "Results":
            channel = data.get("channel", {})
            alternatives = channel.get("alternatives", [])

            if not alternatives:
                return

            best = alternatives[0]
            transcript = best.get("transcript", "").strip()

            if not transcript:
                return

            is_final = data.get("is_final", False)
            confidence = best.get("confidence", 0.0)

            # Extract detected language
            detected_lang = data.get("channel", {}).get(
                "detected_language", self.language
            )

            logger.debug(
                "STT [%s]: '%s' (final=%s, conf=%.2f, lang=%s)",
                "FINAL" if is_final else "PARTIAL",
                transcript[:60],
                is_final,
                confidence,
                detected_lang,
            )

            if self._on_transcript:
                await self._on_transcript(
                    transcript, is_final, detected_lang, confidence
                )

        elif msg_type == "UtteranceEnd":
            logger.debug("Deepgram: utterance end detected")
            if self._on_transcript:
                await self._on_transcript("", True, self.language, 1.0, msg_type="utterance_end")

        elif msg_type == "SpeechStarted":
            logger.debug("Deepgram: speech started")
            if self._on_transcript:
                # Type "speech_started" to notify the brain immediately
                await self._on_transcript("", False, self.language, 1.0, msg_type="speech_started")

        elif msg_type == "Error":
             error_msg = data.get("message", "Unknown Deepgram Error")
             logger.error("Deepgram reported a terminal error: %s", error_msg)
             
             _err_lower = error_msg.lower()
             if "401" in _err_lower or "unauthorized" in _err_lower:
                  raise AuthError(f"Deepgram STT auth failed: {error_msg}")
             if "429" in _err_lower or "quota" in _err_lower or "credit" in _err_lower:
                  raise ServiceExhaustedError(f"Deepgram STT quota reached: {error_msg}")
             
             raise VoiceBotError(f"Deepgram STT terminal error: {error_msg[:100]}")

        elif msg_type == "Metadata":
            logger.info(
                "Deepgram metadata: request_id=%s",
                data.get("request_id", "unknown"),
            )

    async def disconnect(self) -> None:
        """Close the Deepgram WebSocket connection."""
        self._connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        if self._ws:
            try:
                # Send close frame to Deepgram
                await self._ws.send(json.dumps({"type": "CloseStream"}))
                await self._ws.close()
            except Exception:
                pass

        logger.info("Disconnected from Deepgram")

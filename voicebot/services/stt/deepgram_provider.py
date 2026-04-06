"""
Deepgram Streaming STT Provider (Lookback VAD Optimized).

Uses Deepgram's real-time WebSocket API for ultra-low latency
speech-to-text transcription with:
  - 300ms Ring Buffer (Lookback VAD) to save costs without clipping.
  - Microsecond RMS calculation (No heavy ML gates).
  - Partial transcript streaming (interim results).
  - Smart endpointing & Punctuation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import ssl
import time
import collections
import audioop  # Built-in fast math for audio RMS
import websockets
from typing import Any, Callable, Optional

try:
    import webrtc_audio_processing as wap  # type: ignore
except ImportError:  # optional native dep (requires swig to build on some platforms)
    wap = None  # type: ignore


class _PassthroughAudioProcessing:
    """No-op when webrtc_audio_processing is not installed."""

    def set_ns_level(self, _level: int) -> None:
        pass

    def process_stream(self, chunk: bytes) -> bytes:
        return chunk


from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.exceptions import VoiceBotError

logger = setup_logger("voicebot.stt.deepgram", level="DEBUG")
settings = get_settings()

DEFAULT_STT_RMS_VAD_THRESHOLD = 280.0
STREAM_FRAME_BYTES = 320  # 10 ms × 16 kHz × 16-bit mono


def resolve_stt_language_for_session(session_language: str, conversation_policy: Optional[dict] = None) -> str:
    pol = conversation_policy or {}
    mode = str(pol.get("stt_language_mode") or "").lower().strip()
    if mode in ("multilingual", "detect", "auto", "hinglish"):
        return "multilingual"
    return (session_language or "hi").lower().strip()


def deepgram_listen_language_params(listen_language: str) -> dict[str, str]:
    _lang = (listen_language or "hi").lower().strip()
    if _lang in ("auto", "detect", "multilingual"):
        return {"language": "multi"}
    if _lang == "en":
        # Note: Handled as hi for specific bot logic preference preserved from original
        return {"language": "hi"} 
    if _lang in ("hi", "hindi", "hi-in"):
        return {"language": "hi"}
    return {"language": _lang}


def extract_linear16_pcm_16k_mono(audio: bytes, *, raw_pcm: bool) -> bytes:
    """Sandbox / tests: same PCM format as live WebSocket."""
    if raw_pcm:
        if len(audio) % 2:
            raise ValueError("Raw PCM length must be a multiple of 2 (16-bit samples)")
        return audio
    import io
    import wave

    with wave.open(io.BytesIO(audio), "rb") as w:
        if w.getnchannels() != 1:
            raise ValueError("WAV must be mono")
        if w.getsampwidth() != 2:
            raise ValueError("WAV must be 16-bit PCM")
        if w.getframerate() != 16000:
            raise ValueError("WAV must be 16000 Hz")
        return w.readframes(w.getnframes())


async def transcribe_sandbox_via_streaming_provider(
    pcm_s16le_mono_16k: bytes,
    *,
    api_key: str,
    language: str,
    model: str,
    endpointing_ms: Optional[int],
    vad_rms_threshold: Optional[float],
) -> tuple[str, Optional[float], dict[str, str]]:
    """STT sandbox stack with terminal error propagation."""
    finals: list[tuple[str, float]] = []
    last_partial: str = ""
    lock = asyncio.Lock()
    terminal_error: Optional[str] = None

    async def on_tr(text: str, is_final: bool, lang: str, confidence: float, **kwargs: Any) -> None:
        nonlocal last_partial, terminal_error
        
        # Propagate terminal error from Provider background task to Sandbox caller
        if kwargs.get("msg_type") == "terminal_error":
            terminal_error = kwargs.get("error", "Unknown Deepgram Error")
            return

        if kwargs.get("msg_type") == "speech_started":
            return
            
        t = (text or "").strip()
        if not t:
            return
            
        async with lock:
            if is_final:
                finals.append((t, float(confidence or 0.0)))
            else:
                last_partial = t

    prov = DeepgramStreamingProvider(
        api_key=api_key,
        language=language,
        model=model,
        endpointing_ms=endpointing_ms,
        vad_rms_threshold=vad_rms_threshold,
        forward_all_pcm=True,  # Bypasses local VAD logic for tests
    )
    q = prov.streaming_listen_query_params()
    prov.reset_vad()
    await prov.connect(on_transcript=on_tr)
    try:
        pcm = pcm_s16le_mono_16k
        # Trailing silence helps Deepgram finish current turn
        pcm = pcm + b"\x00" * (STREAM_FRAME_BYTES * 30)
        
        for i in range(0, len(pcm), STREAM_FRAME_BYTES):
            if terminal_error:
                break
            chunk = pcm[i : i + STREAM_FRAME_BYTES]
            if len(chunk) < STREAM_FRAME_BYTES:
                chunk = chunk + b"\x00" * (STREAM_FRAME_BYTES - len(chunk))
            await prov.send_audio(chunk)
            if i % (STREAM_FRAME_BYTES * 25) == 0:
                await asyncio.sleep(0)
        
        if not terminal_error:
            await prov.finalize()
            await asyncio.sleep(1.2)
    finally:
        await prov.disconnect()

    if terminal_error:
        raise VoiceBotError(f"STT Sandbox failed: {terminal_error}")

    if not finals:
        if last_partial:
            return last_partial, None, q
        return "", None, q
        
    transcript = " ".join(t for t, _ in finals)
    last_conf = finals[-1][1]
    return transcript, last_conf, q


class DeepgramStreamingProvider:
    """Async streaming interface to Deepgram's real-time transcription API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        language: str = "en",
        model: str = "nova-2",
        sample_rate: int = 16000,
        channels: int = 1,
        encoding: str = "linear16",
        endpointing_ms: Optional[int] = None,
        vad_rms_threshold: Optional[float] = None,
        forward_all_pcm: bool = False,
    ):
        self.api_key = api_key or settings.deepgram_api_key
        self.language = language
        self.model = model
        self.sample_rate = sample_rate
        self.channels = channels
        self.encoding = encoding
        self.provider = "deepgram"
        
        _ep = int(endpointing_ms) if endpointing_ms is not None else 150
        self._endpointing_ms = max(100, min(500, _ep))
        
        _vad = float(vad_rms_threshold) if vad_rms_threshold is not None else DEFAULT_STT_RMS_VAD_THRESHOLD
        self._vad_rms_threshold = max(120.0, min(2000.0, _vad))
        self._forward_all_pcm = forward_all_pcm

        self._websocket = None
        self._connected = False
        self._on_transcript: Optional[Callable] = None
        self._receive_task: Optional[asyncio.Task] = None

        # --- The 300ms Ring Buffer (Lookback VAD) ---
        self._lookback_buffer = collections.deque(maxlen=30)
        self._is_streaming = False
        
        # Timing constants
        self._bot_stop_time = 0.0
        self._bot_cooldown = 0.2        # 200ms cooldown after bot speaks
        self._min_open_duration = 0.5   # Gate stays open for min 500ms
        self._padding_duration = 0.5    # Gate stays open 500ms after last speech
        
        # State tracking
        self._last_speech_time = 0.0
        self._gate_open_time = 0.0
        self._last_keepalive = 0.0
        self._last_final_transcript = ""

        # 🛠️ 1. Initialize WebRTC Audio Processing (optional)
        if wap is not None:
            self.ap = wap.AudioProcessingModule(enable_ns=True, enable_vad=False)
            self.ap.set_ns_level(2)
        else:
            logger.warning(
                "webrtc_audio_processing not installed; STT noise suppression disabled"
            )
            self.ap = _PassthroughAudioProcessing()

        # 🧠 2. Initialize Adaptive Noise Floor
        self._noise_floor = 0.0
        self._adaptive_multiplier = 1.8 

        # 📥 3. High-Speed Gearbox (10ms Frame Sync)
        # WebRTC NS strictly requires exactly 320 bytes (10ms @ 16kHz).
        # This buffer handles irregular incoming chunks (Twilio 20ms, browser bursts).
        self._audio_chunk_buffer = b""


        # Deprecated / Compatibility
        self._silence_padding_frames = 0
        self.MAX_SILENCE_PADDING = 25
        self._last_wall_keepalive_sent: float = 0.0
        self.KEEPALIVE_WALL_SEC = 4.5


    def streaming_listen_query_params(self) -> dict[str, str]:
        _lang_params = deepgram_listen_language_params(self.language or "hi")
        return {
            "model": self.model or "nova-2",
            "encoding": "linear16",
            "sample_rate": "16000",
            "channels": "1",
            "interim_results": "true",
            "smart_format": "true",
            "punctuate": "true",
            "vad_events": "true",
            "endpointing": str(self._endpointing_ms),
            **_lang_params,
        }

    async def flush_endpoint(self) -> None:
        """Sends 200ms of digital silence to Deepgram to force a final transcript."""
        if not self._websocket or self._websocket.state is not websockets.State.OPEN:
            return
        try:
            logger.debug("🚿 STT Pipe flushed with silence")
            silence = b"\x00" * 3200  # ~200ms of 16kHz mono
            await self._websocket.send(silence)
            self._bot_stop_time = time.time()  # Track when bot stopped
        except Exception as e:
            logger.debug("Failed to send silence flush: %s", e)

    def reset_buffer(self) -> None:
        """Discard any buffered lookback audio. Called at turn start/end."""
        self._lookback_buffer.clear()
        self._is_streaming = False
        self._last_speech_time = 0.0
        self._gate_open_time = 0.0
        self._last_final_transcript = ""
        self._audio_chunk_buffer = b""
        logger.debug("🧹 STT Buffer reset (lookback and sync buffer cleared)")


    async def connect(self, on_transcript: Optional[Callable] = None) -> None:
        self._on_transcript = on_transcript

        params = self.streaming_listen_query_params()
        logger.info("Deepgram Params: %s", params)
        
        query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        url = f"wss://api.deepgram.com/v1/listen?{query}"

        headers = {"Authorization": f"Token {self.api_key}"}

        ssl_context: Optional[ssl.SSLContext] = None
        try:
            import certifi
            ssl_context = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ssl_context = ssl.create_default_context()

        try:
            self._websocket = await websockets.connect(
                url, 
                additional_headers=headers,
                ssl=ssl_context,
                ping_interval=20,
                ping_timeout=10,
            )
            self._connected = True
            logger.info("✅ Connected to Deepgram streaming API")

            self._receive_task = asyncio.create_task(self._receive_loop())

        except Exception as e:
            logger.error("Failed to connect to Deepgram: %s", e)
            self._connected = False
            raise

    def reset_vad(self) -> None:
        """Alias for reset_buffer to maintain compatibility with Brain."""
        self.reset_buffer()

    def _get_rms(self, audio_bytes: bytes) -> float:
        """Ultra-fast math check (Microseconds overhead vs ML inference)."""
        try:
            return audioop.rms(audio_bytes, 2)
        except Exception:
            return 0.0

    async def send_audio(self, audio_bytes: bytes) -> None:
        """Push audio bytes to the Deepgram stream with low-latency RMS gating."""
        if not self._connected or not self._websocket or self._websocket.state is not websockets.State.OPEN:
            return

        # Sandbox Override (Bypasses VAD entirely)
        if self._forward_all_pcm:
            try:
                await self._websocket.send(audio_bytes)
            except Exception:
                self._connected = False
            return

        now = time.time()
        # 🛡️ Anti-Echo Gate: Ignore audio right after bot speaks
        if now - self._bot_stop_time < self._bot_cooldown:
            return

        # 📥 1. High-Speed Gearbox: Chunk arrivals into exact 10ms (320 bytes)
        # Twilio sends 20ms, Browsers send irregular bursts. WebRTC NS requires exactly 320.
        self._audio_chunk_buffer += audio_bytes

        while len(self._audio_chunk_buffer) >= STREAM_FRAME_BYTES:
            # Shift a frame from the buffer
            chunk = self._audio_chunk_buffer[:STREAM_FRAME_BYTES]
            self._audio_chunk_buffer = self._audio_chunk_buffer[STREAM_FRAME_BYTES:]

            # 🧹 2. Clean the audio frame using WebRTC
            try:
                clean_audio = self.ap.process_stream(chunk)
            except Exception as e:
                logger.warning(f"WebRTC NS failed, falling back to raw audio: {e}")
                clean_audio = chunk

            # 🎚️ 3. Get RMS of the CLEANED audio
            rms = self._get_rms(clean_audio)

            # 🧠 4. Update Adaptive Noise Floor (Only when gate is closed!)
            if not self._is_streaming:
                self._noise_floor = (0.95 * self._noise_floor) + (0.05 * rms)

            # 🎯 5. Calculate Dynamic Threshold
            dynamic_threshold = max(self._vad_rms_threshold, self._noise_floor * self._adaptive_multiplier)
            is_speech = rms > dynamic_threshold

            if is_speech:
                self._last_speech_time = now
                if not self._is_streaming:
                    logger.debug("🔊 STT Gate: OPEN (rms=%d, thresh=%d, flushing 300ms lookback)", rms, dynamic_threshold)
                    for buf_frame in self._lookback_buffer:
                        await self._websocket.send(buf_frame)
                    self._is_streaming = True
                    self._gate_open_time = now
                
                # Send the cleaned audio to Deepgram
                await self._websocket.send(clean_audio)
            else:
                if self._is_streaming:
                    silence_duration = now - self._last_speech_time
                    gate_duration = now - self._gate_open_time
                    
                    if silence_duration > self._padding_duration and gate_duration > self._min_open_duration:
                        logger.debug("💤 STT Gate: CLOSED (silence=%.2fs, rms=%d, thresh=%d)", silence_duration, rms, dynamic_threshold)
                        self._is_streaming = False
                    else:
                        await self._websocket.send(clean_audio)
                else:
                    # Save cleaned audio to lookback ring-buffer (costs $0)
                    self._lookback_buffer.append(clean_audio)
                    
                    # KeepAlive is only for prolonged silence to prevent timeout
                    if now - getattr(self, "_last_keepalive", 0.0) > 4.0:
                        await self._websocket.send(json.dumps({"type": "KeepAlive"}))
                        self._last_keepalive = now
                        logger.debug("💓 STT KeepAlive sent (Cost Saved)")



    async def finalize(self) -> None:
        """Triggered explicitly by brain.py when transitioning to Speaking or session end."""
        if not self._websocket or self._websocket.state is not websockets.State.OPEN:
            return
        try:
            await self._websocket.send(json.dumps({"type": "Finalize"}))
        except Exception as e:
            logger.debug("Finalize error: %s", e)

    async def _receive_loop(self) -> None:
        try:
            async for message in self._websocket:
                try:
                    data = json.loads(message)
                    await self._process_response(data)
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            if self._connected:
                logger.error("❌ Receive error: %s", e)
        finally:
            self._connected = False

    async def _process_response(self, data: dict[str, Any]) -> None:
        msg_type = data.get("type", "")

        if msg_type == "Results":
            alternatives = data.get("channel", {}).get("alternatives", [])
            if not alternatives:
                return

            best = alternatives[0]
            transcript = best.get("transcript", "").strip()
            if not transcript:
                return

            is_final = data.get("is_final", False)
            confidence = best.get("confidence", 0.0)
            detected_lang = data.get("channel", {}).get("detected_language", self.language)

            # Prevent duplicate identical final transcripts (common during manual finalize)
            if is_final:
                if transcript == self._last_final_transcript:
                    return
                self._last_final_transcript = transcript

            if self._on_transcript:
                await self._on_transcript(transcript, is_final, detected_lang, confidence)

        elif msg_type == "SpeechStarted":
            if self._on_transcript:
                await self._on_transcript("", False, self.language, 1.0, msg_type="speech_started")

        elif msg_type == "UtteranceEnd":
            if self._on_transcript:
                await self._on_transcript("", True, self.language, 1.0, msg_type="utterance_end")

        elif msg_type == "Error":
            error_msg = data.get("message", "Unknown Deepgram Error")
            logger.error("❌ Deepgram reported a terminal error: %s", error_msg)
            
            # 🔥 Pass to brain.py safely.
            if self._on_transcript:
                 await self._on_transcript(
                     "", True, self.language, 0.0, msg_type="terminal_error", error=error_msg
                 )
            
            self._connected = False
            return

    async def disconnect(self) -> None:
        """Close the Deepgram WebSocket connection."""
        self._connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        if self._websocket:
            try:
                await self._websocket.send(json.dumps({"type": "CloseStream"}))
                await self._websocket.close()
            except Exception:
                pass

        logger.info("Disconnected from Deepgram")

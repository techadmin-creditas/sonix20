import asyncio
import logging
import signal
import json
import sys
from typing import Optional

from livekit import api, rtc
from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.models.session import SessionState
from voicebot.core.orchestrator.brain import AgenticBrain, BotState
from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.shared.policy import parse_json_dict
from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider, resolve_stt_language_for_session
from voicebot.services.llm.groq_provider import GroqStreamingProvider
from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider

# --- Configuration ---
settings = get_settings()
logger = setup_logger("livekit-agent", level=settings.log_level)

class LiveKitVoiceAgent:
    """
    Standalone LiveKit Agent that connects a LiveKit Room to the AgenticBrain.
    """
    def __init__(self, room_name: str, bot_id: Optional[str] = None):
        self.room_name = room_name
        self.bot_id = bot_id
        self.session_id = f"lk-{room_name}"
        self.room = rtc.Room()
        
        # Audio Source (16kHz, mono) for publishing bot voice
        self.audio_source = rtc.AudioSource(16000, 1)
        self.track_published = asyncio.Event()
        
        self.brain: Optional[AgenticBrain] = None
        self.shutdown_event = asyncio.Event()
        self._handling_tracks = set() # Track SIDs we are already processing

    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        logger.info("New participant connected: %s", participant.identity)

    def _on_track_published(self, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        logger.info("Track published by %s: %s (%s)", participant.identity, publication.sid, publication.kind)
        # Force subscription
        if not publication.subscribed:
            publication.set_subscribed(True)

    def _on_track_subscribed(self, track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info("✅ SUBSCRIBED to audio track from %s (SID: %s)", participant.identity, track.sid)
            if track.sid not in self._handling_tracks:
                self._handling_tracks.add(track.sid)
                asyncio.create_task(self._handle_remote_audio(track))

    async def _heartbeat_loop(self):
        """Periodically log status and check for existing tracks."""
        while not self.shutdown_event.is_set():
            await asyncio.sleep(5.0)
            logger.info("💓 Agent Heartbeat (Room: %s, Participants: %d)", 
                        self.room_name, len(self.room.remote_participants))
            
            # Fallback discovery for missed events
            for participant in self.room.remote_participants.values():
                for pub in participant.track_publications.values():
                    if pub.kind == rtc.TrackKind.KIND_AUDIO:
                        if not pub.subscribed:
                            logger.info("  Retrying subscription for %s", pub.sid)
                            pub.set_subscribed(True)
                        elif pub.track and pub.track.sid not in self._handling_tracks:
                            logger.info("  Starting ingestion for missed track %s", pub.track.sid)
                            self._handling_tracks.add(pub.track.sid)
                            asyncio.create_task(self._handle_remote_audio(pub.track))

    async def start(self):
        """Main loop for the agent."""
        logger.info("Starting LiveKit Agent for room: %s", self.room_name)
        
        # 1. Initialize Brain
        db = SQLiteProvider()
        await db.initialize()
        await db.create_session(self.session_id, bot_id=self.bot_id)
        
        bot_config = await db.get_bot(self.bot_id) if self.bot_id else None
        if not bot_config:
            bots = await db.list_bots()
            bot_config = bots[0] if bots else {}
            
        session = SessionState(session_id=self.session_id)

        # Normalize TTS output to 10 ms frames (320 bytes at 16 kHz mono linear16).
        # 10 ms frames emit sooner when Deepgram WS sends small initial chunks,
        # preventing the ~80 ms silence gap before "Hi" that 20 ms (640-byte)
        # frames produce while waiting for the buffer to fill.
        _FRAME_BYTES = 320  # 10 ms × 16 000 Hz × 2 bytes/sample  (was 640 / 20 ms)
        _audio_buf: bytearray = bytearray()

        async def _emit_audio_frame(raw: bytes) -> None:
            n = len(raw)
            if n % 2 != 0:
                raw = raw[: n - 1]
                n -= 1
            if n == 0:
                return
            frame = rtc.AudioFrame(raw, 16000, 1, n // 2)
            await self.audio_source.capture_frame(frame)

        async def on_audio_output(audio_bytes: bytes):
            _audio_buf.extend(audio_bytes)
            while len(_audio_buf) >= _FRAME_BYTES:
                frame_data = bytes(_audio_buf[:_FRAME_BYTES])
                del _audio_buf[:_FRAME_BYTES]
                await _emit_audio_frame(frame_data)

        async def on_audio_interrupt():
            # Drop any partial frame sitting in the normalizer buffer so stale
            # audio bytes from the interrupted turn are never played.
            _audio_buf.clear()

        async def broadcast_data(data_type: str, payload: dict):
            try:
                if self.room.local_participant:
                    msg = json.dumps({"type": data_type, **payload})
                    await self.room.local_participant.publish_data(msg)
            except Exception as e:
                logger.error("Failed to broadcast data: %s", e)

        async def on_bot_transcript(text: str, is_final: bool):
            await broadcast_data("bot_transcript", {"text": text, "is_final": is_final})
            if is_final:
                logger.info("Bot said: %s", text)
                # Flush any sub-frame bytes held by the normalizer at turn end.
                if _audio_buf:
                    remainder = len(_audio_buf) % _FRAME_BYTES
                    pad = (_FRAME_BYTES - remainder) if remainder else 0
                    await _emit_audio_frame(bytes(_audio_buf) + b"\x00" * pad)
                    _audio_buf.clear()

        async def on_transcript(text: str, is_final: bool):
            await broadcast_data("transcript", {"text": text, "is_final": is_final})

        async def on_log(tag: str, message: str, color: str):
            await broadcast_data("log", {"tag": tag, "message": message, "color": color})

        async def on_metrics(metrics: dict):
            if metrics.get("type") == "audio_handoff":
                await broadcast_data("audio_handoff", {})
            await broadcast_data("metrics", metrics)

        # 🚀 DYNAMIC PROVIDER SELECTION (Based on bot_config)
        # 1. STT Provider
        _lk_pol = parse_json_dict(bot_config.get("conversation_policy") or {})
        _session_lang = (bot_config.get("default_language") or "hi").lower()
        _stt_lang = resolve_stt_language_for_session(_session_lang, _lk_pol)
        _ep = _lk_pol.get("stt_endpointing_ms")
        try:
            _ep_i = int(_ep) if _ep is not None else None
        except (TypeError, ValueError):
            _ep_i = None
        _vad = _lk_pol.get("stt_rms_vad_threshold")
        try:
            _vad_f = float(_vad) if _vad is not None else None
        except (TypeError, ValueError):
            _vad_f = None
        stt_provider = DeepgramStreamingProvider(
            language=_stt_lang,
            endpointing_ms=_ep_i,
            vad_rms_threshold=_vad_f,
        )

        # 2. LLM Provider
        _llm_prov = str(bot_config.get("llm_provider") or "").lower()
        _llm_model = bot_config.get("llm_model") or "llama-3.3-70b-versatile"
        
        if _llm_prov == "openai":
            from voicebot.services.llm.openai_provider import OpenAIStreamingProvider
            llm_provider = OpenAIStreamingProvider(model=_llm_model)
        elif _llm_prov == "gemini":
            from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
            llm_provider = GeminiStreamingProvider(model=_llm_model)
        elif _llm_prov == "anthropic":
            from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
            llm_provider = AnthropicStreamingProvider(model=_llm_model)
        else:
            # High-perf default (Groq)
            llm_provider = GroqStreamingProvider(model=_llm_model)

        from voicebot.services.llm.voice_llm_factory import wrap_llm_with_fallbacks

        llm_provider = wrap_llm_with_fallbacks(llm_provider, bot_config, settings)

        # 3. TTS Provider (Hindi-Aware)
        _voice_id = bot_config.get("voice_id") or "aura-asteria-en"
        _tts_prov_name = str(bot_config.get("tts_provider") or "").lower()
        _is_hindi_bot = _session_lang.startswith("hi")

        if _is_hindi_bot or _tts_prov_name == "elevenlabs":
            from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
            tts_provider = ElevenLabsStreamingProvider(
                voice_id=_voice_id,
                model_id="eleven_multilingual_v2"
            )
            logger.info("Using ElevenLabs TTS (Multilingual v2) ✅")
        elif _tts_prov_name == "deepgram_http":
            tts_provider = DeepgramTTSProvider(model=_voice_id)
            logger.info("Using Deepgram HTTP TTS ✅")
        else:
            # Default to WebSocket for lowest latency
            from voicebot.services.tts.deepgram_ws_tts_provider import DeepgramWSTTSProvider
            tts_provider = DeepgramWSTTSProvider(model=_voice_id)
            try:
                await asyncio.wait_for(tts_provider.connect(), timeout=5.0)
                logger.info("Using Deepgram WS TTS (model=%s) ✅", _voice_id)
            except Exception as _tts_err:
                logger.warning("TTS WS failed, falling back to HTTP: %s", _tts_err)
                tts_provider = DeepgramTTSProvider(model=_voice_id)

        # 4. Optional: Guardrails & Caching (Parity with main.py)
        from voicebot.services.memory.redis_provider import RedisSessionProvider
        memory = RedisSessionProvider(redis_url=settings.redis_url)
        await memory.connect()
        if hasattr(tts_provider, "set_cache"):
            tts_provider.set_cache(memory)

        self.brain = AgenticBrain(
            session=session,
            stt_handler=stt_provider,
            llm_handler=llm_provider,
            tts_handler=tts_provider,
            memory_handler=memory,
            db_handler=db,
            bot_config=bot_config,
            on_audio_output=on_audio_output,
            on_audio_interrupt=on_audio_interrupt,
            on_bot_transcript=on_bot_transcript,
            on_transcript=on_transcript,
            on_log=on_log,
            on_metrics=on_metrics
        )

        # 2. Connect STT eagerly before participants join (avoids race condition and first-frame loss)
        async def stt_callback(text, is_final, lang, confidence, **kwargs):
            await self.brain.process_stt_partial(text, is_final, **kwargs)

        try:
            await asyncio.wait_for(
                self.brain.stt.connect(on_transcript=stt_callback), timeout=10.0
            )
            logger.info("✅ Deepgram STT Connected (eager init)")
        except Exception as e:
            logger.error("❌ Deepgram STT failed to connect: %s", e)

        # 3. Register Listeners & Connect
        self.room.on("participant_connected", self._on_participant_connected)
        self.room.on("track_published", self._on_track_published)
        self.room.on("track_subscribed", self._on_track_subscribed)

        token = (
            api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity("agent-bot")
            .with_name("Voice Bot")
            .with_grants(api.VideoGrants(room_join=True, room=self.room_name, can_subscribe=True, can_publish=True))
            .to_jwt()
        )

        url = settings.livekit_url or "ws://localhost:7880"
        logger.info("Connecting to LiveKit Room: %s at %s...", self.room_name, url)
        
        try:
            # Add a timeout so we don't hang forever
            await asyncio.wait_for(self.room.connect(url, token), timeout=15.0)
            logger.info("✅ Connected to room: %s", self.room.name)
            
            # Start Background Tasks
            asyncio.create_task(self._heartbeat_loop())
            
            # Publish Agent's Track
            await self.room.local_participant.publish_track(
                rtc.LocalAudioTrack.create_audio_track("agent-voice", self.audio_source)
            )
            
            # Greeting
            await self.brain.start_conversation()
            
            await self.shutdown_event.wait()
        except Exception as e:
            logger.error("Room failure: %s", e)
        finally:
            await self.room.disconnect()
            await db.close()

    async def _handle_remote_audio(self, track: rtc.RemoteAudioTrack):
        """Receive audio from the user and push to Brain's STT."""
        # Exponential backoff instead of a hard 1 s sleep.
        # First attempt at 100 ms so the user's first syllables are not lost.
        audio_stream = None
        for wait in (0.1, 0.2, 0.4, 0.8, 1.6):
            try:
                audio_stream = rtc.AudioStream(track)
                logger.info("✅ Audio stream LIVE for %s (settle=%.1fs)", track.sid, wait)
                break
            except Exception:
                await asyncio.sleep(wait)
        
        if not audio_stream:
            logger.error("❌ Failed to start stream for %s", track.sid)
            self._handling_tracks.discard(track.sid)
            return

        # STT is already connected eagerly in start(). No lazy init needed here.
        # Lazy-initialize the resampler from the first frame's actual sample rate and channels.
        # LiveKit WebRTC audio is typically 48kHz; Deepgram expects 16kHz mono linear16.
        resampler = None
        frame_count = 0
        try:
            async for event in audio_stream:
                frame = event.frame
                frame_count += 1
                if frame_count % 100 == 0:
                    logger.info("Ingesting: %d frames from user", frame_count)

                if resampler is None:
                    resampler = rtc.AudioResampler(frame.sample_rate, 16000, num_channels=frame.num_channels)
                    logger.info(
                        "AudioResampler initialized: %dHz %dch → 16000Hz 1ch",
                        frame.sample_rate, frame.num_channels,
                    )

                for rf in resampler.push(frame):
                    await self.brain.process_audio_chunk(rf.data.tobytes())
        except Exception as e:
            logger.error("Audio stream error: %s", e)
        finally:
            self._handling_tracks.discard(track.sid)
            logger.info("Audio stream closed for %s.", track.sid)

    def stop(self):
        self.shutdown_event.set()

async def main():
    if len(sys.argv) < 2: return
    agent = LiveKitVoiceAgent(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, agent.stop)

    await agent.start()

if __name__ == "__main__":
    asyncio.run(main())

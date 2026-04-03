import json
import logging
import time
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger, correlation_id_var, session_id_var, generate_correlation_id
from voicebot.shared.models.session import SessionState
from voicebot.shared.exceptions import VoiceBotError, ServiceExhaustedError, AuthError, HandshakeError
from voicebot.shared.utils.audio import EnergyGate

# --- Import Routers from sub-packages ---
from voicebot.api.v1.routes import router as gateway_v1_router
from voicebot.core.transport import WebSocketVoiceTransport

# Lazy import providers in voice_websocket to handle dynamic selection
# from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider

settings = get_settings()
logger = setup_logger("voicebot-unified", level=settings.log_level)


def _make_summariser_llm(bot_config: dict):
    """
    Return the right LLM provider for post-call summarisation.

    Priority:
      1. Bot's own llm_provider + llm_model (same model used during the call)
      2. OpenRouter default model (if key is configured)
      3. Groq llama-3.3-70b (last resort)
    """
    prov = str(bot_config.get("llm_provider") or "").lower()
    model = bot_config.get("llm_model") or ""

    if prov == "openrouter" or ("/" in model and prov not in ("gemini", "openai", "groq", "anthropic")):
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
        return OpenRouterStreamingProvider(model=model or settings.openrouter_default_model)

    if prov == "openai" and model:
        from voicebot.services.llm.openai_provider import OpenAIStreamingProvider
        return OpenAIStreamingProvider(model=model)

    if prov == "anthropic" and model:
        from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
        return AnthropicStreamingProvider(model=model)

    if prov == "groq" and model:
        from voicebot.services.llm.groq_provider import GroqStreamingProvider
        return GroqStreamingProvider(model=model)

    # Fallback: OpenRouter if key present, else Groq
    if settings.openrouter_api_key:
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
        return OpenRouterStreamingProvider(model=settings.openrouter_default_model or "meta-llama/llama-3.3-70b-instruct")

    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    return GroqStreamingProvider(model="llama-3.3-70b-versatile")


class AudioFrameNormalizer:
    """
    Converts variable-size TTS audio chunks into uniform 10 ms PCM frames.

    TTS providers deliver audio in variable-size chunks. Normalizing to 10 ms
    (320 bytes at 16 kHz mono linear16) ensures the browser AudioWorklet
    receives a steady cadence without the initial ~80 ms silence that occurs
    when waiting to fill larger 20 ms (640-byte) frames.
    """

    FRAME_BYTES = 320  # 10 ms × 16 000 Hz × 2 bytes/sample  (was 640 / 20 ms)

    def __init__(self) -> None:
        self._buf: bytearray = bytearray()

    async def push(self, chunk: bytes, emit_fn) -> None:
        self._buf.extend(chunk)
        while len(self._buf) >= self.FRAME_BYTES:
            frame = bytes(self._buf[: self.FRAME_BYTES])
            del self._buf[: self.FRAME_BYTES]
            await emit_fn(frame)

    async def flush(self, emit_fn) -> None:
        """Pad and emit any remaining bytes at turn end.

        Skip if fewer than 100 bytes remain — that's sub-3 ms of audio and
        emitting it as a zero-padded frame inserts a silence blip at the turn
        boundary that users perceive as a pop or stutter at the start of the
        next utterance.
        """
        if len(self._buf) < 100:
            self._buf = bytearray()
            return
        remainder = len(self._buf) % self.FRAME_BYTES
        pad = (self.FRAME_BYTES - remainder) if remainder else 0
        padded = bytes(self._buf) + b"\x00" * pad
        self._buf = bytearray()
        await emit_fn(padded)

    def clear(self) -> None:
        """Discard any buffered audio bytes immediately."""
        self._buf = bytearray()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Unified VoiceBot Server starting (ENV=%s)...", settings.env)
    # Initialize shared services
    from voicebot.services.memory.redis_provider import RedisSessionProvider
    global _shared_redis
    _shared_redis = RedisSessionProvider(redis_url=settings.redis_url)
    await _shared_redis.connect()
    yield
    if _shared_redis:
        await _shared_redis.disconnect()
    
    logger.info("🛑 Shutting down. Cancelling background tasks to prevent 'Event loop is closed' errors...")
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    for task in tasks:
        task.cancel()
    
    try:
        # Give tasks a moment to shut down gracefully
        await asyncio.wait(tasks, timeout=2.0)
    except Exception:
        pass
        
    logger.info("✅ Cleanup sequence complete.")


app = FastAPI(
    title="Unified VoiceBot Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
)

# CORS Extension
app.add_middleware(
    CORSMiddleware,
    # Browser UI runs at http://localhost:3000 during development.
    # Avoid `allow_credentials=True` with wildcard origins, which can omit
    # `Access-Control-Allow-Origin` headers and break fetch() in the browser.
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# Mount REST API
app.include_router(gateway_v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Aggregated health check for all internal modules + Redis."""
    redis_status = "offline"
    if _shared_redis:
        redis_status = "online" if await _shared_redis.ping() else "offline"

    return {
        "status": "healthy" if redis_status == "online" else "degraded",
        "env": settings.env,
        "services": {
            "gateway": "online",
            "redis": redis_status,
            "stt": settings.stt_provider,
            "llm": settings.llm_provider,
            "tts": settings.tts_provider,
        }
    }


# Globally track active voice sessions to enforce singleton behavior per user/session_id.
# This prevents orphaned backgrounds from consuming tokens when a user refreshes or starts new session.
_active_voice_sessions: dict[str, WebSocket] = {}
_shared_redis = None # Initialized in lifespan

@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    session_id: str,
    language: str = Query(default="hi"),
    bot_id: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
):
    """
    Unified real-time voice endpoint.
    Orchestrates the full pipeline (STT -> LLM -> TTS) internally.
    Supports dynamic config and simulator mode via JSON messages.
    """
    await websocket.accept()
    vt = WebSocketVoiceTransport(websocket)

    # Tracing
    correlation_id = generate_correlation_id()
    correlation_id_var.set(correlation_id)
    session_id_var.set(session_id)
    
    logger.info("New voice session: %s [lang=%s]", session_id[:8], language)
    
    from voicebot.core.orchestrator.brain import AgenticBrain, BotState
    from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider
    from voicebot.services.llm.openai_provider import OpenAIStreamingProvider
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
    # from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
    from voicebot.services.guardrail.pii_detector import PIIDetector
    from voicebot.services.guardrail.output_guard import OutputGuard
    from voicebot.services.memory.redis_provider import RedisSessionProvider
    from voicebot.services.memory.sqlite_provider import SQLiteProvider



    # Load session and bot config from DB
    db = SQLiteProvider()
    await db.initialize()
    
    # Reliably recover bot_id from session DB or Query
    session_data = await db.get_session(session_id)
    if session_data and not bot_id:
        bot_id = session_data.get('bot_id')
        logger.info("Recovered bot_id '%s' from session %s", bot_id, session_id[:8])

    bot_config = {}
    if bot_id:
        bot_config = await db.get_bot(bot_id) or {}
        if bot_config:
            # Override language if bot has a specific default
            if language == "en" and bot_config.get("default_language"):
                language = bot_config.get("default_language")
                logger.info("Bot-specific language override: %s", language)
            
            logger.info("Loaded persona: %s (%s)", bot_config.get('name'), bot_id)
        else:
            logger.warning("Bot ID '%s' not found, using default fallback", bot_id)
    
    if not bot_config:
        bots = await db.list_bots()
        if bots:
            preferred_id = "recovery-blank"
            pick_id = next(
                (b["id"] for b in bots if b.get("id") == preferred_id),
                bots[0]["id"],
            )
            bot_config = await db.get_bot(pick_id) or {}
            logger.info("Defaulting to bot: %s", bot_config.get("name"))

    p_mode = str(bot_config.get("pipeline_mode") or "classic").lower()
    if p_mode == "speech_speech":
        # Prefer Gemini Live STS when available (per preference).
        if settings.gemini_api_key:
            await _handle_gemini_s2s_session(
                websocket, vt, session_id, language, bot_config, db
            )
            return

        if not settings.openai_api_key:
            logger.warning(
                "pipeline_mode=speech_speech but OPENAI_API_KEY is not set — "
                "falling back to classic STT/LLM/TTS pipeline."
            )
            p_mode = "classic"
        else:
            # Delegate entirely to the S2S handler; classic providers are NOT initialised.
            await _handle_speech_speech_session(
                websocket, vt, session_id, language, bot_config, db
            )
            return

    if p_mode == "gemini_s2s":
        # Delegate entirely to the Gemini Live STS handler; classic providers are NOT initialised.
        if not settings.gemini_api_key:
            if vt.connected:
                await vt.send_json({
                    "type": "error",
                    "message": "Gemini STS requested but GEMINI_API_KEY is not set.",
                    "code": "S2S_GEMINI_KEY_MISSING",
                })
                await websocket.close(code=4000)
            return

        await _handle_gemini_s2s_session(
            websocket, vt, session_id, language, bot_config, db
        )
        return

    # Bot logic language override
    # If the bot has a default_language (e.g. 'hi') and the query is just the default 'hi',
    # use the bot's setting (which might be 'en' or 'hi-en').
    session_language = bot_config.get("default_language") or language

    # Sync session in SQLite (with user_id for cross-session memory)
    await db.create_session(
        session_id=session_id,
        bot_id=bot_config.get("id"),
        language=session_language,
        user_id=user_id,
    )

    # Track current session in global map
    _active_voice_sessions[session_id] = websocket
    setattr(websocket, "_user_id", user_id)

    # State for the session
    _playback_allowed = True
    _warm_audio = False
    normalizer = AudioFrameNormalizer()
    voice_session_close_sent = False

    # ─── Callback definitions ──────────────────────────────────────────

    async def on_state_change(state: str):
        nonlocal _playback_allowed
        if state in ("processing", "speaking"):
            if not _playback_allowed:
                logger.info("🔓 Playback re-enabled for session %s (state: %s)", session_id, state)
            _playback_allowed = True
        if vt.connected:
            await vt.send_json({"type": "status", "state": state, "session_id": session_id})

    async def on_audio_output(audio_bytes: bytes):
        nonlocal _warm_audio
        if not _playback_allowed:
            logger.warning("🔇 Dropping %d audio bytes for session %s (playback blocked)", len(audio_bytes), session_id)
            return
        if vt.connected:
            logger.debug("📡 Dispatching audio chunk to transport: %d bytes", len(audio_bytes))
            if not _warm_audio:
                await vt.send_json({
                    "type": "log",
                    "tag": "[AUDIO]",
                    "message": "First audio bytes dispatched to WebSocket",
                    "color": "text-green-400"
                })
                _warm_audio = True
            await normalizer.push(audio_bytes, vt.send_bytes)

    async def on_audio_interrupt():
        nonlocal _playback_allowed, _warm_audio
        logger.info("🔒 Playback disabled for session %s (interrupted)", session_id)
        _playback_allowed = False
        _warm_audio = False  # Reset so the next turn logs its first audio chunk
        try:
            normalizer.clear()
            await vt.send_json({"type": "audio_interrupt"})
        except Exception: pass

    async def on_audio_resume():
        nonlocal _playback_allowed
        if not _playback_allowed:
            logger.info("🔓 Playback resumed for session %s (interruption was noise/echo)", session_id)
            _playback_allowed = True

    async def on_transcript(text: str, is_final: bool):
        if vt.connected:
            await vt.send_json({"type": "transcript", "text": text, "is_final": is_final})

    async def on_bot_transcript(text: str, is_final: bool):
        nonlocal _warm_audio
        if vt.connected:
            await vt.send_json({"type": "bot_transcript", "text": text, "is_final": is_final})
        if is_final and vt.connected:
            await normalizer.flush(vt.send_bytes)
            _warm_audio = False

    async def on_tool_call(name: str, args: dict):
        if vt.connected:
            await vt.send_json({"type": "tool_call", "name": name, "arguments": args})

    async def on_tool_result(name: str, result: str):
        if vt.connected:
            await vt.send_json({"type": "tool_result", "name": name, "result": result})

    async def on_log(tag: str, message: str, color: str):
        if vt.connected:
            await vt.send_json({"type": "log", "tag": tag, "message": message, "color": color})

    async def on_metrics(metrics: dict):
        if vt.connected:
            await vt.send_json({"type": "metrics", **metrics})

    async def on_voice_session_end(reason: str):
        nonlocal voice_session_close_sent
        if voice_session_close_sent:
            return
        voice_session_close_sent = True
        logger.info("Voice session end (%s): %s", session_id[:8], reason)
        if vt.connected:
            try:
                await vt.send_json({
                    "type": "session_ended",
                    "reason": reason,
                    "session_id": session_id,
                })
            except Exception: pass
        try:
            await websocket.close()
        except Exception: pass

    # ─── Initialize Providers with bot-specific overrides ──────────────────
    try:
        # STT
        stt_provider = DeepgramStreamingProvider(language=session_language)
        
        # LLM — auto-detect provider from bot config or model slug
        # --- LLM Provider (Detect from Bot Config + High-Perf Default) ---
        _llm_prov = str(bot_config.get("llm_provider") or "").lower()
        llm_model = bot_config.get("llm_model")
        _bot_name_lower = str(bot_config.get("name", "")).lower()

        if not llm_model:
            raise ValueError(f"Bot '{bot_config.get('name', 'Unknown')}' has no LLM Model configured.")

        # 🚀 PRODUCTION OPTIMIZATION: Force Groq for high-performance Hindi banking bots.
        # OpenRouter (even with 4o-mini) adds ~500ms protocol delay. Direct Groq is the goal.
        _is_high_perf = ("hindi" in _bot_name_lower or "banking" in _bot_name_lower)
        if _is_high_perf and (_llm_prov == "openrouter" or "openai/gpt-4o-mini" in str(llm_model)):
             _llm_prov = "groq"
             llm_model = "llama-3.3-70b-versatile"
             logger.warning("🚀 OVERRIDING slow model with high-perf Groq (%s) for low-latency session.", llm_model)

        # OpenRouter models use "provider/model" slugs
        if _llm_prov == "openrouter" or ("/" in str(llm_model) and _llm_prov not in ("gemini", "openai", "groq", "anthropic")):
             from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
             llm_provider = OpenRouterStreamingProvider(model=llm_model)
             logger.info("Using OpenRouter LLM (model=%s) ✅", llm_model)
        elif _llm_prov == "openai":
            llm_provider = OpenAIStreamingProvider(model=llm_model)
            logger.info("Using OpenAI LLM (model=%s) ✅", llm_model)
        elif _llm_prov == "gemini":
            llm_provider = GeminiStreamingProvider(model=llm_model)
            logger.info("Using Gemini LLM (model=%s) ✅", llm_model)
        elif _llm_prov == "anthropic":
            from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
            llm_provider = AnthropicStreamingProvider(model=llm_model)
            logger.info("Using Anthropic LLM (model=%s) ✅", llm_model)
        else:
            # Default for all core bots (Groq is the performance standard)
            _model = llm_model or "llama3-70b-8192"
            llm_provider = GroqStreamingProvider(model=_model)
            logger.info("Using Groq LLM (model=%s) ✅", _model)

        # --- TTS Provider (Robust, Anti-Fallback, Hindi-Aware) ---
        voice_id = bot_config.get("voice_id")
        if not voice_id:
            raise ValueError(f"Bot '{bot_config.get('name', 'Unknown')}' has no Voice Profile configured.")
            
        _tts_prov_name = str(bot_config.get("tts_provider") or "").lower()
        _is_hindi_bot = (bot_config.get("default_language") or "").lower().startswith("hi")
        
        # 🚀 HIGH-LEVEL OPTIMIZATION: Automatic Hindi routing to ElevenLabs
        # Deepgram Aura does not support Hindi. If bot is Hindi, force ElevenLabs.
        if _is_hindi_bot:
             # Fix for invalid IDs: If database holds a Deepgram Aura ID, map to an ElevenLabs default ID
             if "aura" in voice_id.lower() or len(voice_id) != 21:
                 logger.warning(f"Invalid ElevenLabs voice ID '{voice_id}' detected for Hindi bot. Using fallback.")
                 voice_id = "pNInz6obpgDQGcFmaJgB"  # Default ElevenLabs voice (Adam)
                 
             from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
             tts_provider = ElevenLabsStreamingProvider(
                 voice_id=voice_id,
                 model_id="eleven_flash_v2_5"
             )
             logger.info("Hindi Bot detected: Forcing ElevenLabs Multilingual ✅")
        elif _tts_prov_name == "elevenlabs":
            from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
            tts_provider = ElevenLabsStreamingProvider(
                voice_id=voice_id,
                model_id="eleven_flash_v2_5"
            )
            logger.info("Using ElevenLabs TTS (Multilingual v2) ✅")
        elif _tts_prov_name == "deepgram_http":
            from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
            tts_provider = DeepgramTTSProvider(model=voice_id)
            logger.info("Using Deepgram HTTP TTS ✅")
        else:
            # Default to WebSocket for Deepgram (lowest latency)
            from voicebot.services.tts.deepgram_ws_tts_provider import DeepgramWSTTSProvider
            tts_provider = DeepgramWSTTSProvider(model=voice_id)
            try:
                await asyncio.wait_for(tts_provider.connect(), timeout=5.0)
                logger.info("Using Deepgram WS TTS (model=%s) ✅", voice_id)
            except Exception as _tts_err:
                # Per user request: Don't fall back to silent low-quality. Raise error if WS fails.
                from voicebot.shared.exceptions import HandshakeError
                raise HandshakeError(f"TTS WebSocket connection failed: {_tts_err}")

        # Attach Redis cache for high-frequency phrase caching
        memory_local = RedisSessionProvider(redis_url=settings.redis_url)
        await memory_local.connect()
        if hasattr(tts_provider, "set_cache"):
            tts_provider.set_cache(memory_local)

        # Essential Services — policies from bot JSON (Obsidian / API)
        from voicebot.shared.policy import output_guard_extra_patterns, parse_json_dict

        _gp = parse_json_dict(bot_config.get("guardrail_policy"))
        guardrail = PIIDetector()
        _default_output_patterns = [
            r"password: \w+",
            r"api_key: \w+",
            r"secret_key: \w+",
            r"bearer [A-Za-z0-9\-\.\_]+",
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        ]
        output_guard = OutputGuard(
            forbidden_patterns=_default_output_patterns + output_guard_extra_patterns(_gp)
        )
        memory = RedisSessionProvider(redis_url=settings.redis_url)
        await memory.connect()

        # Vector memory (optional — ChromaDB for RAG; skips silently if not installed)
        from voicebot.services.memory.vector_provider import VectorMemoryProvider
        vector_memory = VectorMemoryProvider()
        await vector_memory.connect()

    except Exception as init_err:
        logger.error("Failed to initialize session providers: %s", init_err)
        if websocket.client_state.value == 1:
            await websocket.send_json({
                "type": "error",
                "message": f"Initialization Failed: {str(init_err)}",
                "code": "PROV_INIT_ERR"
            })
            await websocket.close(code=4000)
        return


    # Initialize Brain
    session = SessionState(session_id=session_id, detected_language=language, user_id=user_id)
    vector_memory = locals().get("vector_memory")
    brain = AgenticBrain(
        session=session,
        stt_handler=stt_provider,
        llm_handler=llm_provider,
        tts_handler=tts_provider,
        on_state_change=on_state_change,
        on_audio_output=on_audio_output,
        on_transcript=on_transcript,
        on_bot_transcript=on_bot_transcript,
        on_tool_call=on_tool_call,
        on_tool_result=on_tool_result,
        on_log=on_log,
        on_metrics=on_metrics,
        guardrail_handler=guardrail,
        output_guard_handler=output_guard,
        memory_handler=memory,
        db_handler=db,
        bot_config=bot_config,
        on_voice_session_end=on_voice_session_end,
        on_audio_interrupt=on_audio_interrupt,
        on_audio_resume=on_audio_resume,
    )
    # Attach optional vector memory for RAG
    if vector_memory and getattr(vector_memory, "_available", False):
        brain._vector_memory = vector_memory

    # STT Callback — forward confidence to brain for low-confidence recovery
    async def stt_callback(text, is_final, lang, confidence, **kwargs):
        if text.strip():
            logger.info("🎙️ stt_callback (final=%s, lang=%s): '%s'", is_final, lang, text)
        await brain.process_stt_partial(text, is_final, confidence=confidence, **kwargs)

    try:
        # Step 1: Connect STT in the background so the greeting can start immediately.
        # Brain._hydrate_session is already a background task from __init__; STT
        # connection (Deepgram WS handshake, ~2s) runs in parallel with the greeting
        # TTS synthesis, shaving 2-3 seconds off session start time.
        stt_ok = False

        async def _connect_stt() -> bool:
            """Returns True on success, False on failure (never raises)."""
            try:
                await asyncio.wait_for(
                    stt_provider.connect(on_transcript=stt_callback), timeout=5.0
                )
                logger.info("✅ STT Bridge established (session=%s)", session_id[:8])
                return True
            except Exception as _e:
                logger.warning("⚠️ STT Bridge failed: %s. Reverting to Simulator Mode.", _e)
                await vt.send_json({
                    "type": "log",
                    "tag": "[SYSTEM]",
                    "message": f"STT Offline ({type(_e).__name__}): Using Simulator Mode only.",
                    "color": "text-yellow-400",
                })
                try:
                    _st = await brain.get_infra_status()
                    await vt.send_json({"type": "infra_status", **_st})
                except Exception:
                    pass
                return False

        # Fire STT connect as a background task — it runs while we do the rest of setup.
        _stt_task = asyncio.create_task(_connect_stt())

        # Step 2: Notify ready state
        await vt.send_json({
            "type": "status",
            "state": "listening",
            "session_id": session_id,
            "message": "Voice bot ready."
        })

        # Collect STT result before we enter the main receive loop
        stt_ok = await _stt_task

        # --- INFRA HEARTBEAT ---
        async def infra_heartbeat():
            while vt.connected:
                try:
                    status = await brain.get_infra_status()
                    await vt.send_json({"type": "infra_status", **status})
                except Exception as e:
                    logger.error("Heartbeat error: %s", e)
                await asyncio.sleep(30)
        
        heartbeat_task = asyncio.create_task(infra_heartbeat())

        # --- INACTIVITY MONITOR ---
        last_activity_time = time.time()
        
        async def inactivity_monitor():
            nonlocal last_activity_time
            while vt.connected:
                elapsed = time.time() - last_activity_time
                if elapsed > 60.0:
                    logger.info("😴 Session %s timed out (60s inactivity)", session_id[:8])
                    await vt.send_json({
                        "type": "log",
                        "tag": "[SYSTEM]",
                        "message": "Session timed out due to 60s inactivity.",
                        "color": "text-red-400"
                    })
                    await brain.request_session_end("inactivity")
                    break
                await asyncio.sleep(2.0)
        
        inactivity_task = asyncio.create_task(inactivity_monitor())

        # --- AUTO GREETING ---
        # Trigger initial greeting turn. Even if TTS fails, transcript will be sent.
        try:
            await brain.start_conversation()
        except Exception as e:
            logger.error("Greeting failed: %s", e)

        chunk_count = 0
        energy_gate = EnergyGate(threshold_db=-45.0)

        while True:
            data = await websocket.receive()
            
            if data.get("bytes") is not None:
                last_activity_time = time.time()
                audio_bytes = data.get("bytes")
                
                # [LOCAL VAD] Drop silent frames before STT to save costs/latency
                if energy_gate.is_silent(audio_bytes):
                    continue

                chunk_count += 1
                if chunk_count % 100 == 0:  # Periodically log active audio pressure
                    logger.debug("🔉 Receiving audio pressure: %d bytes (Total active frames: %d)", len(audio_bytes), chunk_count)
                await brain.process_audio_chunk(audio_bytes)
            elif data.get("text") is not None:
                last_activity_time = time.time()
                logger.info("📩 Message received: %s", data.get("text")[:100])
                try:
                    msg = json.loads(data.get("text"))
                    msg_type = msg.get("type")
                    
                    if msg_type == "config":
                        # DYNAMIC RECONFIGURATION
                        llm_choice = msg.get("llm", "groq")
                        llm_model = msg.get("llmModel")

                        if llm_choice == "openrouter" or ("/" in str(llm_model) and llm_choice not in ("gemini", "openai", "groq", "anthropic")):
                            from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
                            brain.llm = OpenRouterStreamingProvider(model=llm_model)
                        elif llm_choice == "gemini":
                            brain.llm = GeminiStreamingProvider(model=llm_model)
                        elif llm_choice == "groq":
                            brain.llm = GroqStreamingProvider(model=llm_model)
                        elif llm_choice == "anthropic":
                            from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
                            brain.llm = AnthropicStreamingProvider(model=llm_model)
                        else:
                            brain.llm = OpenAIStreamingProvider(model=llm_model)
                            
                        # Update TTS
                        tts_choice = msg.get("tts", "deepgram")
                        voice_id_override = msg.get("voiceId")
                        if not voice_id_override:
                             raise ValueError("Dynamic config applied without a valid voice_id.")
                             
                        if tts_choice == "deepgram":
                            from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
                            brain.tts = DeepgramTTSProvider(model=voice_id_override)
                        else:
                            from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
                            brain.tts = ElevenLabsStreamingProvider(voice_id=voice_id_override)
                            
                        logger.info("Pipeline reconfigured: LLM=%s (%s), TTS=%s", llm_choice, llm_model, tts_choice)
                        await vt.send_json({"type": "status", "message": f"Config updated: {llm_choice} / {tts_choice}"})

                    elif msg_type == "switch_bot":
                        # HOT-SWAP BOT PERSONA MID-CALL
                        new_bot_id = msg.get("bot_id")
                        new_bot_name = msg.get("bot_name")
                        new_bot_cfg = None

                        if new_bot_id:
                            new_bot_cfg = await db.get_bot(new_bot_id)
                        elif new_bot_name:
                            new_bot_cfg = await db.get_bot_by_name(new_bot_name)

                        if new_bot_cfg:
                            await brain.switch_bot(new_bot_cfg)
                            await vt.send_json({"type": "status", "state": "bot_switched", "bot": new_bot_cfg.get("name")})
                            logger.info("Bot switched to: %s", new_bot_cfg.get("name"))
                        else:
                            await vt.send_json({"type": "error", "message": f"Bot not found"})

                    elif msg_type == "text_query":
                        # SIMULATOR MODE: Direct text to brain
                        query = msg.get("text", "")
                        if query:
                            logger.info("Simulator query received: %s", query)
                            # If the bot is mid-speech, interrupt it first so the
                            # frontend flushes its audio queue before the new turn starts.
                            if brain.state in (BotState.SPEAKING, BotState.PROCESSING):
                                await brain.handle_interruption()
                            # Echo back as transcript so UI shows it
                            await vt.send_json({"type": "transcript", "text": query, "is_final": True})
                            await brain._process_user_turn(query)

                    elif msg_type == "interrupt":
                        await brain.handle_interruption()
                        
                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        logger.info("Session %s disconnected", session_id[:8])
    except RuntimeError as e:
        if "Cannot call \"receive\"" in str(e) or "WebSocket is not connected" in str(e):
             logger.info("Session %s disconnected (runtime)", session_id[:8])
        else:
             logger.error("Runtime error in session %s: %s", session_id[:8], e)
    except Exception as e:
        from voicebot.shared.exceptions import VoiceBotError
        
        if isinstance(e, VoiceBotError):
            logger.error("❌ Terminal VoiceBot Error in %s: %s [%s]", session_id[:8], e.message, e.code)
            # Notify UI
            if vt.connected:
                try:
                    await vt.send_json({
                        "type": "error",
                        "code": e.code,
                        "message": str(e),
                    })
                except Exception: pass
            
            # Close call immediately
            await on_voice_session_end(reason=f"terminal_error_{e.code.lower()}")
        else:
            logger.error("Unexpected error in session %s: %s", session_id[:8], e, exc_info=True)
            await on_voice_session_end(reason="internal_server_error")
    finally:
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()
        await brain.cleanup()
        await stt_provider.disconnect()
        if hasattr(tts_provider, "disconnect"):
            await tts_provider.disconnect()
        
        # --- Post-Call Summarization ---
        # try:
        #     log_entries = await db.get_session_log(session_id)
        #     transcript_text = "\n".join([f"{e['role']}: {e['content']}" for e in log_entries if e['role'] in ['user', 'assistant']])
            
        #     summary = "No meaningful conversation occurred."
        #     intent = "Unknown"
            
        #     if len(log_entries) > 1 and transcript_text.strip():
        #         try:
        #             # Reuse the bot's own provider — same model used during the call.
        #             # brain.cleanup() nulled _client; _get_client() lazy-reinits on first use.
        #             sum_llm = llm_provider
        #             logger.info(
        #                 "Post-call summarisation using bot LLM: provider=%s model=%s",
        #                 getattr(sum_llm, "provider", type(sum_llm).__name__),
        #                 getattr(sum_llm, "model", "?"),
        #             )

        #             # Generate Summary
        #             system_summary = "You are a concise assistant. In 1-2 sentences summarize the user's inquiry and the outcome."
        #             sum_parts = []
        #             async for chunk in sum_llm.stream_completion(system_summary, [{"role": "user", "content": transcript_text}]):
        #                 if chunk.content:
        #                     sum_parts.append(chunk.content)
        #             if sum_parts:
        #                 summary = "".join(sum_parts).strip()

        #             # Generate Intent Tag
        #             system_intent = "You are a classification assistant. Output ONLY a 1-3 word noun phrase for the intent."
        #             intent_parts = []
        #             async for chunk in sum_llm.stream_completion(system_intent, [{"role": "user", "content": transcript_text}]):
        #                 if chunk.content:
        #                     intent_parts.append(chunk.content)
        #             if intent_parts:
        #                 intent = "".join(intent_parts).strip()

        #         except Exception as llm_err:
        #             logger.error("LLM Summarization failed: %s", llm_err)
            
        #     await db.close_session(
        #         session_id=session_id, 
        #         turn_count=len(log_entries), 
        #         metadata={'summary': summary, 'intent': intent}
        #     )
        #     logger.info("Session %s archived with summary.", session_id[:8])

        #     # Store summary in vector memory for future RAG retrieval
        #     if vector_memory and getattr(vector_memory, "_available", False) and summary != "No meaningful conversation occurred.":
        #         try:
        #             await vector_memory.store_conversation(
        #                 session_id=session_id,
        #                 summary=summary,
        #                 user_id=user_id,
        #             )
        #         except Exception as _vec_err:
        #             logger.debug("Vector memory store failed: %s", _vec_err)

        #     # Post-call webhook: fire summary to external URL if configured
        #     _post_call_url = bot_config.get("post_call_webhook_url", "")
        #     if _post_call_url and summary != "No meaningful conversation occurred.":
        #         try:
        #             import httpx as _httpx
        #             async with _httpx.AsyncClient(timeout=10.0) as _hc:
        #                 await _hc.post(_post_call_url, json={
        #                     "session_id": session_id,
        #                     "user_id": user_id,
        #                     "bot_id": bot_config.get("id"),
        #                     "summary": summary,
        #                     "intent": intent,
        #                     "turn_count": len(log_entries),
        #                 })
        #             logger.info("Post-call webhook fired for session %s", session_id[:8])
        #         except Exception as _wh_err:
        #             logger.warning("Post-call webhook failed: %s", _wh_err)

        # except Exception as archive_err:
        #     logger.error("Failed to archive session %s: %s", session_id[:8], archive_err)
        # finally:
        #     # Remove from singleton registry (always keyed by session_id)
        #     if _active_voice_sessions.get(session_id) == websocket:
        #         _active_voice_sessions.pop(session_id, None)

async def _handle_gemini_s2s_session(
    websocket: WebSocket,
    vt: WebSocketVoiceTransport,
    session_id: str,
    language: str,
    bot_config: dict,
    db,
) -> None:
    """
    Full WebSocket session handler for pipeline_mode == "gemini_s2s".

    Gemini Live replaces the classic STT→LLM→TTS stack with a single
    bidirectional audio + transcription session.
    """
    from voicebot.services.voice.gemini_s2s_bridge import GeminiLiveS2SBridge

    bridge = GeminiLiveS2SBridge(
        api_key=settings.gemini_api_key,
        session_id=session_id,
        bot_config=bot_config,
        send_json=vt.send_json,
        send_bytes=vt.send_bytes,
        db=db,
        language=language,
        gemini_model=(bot_config.get("s2s_model") or None),
    )

    connected = await bridge.connect()
    if not connected:
        if vt.connected:
            await vt.send_json({
                "type":    "error",
                "message": "Speech-to-speech: failed to connect to Gemini Live API. "
                           "Check GEMINI_API_KEY and model availability.",
                "code":    "S2S_GEMINI_CONNECT_ERR",
            })
            await websocket.close(code=4000)
        return

    await vt.send_json({
        "type":       "status",
        "state":      "listening",
        "session_id": session_id,
        "message":    "Speech-to-speech ready (Gemini Live).",
        "mode":       "gemini_s2s",
    })

    async def s2s_heartbeat():
        while vt.connected:
            await asyncio.sleep(30)
            if vt.connected:
                await vt.send_json({
                    "type": "infra_status",
                    "mode": "gemini_s2s",
                    "stt":  "gemini-live",
                    "llm":  "gemini-live",
                    "tts":  "gemini-live",
                })

    heartbeat_task = asyncio.create_task(s2s_heartbeat())

    try:
        while True:
            data = await websocket.receive()

            if data.get("bytes") is not None:
                await bridge.send_audio(data.get("bytes"))

            elif data.get("text") is not None:
                try:
                    msg = json.loads(data.get("text"))
                    msg_type = msg.get("type")

                    if msg_type == "interrupt":
                        await bridge.handle_interrupt()

                    elif msg_type == "text_query":
                        query = msg.get("text", "").strip()
                        if query:
                            logger.info("Gemini S2S text_query (session=%s): %s", session_id[:8], query)
                            await bridge.send_text_query(query)

                    elif msg_type in ("config", "switch_bot"):
                        # Not supported in S2S mode — acknowledge without crashing
                        await vt.send_json({
                            "type":    "log",
                            "tag":     "[S2S]",
                            "message": f"'{msg_type}' is not supported in gemini_s2s mode.",
                            "color":   "text-yellow-400",
                        })
                    # All other message types silently ignored
                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        logger.info("S2S (gemini) session %s disconnected", session_id[:8])
    except RuntimeError as exc:
        msg_str = str(exc)
        if "Cannot call \"receive\"" in msg_str or "WebSocket is not connected" in msg_str:
            logger.info("S2S (gemini) session %s disconnected (runtime)", session_id[:8])
        else:
            logger.error("S2S (gemini) runtime error (session=%s): %s", session_id[:8], exc, exc_info=True)
    except Exception as exc:
        logger.error("S2S (gemini) error (session=%s): %s", session_id[:8], exc, exc_info=True)
    finally:
        heartbeat_task.cancel()
        await bridge.disconnect()

        # ── Post-call summarisation (same as classic mode) ─────────────────
        try:
            log_entries = await db.get_session_log(session_id)
            transcript_text = "\n".join(
                f"{e['role']}: {e['content']}"
                for e in log_entries
                if e["role"] in ("user", "assistant")
            )

            summary = "No meaningful conversation occurred."
            intent = "Unknown"

            if len(log_entries) > 1 and transcript_text.strip():
                try:
                    sum_llm = _make_summariser_llm(bot_config)
                    logger.info(
                        "S2S (gemini) post-call summarisation using: provider=%s model=%s",
                        getattr(sum_llm, "provider", type(sum_llm).__name__),
                        getattr(sum_llm, "model", "?"),
                    )

                    sum_prompt = (
                        "Summarize the following conversation in exactly 1 or 2 concise sentences. "
                        "Focus solely on the user's primary intent and the resolution. "
                        "Do not add conversational filler:\n\n" + transcript_text
                    )
                    parts: list[str] = []
                    async for chunk in sum_llm.stream_completion(
                        system_prompt="You are a concise summarizer.",
                        messages=[{"role": "user", "content": sum_prompt}],
                    ):
                        if chunk.content:
                            parts.append(chunk.content)
                    if parts:
                        summary = "".join(parts).strip()

                    intent_prompt = (
                        "Based on the following conversation, provide a strict 1-3 word noun phrase "
                        "representing the core operational intent (e.g. 'Password Reset', "
                        "'Technical Inquiry', 'General Chat'). Output ONLY the tag:\n\n"
                        + transcript_text
                    )
                    iparts: list[str] = []
                    async for chunk in sum_llm.stream_completion(
                        system_prompt="You are a concise intent classifier.",
                        messages=[{"role": "user", "content": intent_prompt}],
                    ):
                        if chunk.content:
                            iparts.append(chunk.content)
                    if iparts:
                        intent = "".join(iparts).strip()
                except Exception as llm_err:
                    logger.error("S2S (gemini) post-call LLM summarisation failed: %s", llm_err)

            await db.close_session(
                session_id=session_id,
                turn_count=len(log_entries),
                metadata={"summary": summary, "intent": intent, "mode": "gemini_s2s"},
            )
            logger.info("S2S (gemini) session %s archived.", session_id[:8])

            # Post-call webhook for S2S mode
            _post_call_url = bot_config.get("post_call_webhook_url", "")
            if _post_call_url and summary != "No meaningful conversation occurred.":
                try:
                    import httpx as _httpx
                    async with _httpx.AsyncClient(timeout=10.0) as _hc:
                        await _hc.post(_post_call_url, json={
                            "session_id": session_id,
                            "user_id": language,
                            "summary": summary,
                            "intent": intent,
                            "mode": "gemini_s2s",
                        })
                except Exception as _wh_err:
                    logger.warning("S2S (gemini) post-call webhook failed: %s", _wh_err)

        except Exception as archive_err:
            logger.error("Failed to archive S2S (gemini) session %s: %s", session_id[:8], archive_err)

async def _handle_speech_speech_session(
    websocket: WebSocket,
    vt: WebSocketVoiceTransport,
    session_id: str,
    language: str,
    bot_config: dict,
    db,
) -> None:
    """
    Full WebSocket session handler for pipeline_mode == "speech_speech".

    Replaces the classic STT→LLM→TTS stack with a single OpenAI Realtime
    bidirectional session.  The client-facing message protocol is identical
    to the classic mode so the frontend requires no changes.
    """
    from voicebot.services.voice.openai_realtime import OpenAIRealtimeBridge

    bridge = OpenAIRealtimeBridge(
        api_key=settings.openai_api_key,
        session_id=session_id,
        bot_config=bot_config,
        send_json=vt.send_json,
        send_bytes=vt.send_bytes,
        db=db,
        language=language,
    )

    connected = await bridge.connect()
    if not connected:
        if vt.connected:
            await vt.send_json({
                "type":    "error",
                "message": "Speech-to-speech: failed to connect to OpenAI Realtime API. "
                           "Check OPENAI_API_KEY and model availability.",
                "code":    "S2S_CONNECT_ERR",
            })
            await websocket.close(code=4000)
        return

    await vt.send_json({
        "type":       "status",
        "state":      "listening",
        "session_id": session_id,
        "message":    "Speech-to-speech ready (OpenAI Realtime).",
        "mode":       "speech_speech",
    })

    async def s2s_heartbeat():
        while vt.connected:
            await asyncio.sleep(30)
            if vt.connected:
                await vt.send_json({
                    "type": "infra_status",
                    "mode": "speech_speech",
                    "stt":  "openai-realtime",
                    "llm":  "openai-realtime",
                    "tts":  "openai-realtime",
                })

    heartbeat_task = asyncio.create_task(s2s_heartbeat())

    try:
        while True:
            data = await websocket.receive()

            if data.get("bytes") is not None:
                await bridge.send_audio(data.get("bytes"))

            elif data.get("text") is not None:
                try:
                    msg      = json.loads(data.get("text"))
                    msg_type = msg.get("type")

                    if msg_type == "interrupt":
                        await bridge.handle_interrupt()

                    elif msg_type == "text_query":
                        query = msg.get("text", "").strip()
                        if query:
                            logger.info("S2S text_query (session=%s): %s", session_id[:8], query)
                            await bridge.send_text_query(query)

                    elif msg_type in ("config", "switch_bot"):
                        # Not supported in S2S mode — acknowledge without crashing
                        await vt.send_json({
                            "type":    "log",
                            "tag":     "[S2S]",
                            "message": f"'{msg_type}' is not supported in speech_speech mode.",
                            "color":   "text-yellow-400",
                        })
                    # All other message types silently ignored

                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        logger.info("S2S session %s disconnected", session_id[:8])
    except RuntimeError as exc:
        msg_str = str(exc)
        if "Cannot call \"receive\"" in msg_str or "WebSocket is not connected" in msg_str:
            logger.info("S2S session %s disconnected (runtime)", session_id[:8])
        else:
            logger.error("S2S runtime error (session=%s): %s", session_id[:8], exc, exc_info=True)
    except Exception as exc:
        logger.error("S2S error (session=%s): %s", session_id[:8], exc, exc_info=True)
    finally:
        heartbeat_task.cancel()
        await bridge.disconnect()

        # ── Post-call summarisation (same as classic mode) ─────────────────
        try:
            log_entries = await db.get_session_log(session_id)
            transcript_text = "\n".join(
                f"{e['role']}: {e['content']}"
                for e in log_entries
                if e["role"] in ("user", "assistant")
            )

            summary = "No meaningful conversation occurred."
            intent  = "Unknown"

            if len(log_entries) > 1 and transcript_text.strip():
                try:
                    sum_llm = _make_summariser_llm(bot_config)
                    logger.info(
                        "S2S post-call summarisation using: provider=%s model=%s",
                        getattr(sum_llm, "provider", type(sum_llm).__name__),
                        getattr(sum_llm, "model", "?"),
                    )

                    sum_prompt = (
                        "Summarize the following conversation in exactly 1 or 2 concise sentences. "
                        "Focus solely on the user's primary intent and the resolution. "
                        "Do not add conversational filler:\n\n" + transcript_text
                    )
                    parts: list[str] = []
                    async for chunk in sum_llm.stream_completion(
                        system_prompt="You are a concise summarizer.",
                        messages=[{"role": "user", "content": sum_prompt}],
                    ):
                        if chunk.content:
                            parts.append(chunk.content)
                    if parts:
                        summary = "".join(parts).strip()

                    intent_prompt = (
                        "Based on the following conversation, provide a strict 1-3 word noun phrase "
                        "representing the core operational intent (e.g. 'Password Reset', "
                        "'Technical Inquiry', 'General Chat'). Output ONLY the tag:\n\n"
                        + transcript_text
                    )
                    iparts: list[str] = []
                    async for chunk in sum_llm.stream_completion(
                        system_prompt="You are a concise intent classifier.",
                        messages=[{"role": "user", "content": intent_prompt}],
                    ):
                        if chunk.content:
                            iparts.append(chunk.content)
                    if iparts:
                        intent = "".join(iparts).strip()

                except Exception as llm_err:
                    logger.error("S2S post-call LLM summarisation failed: %s", llm_err)

            await db.close_session(
                session_id=session_id,
                turn_count=len(log_entries),
                metadata={"summary": summary, "intent": intent, "mode": "speech_speech"},
            )
            logger.info("S2S session %s archived.", session_id[:8])

            # Post-call webhook for S2S mode
            _post_call_url = bot_config.get("post_call_webhook_url", "")
            if _post_call_url and summary != "No meaningful conversation occurred.":
                try:
                    import httpx as _httpx
                    async with _httpx.AsyncClient(timeout=10.0) as _hc:
                        await _hc.post(_post_call_url, json={
                            "session_id": session_id,
                            "user_id": language,  # language is in scope from outer
                            "summary": summary,
                            "intent": intent,
                            "mode": "speech_speech",
                        })
                except Exception as _wh_err:
                    logger.warning("S2S post-call webhook failed: %s", _wh_err)

        except Exception as archive_err:
            logger.error("Failed to archive S2S session %s: %s", session_id[:8], archive_err)


if __name__ == "__main__":
    uvicorn.run("voicebot.main:app", host="0.0.0.0", port=8000, reload=False)
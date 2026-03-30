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

# --- Import Routers from sub-packages ---
from voicebot.api.v1.routes import router as gateway_v1_router
from voicebot.core.transport import WebSocketVoiceTransport

# Lazy import providers in voice_websocket to handle dynamic selection
# from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider

settings = get_settings()
logger = setup_logger("voicebot-unified", level=settings.log_level)


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Unified VoiceBot Server starting (ENV=%s)...", settings.env)
    yield
    logger.info("🛑 Unified VoiceBot Server shutting down...")


app = FastAPI(
    title="Unified VoiceBot Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
)

# CORS Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Mount REST API
app.include_router(gateway_v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Aggregated health check for all internal modules."""
    return {
        "status": "healthy",
        "env": settings.env,
        "services": {
            "gateway": "online",
            "orchestrator": "online",
            "stt": settings.stt_provider,
            "llm": settings.llm_provider,
            "tts": settings.tts_provider,
        }
    }


# ─── Unified WebSocket Handler ──────────────────────────────────────────

@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    session_id: str,
    language: str = Query(default="en"),
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

    # Sync session in SQLite (with user_id for cross-session memory)
    await db.create_session(
        session_id=session_id,
        bot_id=bot_config.get("id"),
        language=language,
        user_id=user_id,
    )

    # Initialize Providers with bot-specific overrides
    try:
        # STT
        stt_provider = DeepgramStreamingProvider(language=language)
        
        # LLM
        llm_model = bot_config.get("llm_model")
        if not llm_model:
            raise ValueError(f"Bot '{bot_config.get('name', 'Unknown')}' has no LLM Model configured. Please update its settings.")
        llm_provider = GroqStreamingProvider(model=llm_model)

        # TTS (Detect Provider from voice_id)
        voice_id = bot_config.get("voice_id")
        if not voice_id:
            raise ValueError(f"Bot '{bot_config.get('name', 'Unknown')}' has no Voice Profile configured. Please update its settings.")
            
        # Select TTS provider.
        # 'deepgram_ws' → persistent WebSocket (low latency, ~50 ms TTFS).
        # 'deepgram_http' or aura-* voice ID → HTTP POST per segment (~200-400 ms TTFS).
        # ElevenLabs voice IDs contain digits (e.g. "21m00Tcm4TlvDq8ikWAM").
        _tts_prov_name = str(bot_config.get("tts_provider") or "").lower()
        _is_deepgram_voice = "aura-" in str(voice_id).lower() or not any(c.isdigit() for c in str(voice_id))

        if _tts_prov_name == "deepgram_ws" or (_is_deepgram_voice and _tts_prov_name not in ("deepgram_http", "elevenlabs")):
            # Use persistent WS TTS when explicitly requested or auto-detected as Deepgram voice.
            from voicebot.services.tts.deepgram_ws_tts_provider import DeepgramWSTTSProvider
            tts_provider = DeepgramWSTTSProvider(model=voice_id)
            try:
                await asyncio.wait_for(tts_provider.connect(), timeout=8.0)
                logger.info("Using Deepgram WS TTS (model=%s) ✅", voice_id)
            except Exception as _tts_err:
                logger.warning("Deepgram WS TTS connect failed (%s) — falling back to HTTP TTS", _tts_err)
                from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
                tts_provider = DeepgramTTSProvider(model=voice_id)
                logger.info("Using Deepgram HTTP TTS (model=%s)", voice_id)
        elif _is_deepgram_voice:
            from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
            tts_provider = DeepgramTTSProvider(model=voice_id)
            logger.info("Using Deepgram HTTP TTS (model=%s)", voice_id)
        else:
            from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
            tts_provider = ElevenLabsStreamingProvider(voice_id=voice_id)
            logger.info("Using ElevenLabs TTS (voice=%s)", voice_id)
            # Attach Redis cache for high-frequency phrase caching
            memory_local = RedisSessionProvider(redis_url=settings.redis_url)
            await memory_local.connect()
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

    # Callback definitions (via transport abstraction for WebSocket / future WebRTC)
    async def on_state_change(state: str):
        if vt.connected:
            await vt.send_json({"type": "status", "state": state, "session_id": session_id})

    normalizer = AudioFrameNormalizer()

    async def on_audio_output(audio_bytes: bytes):
        if vt.connected:
            await normalizer.push(audio_bytes, vt.send_bytes)

    async def on_transcript(text: str, is_final: bool):
        if vt.connected:
            await vt.send_json({"type": "transcript", "text": text, "is_final": is_final})

    async def on_bot_transcript(text: str, is_final: bool):
        if vt.connected:
            await vt.send_json({"type": "bot_transcript", "text": text, "is_final": is_final})
        # Flush any sub-frame audio bytes held by the normalizer when the
        # bot's full turn is complete (is_final == True from _finalize_turn).
        if is_final and vt.connected:
            await normalizer.flush(vt.send_bytes)

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

    voice_session_close_sent = False

    async def on_voice_session_end(reason: str):
        """Notify client and close WebSocket after the assistant turn (and TTS) completes."""
        nonlocal voice_session_close_sent
        if voice_session_close_sent:
            return
        voice_session_close_sent = True
        logger.info("Voice session end (%s): %s", session_id[:8], reason)
        if vt.connected:
            try:
                await vt.send_json(
                    {
                        "type": "session_ended",
                        "reason": reason,
                        "session_id": session_id,
                    }
                )
            except Exception as send_err:
                logger.warning("session_ended notify failed: %s", send_err)
        try:
            await websocket.close(code=1000)
        except Exception:
            pass

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
    )
    # Attach optional vector memory for RAG
    if vector_memory and getattr(vector_memory, "_available", False):
        brain._vector_memory = vector_memory

    # STT Callback — forward confidence to brain for low-confidence recovery
    async def stt_callback(text, is_final, lang, confidence, **kwargs):
        await brain.process_stt_partial(text, is_final, confidence=confidence, **kwargs)
        
    try:
        # Step 1: Attempt to connect to STT (Deepgram)
        try:
            await asyncio.wait_for(stt_provider.connect(on_transcript=stt_callback), timeout=5.0)
            logger.info("✅ STT Bridge established (session=%s)", session_id[:8])
        except Exception as e:
            logger.warning("⚠️ STT Bridge failed: %s. Reverting to Simulator Mode.", e)
            await vt.send_json({
                "type": "log", 
                "tag": "[SYSTEM]", 
                "message": "STT Offline: Using Simulator Mode only.", 
                "color": "text-yellow-400"
            })
            # We don't re-raise here; we want the session to continue for text/simulator usage.
        
        # Step 2: Notify ready state
        await vt.send_json({
            "type": "status",
            "state": "listening",
            "session_id": session_id,
            "message": "Voice bot ready."
        })

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

        # --- AUTO GREETING ---
        # Trigger initial greeting turn. Even if TTS fails, transcript will be sent.
        try:
            await brain.start_conversation()
        except Exception as e:
            logger.error("Greeting failed: %s", e)

        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                await brain.process_audio_chunk(data["bytes"])
            elif "text" in data:
                logger.info("📩 Message received: %s", data["text"][:100])
                try:
                    msg = json.loads(data["text"])
                    msg_type = msg.get("type")
                    
                    if msg_type == "config":
                        # DYNAMIC RECONFIGURATION
                        llm_choice = msg.get("llm", "groq")
                        llm_model = msg.get("llmModel")
                        
                        if llm_choice == "gemini":
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
             logger.error("Runtime error in session %s: %s", session_id[:8], e, exc_info=True)
    except Exception as e:
        logger.error("Error in session %s: %s", session_id[:8], e, exc_info=True)
    finally:
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()
        await brain.cleanup()
        await stt_provider.disconnect()
        if hasattr(tts_provider, "disconnect"):
            await tts_provider.disconnect()
        
        # --- Post-Call Summarization ---
        try:
            log_entries = await db.get_session_log(session_id)
            transcript_text = "\n".join([f"{e['role']}: {e['content']}" for e in log_entries if e['role'] in ['user', 'assistant']])
            
            summary = "No meaningful conversation occurred."
            intent = "Unknown"
            
            if len(log_entries) > 1 and transcript_text.strip():
                try:
                    from voicebot.services.llm.groq_provider import GroqStreamingProvider
                    sum_llm = GroqStreamingProvider(model="llama-3.3-70b-versatile")
                    
                    # Generate Summary
                    prompt = "Summarize the following conversation in exactly 1 or 2 concise sentences. Focus solely on the user's primary intent and the resolution. Do not add conversational filler:\n\n" + transcript_text
                    sum_parts = []
                    async for chunk in sum_llm.stream_completion([{"role": "user", "content": prompt}]):
                        sum_parts.append(chunk)
                    if sum_parts:
                         summary = "".join(sum_parts).strip()
                         
                    # Generate Intent Tag
                    intent_prompt = "Based on the following conversation, provide a strict 1-3 word noun phrase representing the core operational intent (e.g., 'Password Reset', 'Technical Inquiry', 'General Chat'). Output ONLY the tag, nothing else.\n\n" + transcript_text
                    intent_parts = []
                    async for chunk in sum_llm.stream_completion([{"role": "user", "content": intent_prompt}]):
                        intent_parts.append(chunk)
                    if intent_parts:
                        intent = "".join(intent_parts).strip()
                        
                except Exception as llm_err:
                    logger.error("LLM Summarization failed: %s", llm_err)
            
            await db.close_session(
                session_id=session_id, 
                turn_count=len(log_entries), 
                metadata={'summary': summary, 'intent': intent}
            )
            logger.info("Session %s archived with summary.", session_id[:8])

            # Store summary in vector memory for future RAG retrieval
            if vector_memory and getattr(vector_memory, "_available", False) and summary != "No meaningful conversation occurred.":
                try:
                    await vector_memory.store_conversation(
                        session_id=session_id,
                        summary=summary,
                        user_id=user_id,
                    )
                except Exception as _vec_err:
                    logger.debug("Vector memory store failed: %s", _vec_err)

            # Post-call webhook: fire summary to external URL if configured
            _post_call_url = bot_config.get("post_call_webhook_url", "")
            if _post_call_url and summary != "No meaningful conversation occurred.":
                try:
                    import httpx as _httpx
                    async with _httpx.AsyncClient(timeout=10.0) as _hc:
                        await _hc.post(_post_call_url, json={
                            "session_id": session_id,
                            "user_id": user_id,
                            "bot_id": bot_config.get("id"),
                            "summary": summary,
                            "intent": intent,
                            "turn_count": len(log_entries),
                        })
                    logger.info("Post-call webhook fired for session %s", session_id[:8])
                except Exception as _wh_err:
                    logger.warning("Post-call webhook failed: %s", _wh_err)

        except Exception as archive_err:
            logger.error("Failed to archive session %s: %s", session_id[:8], archive_err)

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

            if "bytes" in data:
                await bridge.send_audio(data["bytes"])

            elif "text" in data:
                try:
                    msg      = json.loads(data["text"])
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
                    from voicebot.services.llm.groq_provider import GroqStreamingProvider
                    sum_llm = GroqStreamingProvider(model="llama-3.3-70b-versatile")

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
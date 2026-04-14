"""
API v1 Routes — REST and WebSocket endpoints for the Gateway Service.

Includes:
- Session management
- Bot CRUD (create, list, update, delete personas)
- History endpoints (sessions, conversation logs, appointments)
- TTS and LLM test utilities
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import os
import uuid
from typing import Optional

import httpx
from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    BackgroundTasks,
    Request,
    File,
    UploadFile,
)
from starlette.websockets import WebSocketState

from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger, correlation_id_var, session_id_var
from voicebot.shared.logging.logger import generate_correlation_id
from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.shared.livekit_util import normalize_livekit_client_url
from voicebot.services.auth.auth_service import (
    hash_password,
    issue_access_token,
    verify_password,
)
from voicebot.shared.utils.validation import is_valid_api_key

# Guardrails
from voicebot.core.guardrails import get_rule_metadata, RuleSuggestor
from voicebot.shared.policy import parse_json_dict
from voicebot.services.stt.deepgram_provider import (
    extract_linear16_pcm_16k_mono,
    resolve_stt_language_for_session,
    transcribe_sandbox_via_streaming_provider,
)

settings = get_settings()
logger = setup_logger("gateway-routes", level=settings.log_level)

router = APIRouter()

_MAX_STT_SANDBOX_BYTES = 6 * 1024 * 1024

# Shared DB instance for REST routes
_db: Optional[SQLiteProvider] = None


async def get_db() -> SQLiteProvider:
    global _db
    if _db is None:
        _db = SQLiteProvider()
        await _db.initialize()
    return _db


def _actor(request: Request) -> tuple[str, str]:
    user_id = str(getattr(request.state, "user_id", "") or "")
    roles = getattr(request.state, "roles", []) or []
    role = "admin" if "admin" in roles else "user"
    return user_id, role


def _require_admin(request: Request) -> str:
    user_id, role = _actor(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user_id


def _can_access_owner(owner_user_id: Optional[str], actor_user_id: str, actor_role: str) -> bool:
    if actor_role == "admin":
        return True
    return bool(owner_user_id) and owner_user_id == actor_user_id


def _livekit_keys_configured() -> bool:
    key = (settings.livekit_api_key or "").strip()
    secret = (settings.livekit_api_secret or "").strip()
    if not key or not secret:
        return False
    # Treat template .env.example values as unset so we return a clear error.
    if "your_livekit" in key.lower() or "your_livekit" in secret.lower():
        return False
    return True


def _livekit_join_bundle(session_id: str, user_id: Optional[str]) -> tuple[Optional[dict], Optional[str]]:
    """
    Return (join_bundle, error_message).
    join_bundle is None when LiveKit JWT cannot be produced.
    """
    if not _livekit_keys_configured():
        return None, (
            "Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (not placeholder values). "
            "For docker `livekit/livekit-server:latest --dev` use API key devkey and secret secret."
        )
    try:
        from livekit.api import AccessToken, VideoGrants
    except ImportError as e:
        logger.warning("LiveKit JWT unavailable: %s", e)
        return None, (
            "Python package livekit-api is not installed in this environment. "
            "Run: pip install livekit-api"
        )

    try:
        room_name = f"voice-{session_id[:8]}"
        uid = user_id or f"user-{session_id[:8]}"
        token = (
            AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(uid)
            .with_name(f"Voice Bot Session {session_id[:8]}")
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
        )
        raw = (settings.livekit_client_url or "").strip() or (
            settings.livekit_url or ""
        )
        url = normalize_livekit_client_url(raw)
        return {
            "url": url,
            "token": token.to_jwt(),
            "room_name": room_name,
        }, None
    except Exception as e:
        logger.warning("LiveKit bundle failed: %s", e)
        return None, f"LiveKit token build failed: {e}"


# ─── Auth + User Management ───────────────────────────────────────────────────

@router.post("/auth/login", tags=["auth"])
async def login(data: dict):
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not username or not password:
        raise HTTPException(status_code=422, detail="'username' and 'password' are required")
    db = await get_db()
    user = await db.get_user_by_username(username)
    if not user or int(user.get("is_active", 0)) != 1:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, str(user.get("password_hash") or "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = issue_access_token(
        user_id=str(user["id"]),
        username=str(user["username"]),
        role=str(user["role"]),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@router.get("/auth/me", tags=["auth"])
async def me(request: Request):
    user_id, _ = _actor(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    db = await get_db()
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "is_active": user["is_active"],
    }


@router.get("/admin/users", tags=["admin"])
async def list_users(request: Request):
    _require_admin(request)
    db = await get_db()
    users = await db.list_users()
    return {"users": users, "count": len(users)}


@router.post("/admin/users", tags=["admin"])
async def create_user(request: Request, data: dict):
    _require_admin(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    role = str(data.get("role") or "user").lower()
    if role not in ("admin", "user"):
        raise HTTPException(status_code=422, detail="role must be admin|user")
    if not username or not password:
        raise HTTPException(status_code=422, detail="'username' and 'password' are required")
    db = await get_db()
    existing = await db.get_user_by_username(username)
    if existing:
        raise HTTPException(status_code=409, detail="username already exists")
    user = await db.create_user(username=username, password_hash=hash_password(password), role=role)
    return {"status": "created", "user": user}


@router.patch("/admin/users/{user_id}", tags=["admin"])
async def patch_user(user_id: str, request: Request, data: dict):
    _require_admin(request)
    db = await get_db()
    target = await db.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ok = await db.update_user(
        user_id,
        username=data.get("username"),
        role=data.get("role"),
        is_active=data.get("is_active"),
    )
    return {"status": "updated" if ok else "noop", "user_id": user_id}


@router.patch("/admin/users/{user_id}/password", tags=["admin"])
async def patch_user_password(user_id: str, request: Request, data: dict):
    _require_admin(request)
    password = str(data.get("password") or "")
    if not password:
        raise HTTPException(status_code=422, detail="'password' is required")
    db = await get_db()
    target = await db.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ok = await db.change_password(user_id, hash_password(password))
    return {"status": "updated" if ok else "noop", "user_id": user_id}


# ─── Session Endpoints ────────────────────────────────────────────────────────

@router.post("/sessions", tags=["sessions"])
async def create_session(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = None,
    bot_id: Optional[str] = None,
    transport: str = "websocket",
    language: str = "hi",
):
    """
    Create a new voice session.
    Returns session_id and WebSocket URL for the client to connect.
    When transport is webrtc or livekit and LiveKit is configured, includes join credentials.
    """
    import uuid
    session_id = str(uuid.uuid4())
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    owner_user_id = actor_user_id
    if actor_role == "admin" and user_id:
        owner_user_id = str(user_id)
    language_explicit = "language" in request.query_params
    session_language = (language or "hi").strip().lower() or "hi"
    if bot_id and not language_explicit:
        bot = await db.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if not _can_access_owner(bot.get("owner_user_id"), actor_user_id, actor_role):
            raise HTTPException(status_code=404, detail="Bot not found")
        bot_lang = str((bot or {}).get("default_language") or "").strip().lower()
        if bot_lang:
            session_language = bot_lang

    # Hydrate metadata if this user_id is a customer account
    metadata = {}
    if owner_user_id:
        customer = await db.get_customer(owner_user_id)
        if customer:
            # Map database columns to standard metadata keys
            metadata = {
                # Display-friendly keys (for [Customer Name])
                "Customer Name": customer.get("customer_name"),
                "Account Number": customer.get("account_number"),
                "Balance": customer.get("balance"),
                "Account Type": customer.get("account_type"),
                "Due Date": customer.get("emi_due_date") or customer.get("next_due"),
                "EMI Amount": customer.get("emi_amount"),
                # Database-style keys (for [customer_name] or pointers)
                "customer_name": customer.get("customer_name"),
                "account_number": customer.get("account_number"),
                "balance": customer.get("balance"),
                "account_type": customer.get("account_type"),
                "emi_due_date": customer.get("emi_due_date"),
                "next_due": customer.get("next_due"),
                "emi_amount": customer.get("emi_amount"),
            }
            # Also include any custom metadata stored in the customer record
            test_meta = customer.get("test_meta_data")
            if test_meta:
                 try:
                     metadata.update(json.loads(test_meta))
                 except:
                     pass

    await db.create_session(
        session_id,
        bot_id=bot_id,
        user_id=owner_user_id,
        language=session_language,
        metadata=metadata
    )
    logger.info("Created session %s for user %s (bot=%s, metadata_keys=%s) transport=%s", 
                session_id[:8], owner_user_id, bot_id, list(metadata.keys()), transport)

    ws_url = f"/ws/voice/{session_id}"
    if bot_id:
        ws_url += f"?bot_id={bot_id}"
    if session_language:
        ws_url += f"{'&' if '?' in ws_url else '?'}language={session_language}"

    out: dict = {
        "session_id": session_id,
        "websocket_url": ws_url,
        "status": "created",
        "bot_id": bot_id,
        "transport": transport,
        "livekit": None,
    }
    tnorm = (transport or "websocket").lower()
    if tnorm in ("webrtc", "livekit"):
        lk, lk_err = _livekit_join_bundle(session_id, owner_user_id)
        out["livekit"] = lk
        if lk:
            # Automate: Trigger the LiveKit Voice Agent in the background
            try:
                from voicebot.livekit_agent import LiveKitVoiceAgent
                # 🔑 PASS FULL UUID: We pass the full session_id to the agent so it can hydrate metadata.
                agent = LiveKitVoiceAgent(lk["room_name"], bot_id=bot_id, session_id=session_id)
                background_tasks.add_task(agent.start)
                logger.info("Triggered LiveKit Agent for room %s (session: %s)", lk["room_name"], session_id[:8])
            except Exception as e:
                logger.error("Failed to trigger LiveKit Agent: %s", e)
        if lk is None and lk_err:
            out["livekit_error"] = lk_err

    return out


@router.get("/sessions", tags=["sessions"])
async def list_sessions(request: Request, limit: int = 50):
    """List recent voice sessions with metadata."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    sessions = await db.list_sessions(limit=limit)
    if actor_role != "admin":
        sessions = [s for s in sessions if str(s.get("user_id") or "") == actor_user_id]
    return {"sessions": sessions, "count": len(sessions)}


@router.post("/sessions/{session_id}/translate", tags=["sessions"])
async def translate_session_transcript(
    session_id: str,
    request: Request,
    target_lang: str = Query(..., description="Target language for translation"),
):
    from voicebot.core.translation import translate_transcript
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    bot_config = await db.get_bot(session['bot_id']) or {}
    log_entries = await db.get_session_log(session_id)
    
    if not log_entries:
        return {"translated_text": ""}
        
    translated = await translate_transcript(log_entries, target_lang, bot_config)
    return {"translated_text": translated}


@router.get("/sessions/{session_id}", tags=["sessions"])
async def get_session(session_id: str, request: Request):
    """Get metadata details for a specific voice session."""
    db = await get_db()
    session_data = await db.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session_data.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    return session_data


@router.get("/sessions/{session_id}/log", tags=["sessions"])
async def get_session_log(session_id: str, request: Request):
    """Get full conversation transcript for a session."""
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    log = await db.get_session_log(session_id)
    return {"session_id": session_id, "turns": log, "count": len(log)}


@router.post("/sessions/{session_id}/feedback", tags=["sessions"])
async def submit_session_feedback(session_id: str, data: dict, request: Request):
    """Submit CSAT feedback for a completed session."""
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    outcome = data.get("outcome", "resolved")
    csat_score = int(data.get("csat_score", 5))
    notes = data.get("notes")
    if outcome not in ("resolved", "escalated", "abandoned"):
        raise HTTPException(status_code=422, detail="outcome must be resolved|escalated|abandoned")
    if csat_score not in (1, 2, 3, 4, 5):
        raise HTTPException(status_code=422, detail="csat_score must be 1-5")
    result = await db.save_session_feedback(session_id, outcome, csat_score, notes)
    return {"status": "saved", "feedback": result}


@router.get("/sessions/{session_id}/feedback", tags=["sessions"])
async def get_session_feedback(session_id: str, request: Request):
    """Get stored CSAT feedback for a session."""
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    feedback = await db.get_session_feedback(session_id)
    return {"session_id": session_id, "feedback": feedback}


@router.get("/sessions/{session_id}/facts", tags=["sessions"])
async def get_session_facts(session_id: str, request: Request):
    """Return user facts extracted during a session."""
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    facts = await db.get_session_facts(session_id)
    return {"session_id": session_id, "facts": facts, "count": len(facts)}


@router.post("/sessions/{session_id}/summarize", tags=["sessions"])
async def summarize_session(session_id: str):
    """
    Generate or refresh conversation summary and intent using this session's bot LLM
    (same provider/model as configured on the bot).
    """
    from voicebot.core.session_transcript_analysis import analyze_transcript_with_bot_llm

    db = await get_db()
    sess = await db.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    bot_id = sess.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="Session has no bot_id")
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found for this session")
    log_entries = await db.get_session_log(session_id)
    summary, intent, insights, llm_ran, entity_rows = await analyze_transcript_with_bot_llm(
        log_entries,
        bot,
        respect_enable_post_call_flag=False,
    )
    patch: dict = {"summary": summary, "intent": intent, "insights": insights}
    if llm_ran:
        patch["llm_analysis_at"] = int(time.time())
        patch["session_nlp_version"] = 2
        try:
            await db.replace_session_extracted_facts(
                session_id, sess.get("user_id"), entity_rows
            )
        except Exception as _ent_persist:
            logger.warning(
                "Persist extracted entities failed for %s: %s",
                session_id[:8],
                _ent_persist,
            )
    await db.merge_session_metadata(session_id, patch)
    return {
        "session_id": session_id,
        "summary": summary,
        "intent": intent,
        "insights": insights,
        "entities_saved": len(entity_rows) if llm_ran else 0,
        "session_nlp_version": patch.get("session_nlp_version"),
        "llm_analysis_at": patch.get("llm_analysis_at"),
    }


@router.post("/sessions/{session_id}/recommend", tags=["sessions"])
async def recommend_for_session(session_id: str, request: Request, data: Optional[dict] = None):
    """
    Generate AI recommendations for the last call:
    - recommended prompt
    - recommended persona
    - recommended llm provider/model

    Uses Gemini Flash first (gemini-2.0-flash-001). Falls back to Groq on any failure.
    Persists results to session.metadata.recommendations.
    """
    import re
    import json as _json
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider

    db = await get_db()
    sess = await db.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not _can_access_owner(sess.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")

    bot_id = sess.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="Session has no bot_id")
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found for this session")

    log_entries = await db.get_session_log(session_id)
    transcript_text = "\n".join(
        f"{e.get('role')}: {e.get('content')}"
        for e in (log_entries or [])
        if e.get("role") in ("user", "assistant")
    ).strip()
    if not transcript_text:
        raise HTTPException(status_code=422, detail="Session has no transcript text")

    payload = data or {}
    goal = str(payload.get("goal") or "").strip()
    constraints = str(payload.get("constraints") or "").strip()

    prompt = (
        "You are an expert voice-bot product operator.\n"
        "Given the call transcript, propose improvements for the next call.\n\n"
        "Return ONLY valid JSON with exactly these keys:\n"
        "{\n"
        '  \"recommended_prompt\": string,\n'
        '  \"recommended_persona\": string,\n'
        '  \"recommended_llm_provider\": string,\n'
        '  \"recommended_llm_model\": string,\n'
        '  \"why\": string[]\n'
        "}\n\n"
        "Rules:\n"
        "- recommended_prompt: concise, actionable system prompt for the bot.\n"
        "- recommended_persona: short persona description and tone.\n"
        "- why: 3-6 short bullet strings.\n"
        "- Do not include markdown, no code fences, no extra keys.\n\n"
        f"Goal (optional): {goal or '(not provided)'}\n"
        f"Constraints (optional): {constraints or '(not provided)'}\n\n"
        "Transcript:\n"
        f"{transcript_text}\n"
    )

    async def _run_llm(llm) -> tuple[dict, str]:
        parts: list[str] = []
        async for chunk in llm.stream_completion(
            system_prompt="You output strict JSON only.",
            messages=[{"role": "user", "content": prompt}],
        ):
            if chunk.content:
                parts.append(chunk.content)
        raw = "".join(parts).strip()
        # Some providers may wrap JSON in whitespace; recover with a simple bracket slice.
        t = raw.strip()
        fence = re.search(r"```(?:json)?\\s*([\\s\\S]*?)\\s*```", t, re.IGNORECASE)
        if fence:
            t = fence.group(1).strip()
        try:
            obj = _json.loads(t)
        except Exception:
            i = t.find("{")
            j = t.rfind("}")
            if i >= 0 and j > i:
                obj = _json.loads(t[i : j + 1])
            else:
                raise
        if not isinstance(obj, dict):
            raise ValueError("recommendation output was not a JSON object")
        return obj, raw

    llm_used = "groq"
    llm_model = getattr(settings, "groq_model", None) or "llama-3.3-70b-versatile"
    llm = GroqStreamingProvider(model=llm_model)

    # Prefer Gemini Flash when configured.
    if is_valid_api_key(getattr(settings, "gemini_api_key", None)):
        try:
            llm_used = "gemini"
            llm_model = "gemini-2.0-flash-001"
            llm = GeminiStreamingProvider(model=llm_model)
            rec, raw = await _run_llm(llm)
        except Exception as _gem_err:
            logger.warning("DIY recommend: Gemini failed, falling back to Groq: %s", _gem_err)
            llm_used = "groq"
            llm_model = getattr(settings, "groq_model", None) or "llama-3.3-70b-versatile"
            llm = GroqStreamingProvider(model=llm_model)
            rec, raw = await _run_llm(llm)
    else:
        rec, raw = await _run_llm(llm)

    # Minimal validation/sanitization
    out = {
        "recommended_prompt": str(rec.get("recommended_prompt") or "").strip(),
        "recommended_persona": str(rec.get("recommended_persona") or "").strip(),
        "recommended_llm_provider": str(rec.get("recommended_llm_provider") or "").strip().lower(),
        "recommended_llm_model": str(rec.get("recommended_llm_model") or "").strip(),
        "why": rec.get("why") if isinstance(rec.get("why"), list) else [],
    }
    out["why"] = [str(x).strip() for x in out["why"] if str(x).strip()][:8]
    if not out["recommended_prompt"] or not out["recommended_persona"]:
        raise HTTPException(status_code=502, detail="LLM did not produce required recommendation fields")

    now_ts = int(time.time())
    await db.merge_session_metadata(session_id, {
        "recommendations": out,
        "recommendations_at": now_ts,
        "recommendations_llm": f"{llm_used}:{llm_model}",
        # Keep raw response for debugging (can be removed later if too large)
        "recommendations_raw": raw[:8000],
    })

    return {
        "session_id": session_id,
        "generated_at": now_ts,
        "llm_used": f"{llm_used}:{llm_model}",
        "recommendations": out,
    }


@router.post("/diy/persona", tags=["diy"])
async def diy_generate_persona(request: Request, data: Optional[dict] = None):
    """
    Generate a persona + system prompt for DIY With AI.

    Uses Gemini Flash first (gemini-2.0-flash-001). Falls back to Groq on any failure.
    Returns strict JSON fields used by the frontend Persona Builder page.
    """
    import re
    import json as _json
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider

    actor_user_id, _actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = data or {}
    objective = str(payload.get("objective") or "").strip()
    domain = str(payload.get("domain") or "").strip()
    language = str(payload.get("language") or "").strip().lower()  # "en" | "hi"
    tone = str(payload.get("tone") or "").strip()
    constraints = str(payload.get("constraints") or "").strip()

    if language not in ("en", "hi", ""):
        raise HTTPException(status_code=422, detail="language must be 'en' or 'hi'")

    prompt = (
        "You are an expert voice-bot persona designer.\n"
        "Create a voice agent persona and a system prompt for a live phone-style conversation.\n\n"
        "Return ONLY valid JSON with exactly these keys:\n"
        "{\n"
        '  \"title\": string,\n'
        '  \"tags\": string[],\n'
        '  \"default_language\": \"en\" | \"hi\",\n'
        '  \"persona\": string,\n'
        '  \"system_prompt\": string,\n'
        '  \"tts_provider\": string\n'
        "}\n\n"
        "Rules:\n"
        "- title: short label like 'Female · Hindi · Soft · Focus'.\n"
        "- tags: 3-6 short lowercase tags.\n"
        "- default_language: 'en' or 'hi'. If not specified, infer from the request.\n"
        "- persona: 1-2 sentences describing style/tone.\n"
        "- system_prompt: concise, actionable instructions for the agent.\n"
        "- tts_provider: set to 'elevenlabs'.\n"
        "- No markdown, no code fences, no extra keys.\n\n"
        f"Objective: {objective or '(not provided)'}\n"
        f"Domain: {domain or '(not provided)'}\n"
        f"Language hint: {language or '(infer)'}\n"
        f"Tone hint: {tone or '(infer)'}\n"
        f"Constraints (optional): {constraints or '(none)'}\n"
    )

    async def _run_llm(llm) -> tuple[dict, str]:
        parts: list[str] = []
        async for chunk in llm.stream_completion(
            system_prompt="You output strict JSON only.",
            messages=[{"role": "user", "content": prompt}],
        ):
            if chunk.content:
                parts.append(chunk.content)
        raw = "".join(parts).strip()
        t = raw.strip()
        fence = re.search(r"```(?:json)?\\s*([\\s\\S]*?)\\s*```", t, re.IGNORECASE)
        if fence:
            t = fence.group(1).strip()
        try:
            obj = _json.loads(t)
        except Exception:
            i = t.find("{")
            j = t.rfind("}")
            if i >= 0 and j > i:
                obj = _json.loads(t[i : j + 1])
            else:
                raise
        if not isinstance(obj, dict):
            raise ValueError("persona output was not a JSON object")
        return obj, raw

    llm_used = "groq"
    llm_model = getattr(settings, "groq_model", None) or "llama-3.3-70b-versatile"
    llm = GroqStreamingProvider(model=llm_model)

    if is_valid_api_key(getattr(settings, "gemini_api_key", None)):
        try:
            llm_used = "gemini"
            llm_model = "gemini-2.0-flash-001"
            llm = GeminiStreamingProvider(model=llm_model)
            rec, raw = await _run_llm(llm)
        except Exception as _gem_err:
            logger.warning("DIY persona: Gemini failed, falling back to Groq: %s", _gem_err)
            llm_used = "groq"
            llm_model = getattr(settings, "groq_model", None) or "llama-3.3-70b-versatile"
            llm = GroqStreamingProvider(model=llm_model)
            rec, raw = await _run_llm(llm)
    else:
        rec, raw = await _run_llm(llm)

    out = {
        "title": str(rec.get("title") or "").strip(),
        "tags": rec.get("tags") if isinstance(rec.get("tags"), list) else [],
        "default_language": str(rec.get("default_language") or language or "en").strip().lower(),
        "persona": str(rec.get("persona") or "").strip(),
        "system_prompt": str(rec.get("system_prompt") or "").strip(),
        "tts_provider": str(rec.get("tts_provider") or "elevenlabs").strip().lower(),
    }
    out["tags"] = [str(x).strip().lower() for x in out["tags"] if str(x).strip()][:10]
    if out["default_language"] not in ("en", "hi"):
        out["default_language"] = "en"
    if out["tts_provider"] != "elevenlabs":
        out["tts_provider"] = "elevenlabs"
    if not out["title"] or not out["persona"] or not out["system_prompt"]:
        raise HTTPException(status_code=502, detail="LLM did not produce required persona fields")

    return {
        "generated_at": int(time.time()),
        "llm_used": f"{llm_used}:{llm_model}",
        "persona": out,
        "raw": raw[:8000],
    }


# ─── Bot Registry CRUD ────────────────────────────────────────────────────────

@router.get("/bots", tags=["bots"])
async def list_bots(request: Request):
    """List all active bot configurations with aggregate usage."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    bots = await db.list_bots()
    if actor_role != "admin":
        bots = [b for b in bots if str(b.get("owner_user_id") or "") == actor_user_id]
    
    # Enrich with lifetime usage
    enriched = []
    for bot in bots:
        usage = await db.get_bot_usage(bot["id"])
        enriched.append({**bot, "lifetime_usage": usage})
        
    return {"bots": enriched, "count": len(bots)}


@router.get("/bots/{bot_id}", tags=["bots"])
async def get_bot(bot_id: str, request: Request):
    """Get a specific bot configuration by ID with usage stats."""
    db = await get_db()
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(bot.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    
    usage = await db.get_bot_usage(bot_id)
    return {**bot, "lifetime_usage": usage}


@router.post("/bots", tags=["bots"])
async def create_bot(data: dict, request: Request):
    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    """
    Create a new bot persona.
    
    Required: name, system_prompt
    Optional: description, persona, greeting, tools_enabled, llm_model, voice_id
    """
    db = await get_db()
    name = data.get("name")
    system_prompt = data.get("system_prompt")
    if not name or not system_prompt:
        raise HTTPException(status_code=422, detail="'name' and 'system_prompt' are required")

    try:
        result = await db.create_bot(
            name=name,
            persona=data.get("persona", "helpful and friendly AI assistant"),
            system_prompt=system_prompt,
            description=data.get("description", ""),
            greeting=data.get("greeting"),
            tools_enabled=data.get("tools_enabled", ["search_knowledge", "book_appointment", "get_appointments", "remember_user_fact"]),
            llm_provider=data.get("llm_provider", ""),
            llm_model=data.get("llm_model", "llama-3.3-70b-versatile"),
            voice_id=data.get("voice_id"),
            role=data.get("role", "AI Assistant"),
            icon=data.get("icon", "bot"),
            color=data.get("color", "primary"),
            temperature=data.get("temperature", 0.7),
            max_tokens=data.get("max_tokens", 2048),
            tts_provider=data.get("tts_provider", "deepgram_ws"),
            default_language=data.get("default_language", "hi"),
            proactive_prompts=data.get("proactive_prompts", []),
            owner_user_id=actor_user_id if actor_role != "admin" else data.get("owner_user_id", actor_user_id),
            min_stt_confidence=data.get("min_stt_confidence", 0.35),
            tts_model=data.get("tts_model"),
        )
        bid = result.get("id")
        if bid:
            patch = {}
            for key in (
                "guardrail_policy",
                "data_access_policy",
                "conversation_policy",
                "pipeline_mode",
                "llm_provider",
                "workflow_id",
                "agent_task_spec",
            ):
                if key in data:
                    patch[key] = data[key]
            if patch:
                await db.update_bot(bid, **patch)
        return {"status": "created", **result}
    except Exception as e:
        if "UNIQUE constraint" in str(e):
            raise HTTPException(status_code=409, detail=f"Bot with name '{name}' already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/bots/{bot_id}", tags=["bots"])
async def update_bot(bot_id: str, data: dict, request: Request):
    """Update a bot's configuration fields."""
    db = await get_db()
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(bot.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    await db.update_bot(bot_id, **data)
    return {"status": "updated", "bot_id": bot_id}


@router.post("/bots/{bot_id}/stt-sandbox", tags=["bots", "stt"])
async def stt_sandbox(
    bot_id: str,
    file: UploadFile = File(...),
    raw_pcm: bool = Query(
        False,
        description="Raw s16le mono 16kHz PCM (same as live WebSocket). Otherwise WAV must be 16-bit mono 16kHz.",
    ),
):
    """
    STT only via DeepgramStreamingProvider (WebSocket + SileroVADGate + send_audio), same as live voice.
    """
    db = await get_db()
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")

    key = (settings.deepgram_api_key or "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Deepgram API key not configured")

    data = await file.read()
    if len(data) > _MAX_STT_SANDBOX_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio too large (max {_MAX_STT_SANDBOX_BYTES // (1024 * 1024)} MB)")

    pol = parse_json_dict(bot.get("conversation_policy"))
    session_lang = (bot.get("default_language") or "hi").strip()
    resolved = resolve_stt_language_for_session(session_lang, pol)
    stt_model = str(pol.get("stt_model") or "nova-2").strip() or "nova-2"

    _stt_ep = pol.get("stt_endpointing_ms")
    try:
        _stt_ep_i = int(_stt_ep) if _stt_ep is not None else None
    except (TypeError, ValueError):
        _stt_ep_i = None
    _stt_vad = pol.get("stt_rms_vad_threshold")
    try:
        _stt_vad_f = float(_stt_vad) if _stt_vad is not None else None
    except (TypeError, ValueError):
        _stt_vad_f = None

    fn = (file.filename or "").lower()
    ct0 = (file.content_type or "").split(";")[0].strip().lower()
    if not raw_pcm and not (
        fn.endswith(".wav") or ct0 in ("audio/wav", "audio/x-wav")
    ):
        raise HTTPException(
            status_code=415,
            detail="Upload 16-bit mono 16kHz .wav, or send raw PCM with raw_pcm=true",
        )

    try:
        pcm = extract_linear16_pcm_16k_mono(data, raw_pcm=raw_pcm)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        transcript, confidence, q = await transcribe_sandbox_via_streaming_provider(
            pcm,
            api_key=key,
            language=resolved,
            model=stt_model,
            endpointing_ms=_stt_ep_i,
            vad_rms_threshold=_stt_vad_f,
        )
    except Exception as e:
        logger.exception("stt-sandbox failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return {
        "transcript": transcript,
        "confidence": confidence,
        "resolved_stt_language": resolved,
        "default_language": session_lang,
        "deepgram_query_params": q,
    }


@router.delete("/bots/{bot_id}", tags=["bots"])
async def delete_bot(bot_id: str, request: Request):
    """Soft-delete a bot (marks as inactive)."""
    db = await get_db()
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(bot.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    await db.delete_bot(bot_id)
    return {"status": "deleted", "bot_id": bot_id}


@router.delete("/workflows/{workflow_id}", tags=["workflows"])
async def delete_workflow(workflow_id: str, request: Request):
    """Hard-delete a workflow by ID."""
    db = await get_db()
    wf = await db.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(wf.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete_workflow(workflow_id)
    return {"status": "deleted", "workflow_id": workflow_id}


@router.delete("/sessions/{session_id}", tags=["sessions"])
async def delete_session(session_id: str, request: Request):
    """Hard-delete a session and all associated logs/facts/feedback."""
    db = await get_db()
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(session.get("user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete_session(session_id)
    return {"status": "deleted", "session_id": session_id}


# ─── Dynamic Test Customer Management ──────────────────────────────────────────
@router.get("/test-customers/schema", tags=["testing"])
async def get_test_customer_schema():
    """Get the current structure of the customer_accounts table."""
    db = await get_db()
    schema = await db.get_customer_schema()
    return {"columns": schema}

@router.post("/test-customers/schema/columns", tags=["testing"])
async def add_test_customer_column(data: dict):
    """Dynamically add a new column to the test database."""
    name = data.get("name")
    data_type = data.get("type", "TEXT")
    if not name:
        raise HTTPException(status_code=422, detail="Column 'name' is required")
    db = await get_db()
    ok, message = await db.add_customer_column(name, data_type)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return {"status": "success", "column": name, "message": message}

@router.get("/test-customers", tags=["testing"])
async def list_test_customers():
    """List all test customer accounts with their current data."""
    db = await get_db()
    customers = await db.list_customers_dynamic()
    return {"customers": customers, "count": len(customers)}

@router.post("/test-customers", tags=["testing"])
async def upsert_test_customer(data: dict):
    """Create or update a test customer record."""
    if "account_number" not in data:
         raise HTTPException(status_code=422, detail="account_number is required")
    db = await get_db()
    try:
        account_number = await db.upsert_customer_dynamic(data)
        return {"status": "success", "account_number": account_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/test-customers/{account_number}", tags=["testing"])
async def delete_test_customer(account_number: str):
    """Remove a test customer account."""
    db = await get_db()
    ok = await db.delete_customer(account_number)
    return {"status": "deleted" if ok else "not_found"}


@router.put("/test-customers/{account_number}/metadata", tags=["testing"])
async def update_test_customer_metadata(account_number: str, data: dict):
    """Update simulation overrides (test_meta_data) in the database."""
    db = await get_db()
    metadata = data.get("metadata", {})
    await db.update_customer_metadata(account_number, metadata)
    return {"status": "updated"}

# ─── Workflow Endpoints ───────────────────────────────────────────────────────

# Icon mapping: node type → icon name (matches mock structure)
_NODE_ICON_MAP = {
    "speech":    "MessageSquare",
    "bot-says":  "MessageSquare",
    "userInput": "Search",
    "user-input":"Search",
    "logic":     "GitBranch",
    "smart-branch": "GitBranch",
    "sentiment": "Smile",
    "language":  "Globe",
    "backtrack": "RotateCcw",
    "action":    "Bell",
    "knowledge": "BookOpen",
    "trigger":   "AlertTriangle",
}

def _enrich_workflow(wf: dict) -> dict:
    """Transform raw SQLite row into the rich response the frontend expects."""
    import datetime
    nodes = wf.get("nodes", [])
    updated_ts = wf.get("updated_at") or wf.get("created_at") or 0
    try:
        last_updated = datetime.datetime.fromtimestamp(float(updated_ts)).strftime("%b %d, %Y · %H:%M")
    except Exception:
        last_updated = "—"

    # Build steps summary from nodes (mirrors old mock `steps` array)
    steps = []
    for n in nodes:
        ntype = n.get("type", "")
        data = n.get("data") or n.get("config") or {}
        label = data.get("label") or n.get("id", ntype)
        steps.append({
            "id":          n.get("id"),
            "type":        ntype,
            "label":       label,
            "description": data.get("speech") or data.get("message") or data.get("template") or "",
            "icon":        _NODE_ICON_MAP.get(ntype, "Zap"),
        })

    return {
        **wf,
        # Derived UI fields
        "status":      "Active" if wf.get("is_active", 1) else "Inactive",
        "lastUpdated": last_updated,
        "steps":       steps,
    }


@router.get("/workflows", tags=["workflows"])
async def list_workflows(request: Request):
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    workflows = await db.list_workflows()
    if actor_role != "admin":
        workflows = [w for w in workflows if str(w.get("owner_user_id") or "") == actor_user_id]
    enriched = [_enrich_workflow(wf) for wf in workflows]
    return {"workflows": enriched, "count": len(enriched)}


# NOTE: /workflows/test must be declared BEFORE /workflows/{workflow_id}
# so FastAPI doesn't capture 'test' as a workflow_id.
@router.post("/workflows/test", tags=["workflows"])
async def test_workflow(data: dict):
    """
    Dry-run simulation for workflow nodes and engines.
    Pass 'workflow_data' (nodes/edges structure), 'user_input' (what user said),
    and optionally 'current_node_id' to resume from a specific state.
    """
    from voicebot.core.orchestrator.brain import AgenticBrain
    from voicebot.shared.models.session import SessionState
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from unittest.mock import AsyncMock
    from voicebot.core.orchestrator.workflow_engine import WorkflowEngine

    workflow_data = data.get("workflow_data", {})
    user_input = data.get("user_input", "")
    current_node_id = data.get("current_node_id")
    node_visit_counts = data.get("node_visit_counts", {})
    metadata = data.get("metadata", {}) # Allow injecting test variables

    if current_node_id:
        workflow_data["start_node_id"] = current_node_id

    session = SessionState(session_id="test_simulator")
    if metadata:
        session.metadata.update(metadata) # Inject the test data
        
    llm = GroqStreamingProvider(model="llama-3.3-70b-versatile")

    brain = AgenticBrain(
        session=session,
        llm_handler=llm,
        db_handler=await get_db(),
    )

    speak_responses = []
    async def mock_speak(text: str):
        speak_responses.append(text)

    brain._generate_and_speak = mock_speak
    brain._log_event = AsyncMock()

    workflow_engine = WorkflowEngine(brain, workflow_data)
    # Inject persistent visit counts for simulator turns
    workflow_engine.node_visit_counts = node_visit_counts
    
    yield_to_llm = await workflow_engine.evaluate(user_input)

    return {
        "status": "success",
        "speak_responses": speak_responses,
        "yield_to_llm": yield_to_llm,
        "next_node_id": workflow_engine.current_node_id,
        "intent": workflow_engine.last_intent, # Add intent here
        "node_visit_counts": workflow_engine.node_visit_counts,
        "is_disconnected": bool(
            getattr(session, "voice_session_end_requested", False)
            or getattr(session, "_force_disconnect", False)
        )
    }


@router.get("/workflows/{workflow_id}", tags=["workflows"])
async def get_workflow(workflow_id: str, request: Request):
    db = await get_db()
    wf = await db.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    actor_user_id, actor_role = _actor(request)
    if not _can_access_owner(wf.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _enrich_workflow(wf)


@router.post("/workflows", tags=["workflows"])
async def save_workflow(data: dict, request: Request):
    import uuid
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    workflow_id = data.get("id") or str(uuid.uuid4())
    name = data.get("name", "Untitled Workflow")
    description = data.get("description", "")
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    if data.get("id"):
        existing = await db.get_workflow(workflow_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Workflow not found")
        if not _can_access_owner(existing.get("owner_user_id"), actor_user_id, actor_role):
            raise HTTPException(status_code=404, detail="Workflow not found")
    await db.save_workflow(
        workflow_id, name, description, nodes, edges, owner_user_id=actor_user_id
    )
    wf = await db.get_workflow(workflow_id)
    return _enrich_workflow(wf) if wf else {"status": "saved", "id": workflow_id}


@router.post("/workflows/ai-suggest", tags=["workflows"])
async def ai_suggest_node_content(data: dict):
    """
    Generate professional/friendly suggestions for speech nodes
    or intent lists for user input nodes.
    """
    node_type = data.get("node_type", "speech")
    current_text = data.get("current_text", "")
    tone = data.get("tone", "professional")
    context = data.get("context", "")

    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.shared.config import get_settings
    
    _settings = get_settings()
    llm = GroqStreamingProvider(model=_settings.groq_model or "llama-3.3-70b-versatile")
    
    if node_type == "speech":
        system_prompt = "You are a professional copywriter for a voice AI assistant."
        user_prompt = (
            f"Rewrite the following bot response to be more {tone}.\n\n"
            f"Original: \"{current_text}\"\n"
            f"Context (what was said before): \"{context}\"\n\n"
            "Provide ONLY the rewritten text. No quotes, no preamble, no explanations."
        )
    else:
        # Default to suggesting intents/labels for logic/userInput nodes
        system_prompt = "You are a workflow designer for a conversational bot."
        user_prompt = (
            f"Suggest 3 common user responses or button labels for the following bot message context: \"{context}\".\n"
            "Return them as a simple comma-separated list. No preamble."
        )

    chunks = []
    async for chunk in llm.stream_completion(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    ):
        chunks.append(chunk.content or "")
    
    suggestion = "".join(chunks).strip()
    # Clean up quotes if LLM hallucinated them
    suggestion = suggestion.strip('"').strip("'")
    
    return {"suggestion": suggestion}


@router.post("/workflows/ai-node-architect", tags=["workflows"])
async def ai_node_architect(data: dict):
    """
    Bidirectional AI Node Optimization & Generation.
    Supports contextual refactoring and 'Next Step' generation using the graph neighborhood.
    """
    op = data.get("operation_type", "REFACTOR")
    current_node = data.get("current_node", {})
    predecessors = data.get("predecessors", [])
    successors = data.get("successors", [])
    strategy_prompt = data.get("strategy_prompt", "")
    tone = data.get("tone", "professional")
    workflow_goal = data.get("workflow_goal", "Collect overdue payments or assist user")

    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.shared.config import get_settings
    _settings = get_settings()
    llm = GroqStreamingProvider(model=_settings.groq_model or "llama-3.3-70b-versatile")

    # Context formatting
    context_str = ""
    if predecessors:
        context_str += "PREDECESSORS (Who spoke before):\n"
        for p in predecessors:
            context_str += f"- Node '{p.get('id')}': {p.get('data', {}).get('speech', p.get('data', {}).get('label'))}\n"
    if successors:
        context_str += "SUCCESSORS (Where we are going next):\n"
        for s in successors:
            context_str += f"- Node '{s.get('id')}': {s.get('data', {}).get('speech', s.get('data', {}).get('label'))}\n"

    if op == "REFACTOR":
        system_prompt = "You are an expert conversational designer and copywriter."
        user_prompt = (
            f"Optimize the content of the current node to better fit its logical neighborhood. Goal: {workflow_goal}.\n\n"
            f"CURRENT NODE: {current_node.get('data', {}).get('speech', current_node.get('data', {}).get('label'))}\n"
            f"{context_str}\n"
            f"STRATEGY INSTRUCTION: {strategy_prompt or 'Make it fit naturally in the flow.'}\n\n"
            "Respond with the optimized text ONLY. Do not include labels, quotes or meta-text."
        )
    elif op == "SUGGEST_NEXT":
        system_prompt = "You are an expert AI workflow architect. You generate new ReactFlow nodes as JSON."
        user_prompt = (
            f"Based on the current node and its neighborhood, suggest the most logical NEXT step in the workflow.\n\n"
            f"CURRENT NODE: {json.dumps(current_node)}\n"
            f"{context_str}\n"
            f"GOAL: {workflow_goal}\n"
            f"STRATEGY: {strategy_prompt or 'Continue the logical path.'}\n\n"
            "Return a JSON object with 'type' (speech, logic, action, userInput), 'label' (short title), and 'speech' (if applicable).\n"
            "Example: {\"type\": \"logic\", \"label\": \"Confirm Intent\", \"speech\": \"\"}"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid operation_type")

    chunks = []
    async for chunk in llm.stream_completion(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    ):
        chunks.append(chunk.content or "")
    
    result = "".join(chunks).strip()
    
    if op == "SUGGEST_NEXT":
        try:
            # Extract JSON if LLM added preamble
            start = result.find("{")
            end = result.rfind("}")
            if start != -1 and end != -1:
                return {"suggestion": json.loads(result[start:end+1])}
        except: pass
    
    return {"suggestion": result}


@router.post("/workflows/generate-from-prompt", tags=["workflows"])
async def generate_workflow_from_prompt(data: dict):
    """
    Advanced Two-Stage AI Workflow Generation.
    Stage 1: Architect a conversational strategy (Blueprint).
    Stage 2: Build the deterministic node-edge graph (JSON).
    """
    user_prompt = data.get("prompt", "")
    if not user_prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.shared.config import get_settings
    import uuid
    import json

    _settings = get_settings()
    llm = GroqStreamingProvider(
        model=_settings.groq_model or "llama-3.3-70b-versatile",
        max_tokens=4096
    )

    # --- STAGE 1: THE STRATEGIST ---
    # Goal: Think about the conversation structure before writing code/JSON.
    strategist_prompt = (
        "You are a Senior Voice UX Strategist. Analyze the following request and create a detailed conversation 'Blueprint'.\n"
        "Your blueprint must outline:\n"
        "1. The Happy Path (Goal Achievement).\n"
        "2. The Persistence Strategy: For high-stakes goals (e.g. Payment), plan a 3-tier persuasion strategy:\n"
        "   - Tier 1: Empathy (Acknowledge and Softly Persuade).\n"
        "   - Tier 2: Benefit/Value (Explain the 'Why' and 'Opportunity').\n"
        "   - Tier 3: Consequence/Risk (Final warning before escalation).\n"
        "3. Semantic Intent Anchors: Identify key topics and give them descriptive labels (e.g. 'Payment_Date', 'Address_Update').\n"
        "4. Interaction Engagement: Every bot turn MUST end with a clear question or call-to-action (CTA). NO MONOLOGUES.\n"
        "5. Emotional Logic: Identify where a user might get angry and plan a 'Fast-Exit' (Escalation) for negative sentiment.\n"
        "\nOutput the Blueprint in structured text (bullet points)."
    )
    
    blueprint_chunks = []
    async for chunk in llm.stream_completion(
        system_prompt=strategist_prompt,
        messages=[{"role": "user", "content": f"Create a strategy for: {user_prompt}"}]
    ):
        blueprint_chunks.append(chunk.content or "")
    blueprint = "".join(blueprint_chunks)

    # --- STAGE 2: THE ARCHITECT ---
    # Goal: Convert the strategy into precise JSON.
    architect_system = (
        "You are an expert AI Voice Workflow Architect. Convert the provided Blueprint into a complete React Flow graph in JSON format.\n\n"
        "STRICT CONSTRAINTS:\n"
        "1. Output ONLY a valid JSON object. No preamble, no markdown formatting.\n"
        "2. Structure: { \"name\": string, \"description\": string, \"nodes\": [...], \"edges\": [...] }\n"
        "3. Nodes must include: { \"id\": string, \"type\": \"speech\"|\"userInput\"|\"logic\"|\"action\"|\"knowledge\"|\"backtrack\"|\"sentiment\"|\"llm_fallback\", \"position\": {\"x\": number, \"y\": number}, \"data\": { \"label\": string, \"speech\": string, \"intents\": string[], \"retry_limit\": number } }\n"
        "4. INTENT BRANCHING & PERSISTENCE:\n"
        "   - Every 'userInput' that requires a decision MUST be followed by a 'logic' node.\n"
        "   - Standardize Intent Labels: Use 'confirmed', 'denied', 'unclear', 'payment_chosen', 'reschedule'.\n"
        "   - BRANCHING LOGIC: Differentiate SUCCESS and FAILURE paths. NEVER link a 'denied' or 'failure' edge to a 'Success/Conclusion' node. Create separate nodes for 'Escalation' or 'Terminal_Exit_Denied'.\n"
        "   - PERSISTENCE LOOPS: For high-stakes topics (Overdue, ID Confirmation), use a looping retry strategy:\n"
        "     * Logic nodes MUST have 'retry_1', 'retry_2', 'retry_3' edges reaching 'Tier' nodes (Empathy, Benefit, Risk).\n"
        "     * IMPORTANT: Every 'speech' node MUST terminate with an engaging question that moves toward the primary task goal.\n"
        "     * These 'Tier' (Speech) nodes MUST link back to the preceding 'userInput' node to create a loop, allowing multiple attempts.\n"
        "     * If a user speaks about payment during Identity confirmation, create a 'retry_1' loop to a 'Reprompt' node.\n"
        "   - For 'logic' nodes, use `\"retry_limit\": 3`.\n"
        "5. SINK NODE PROTECTION:\n"
        "   - Every 'sentiment' node MUST have an outgoing edge to an 'llm_fallback' node. DO NOT leave them isolated.\n"
        "   - Every 'action' or 'terminal' node that doesn't end the call should either link forward or to a 'Conclusion' node.\n"
        "6. ISLAND NODES: 'knowledge' and 'backtrack' nodes can remain unlinked (Islands).\n"
        "7. LAYOUT: Distribute nodes in a top-down tree. Place Islands (KB/Sentiment) to the far right (X > 1400)."
    )

    graph_chunks = []
    async for chunk in llm.stream_completion(
        system_prompt=architect_system,
        messages=[{"role": "user", "content": f"Architect the following Blueprint into JSON:\n\n{blueprint}"}]
    ):
        graph_chunks.append(chunk.content or "")
    
    raw_json = "".join(graph_chunks).strip()
    # Use robust extraction
    try:
        wf_data = _extract_json_object(raw_json)
        
        # --- Normalization ---
        if "edges" in wf_data:
            normalized_edges = []
            for edge in wf_data["edges"]:
                source = edge.get("source") or edge.get("from")
                target = edge.get("target") or edge.get("to")
                if not source or not target: continue
                normalized_edges.append({
                    "id": edge.get("id") or str(uuid.uuid4()),
                    "source": source, "target": target,
                    "label": edge.get("label", ""), "animated": True
                })
            wf_data["edges"] = normalized_edges
            
        wf_data["name"] = wf_data.get("name") or "Advanced AI Workflow"
        wf_data["description"] = wf_data.get("description") or f"Strategy: {blueprint[:200]}..."
        wf_data["id"] = str(uuid.uuid4())
        
        # --- Auto-Layout Engine ---
        _apply_auto_layout(wf_data)
        
        return wf_data
        
    except Exception as e:
        logger.error("[WorkflowGenerator] Failed to parse: %s", e)
        # Attempt repair
        try:
            last_brace = raw_json.rfind("}")
            if last_brace != -1:
                wf_data = json.loads(raw_json[:last_brace+1])
                wf_data["id"] = str(uuid.uuid4())
                return wf_data
        except: pass
        raise HTTPException(status_code=500, detail=f"Drafting logic failed: {str(e)}")
        wf_data["id"] = str(uuid.uuid4())
        
        return wf_data
    except Exception as e:
        logger.error("[WorkflowGenerator] Failed to parse AI JSON: %s", e)
        logger.debug("[WorkflowGenerator] Raw Response: %s", raw_json)
        # Attempt simple repair: if it ends with "}" but has trailing garbage
        try:
            last_brace = raw_json.rfind("}")
            if last_brace != -1:
                repaired = raw_json[:last_brace+1]
                wf_data = json.loads(repaired)
                # Apply normalization even to repaired JSON
                if "edges" in wf_data:
                    wf_data["edges"] = [
                        {
                            "id": e.get("id") or str(uuid.uuid4()),
                            "source": e.get("source") or e.get("from"),
                            "target": e.get("target") or e.get("to"),
                            "label": e.get("label", ""),
                            "animated": True
                        } for e in wf_data["edges"] if (e.get("source") or e.get("from")) and (e.get("target") or e.get("to"))
                    ]
                wf_data["id"] = str(uuid.uuid4())
                return wf_data
        except: pass
        
        raise HTTPException(status_code=500, detail=f"AI generated invalid workflow structure: {str(e)}")

# ─── Appointments Endpoints ───────────────────────────────────────────────────

@router.get("/appointments", tags=["data"])
async def list_appointments(user_name: Optional[str] = None, limit: int = 20):
    """List upcoming appointments, optionally filtered by name."""
    db = await get_db()
    appts = await db.get_appointments(user_name=user_name, limit=limit)
    return {"appointments": appts, "count": len(appts)}


@router.post("/appointments", tags=["data"])
async def create_appointment(data: dict):
    """Book an appointment directly via REST (useful for testing)."""
    db = await get_db()
    required = ["user_name", "date", "time"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {missing}")
    result = await db.book_appointment(
        user_name=data["user_name"],
        date=data["date"],
        time_str=data["time"],
        reason=data.get("reason", ""),
    )
    return {"status": "booked", "appointment": result}


# ─── Knowledge Base Endpoints ─────────────────────────────────────────────────

@router.get("/knowledge/search", tags=["data"])
async def search_knowledge(request: Request, q: str, bot_id: Optional[str] = None):
    """Search the knowledge base (useful for testing retrieval)."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    if actor_role != "admin" and bot_id:
        bot = await db.get_bot(bot_id)
        if not bot or str(bot.get("owner_user_id") or "") != actor_user_id:
            raise HTTPException(status_code=404, detail="Bot not found")
    results = await db.search_knowledge(q, bot_id=bot_id)
    if actor_role != "admin":
        results = [r for r in results if str(r.get("owner_user_id") or actor_user_id) == actor_user_id or r.get("bot_id") is None]
    return {"query": q, "results": results, "count": len(results)}


@router.get("/knowledge", tags=["data"])
async def list_knowledge(request: Request, limit: int = 100):
    """List all knowledge base entries."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    entries = await db.list_knowledge(limit=limit)
    if actor_role != "admin":
        entries = [e for e in entries if str(e.get("owner_user_id") or "") == actor_user_id]
    return {"entries": entries, "count": len(entries)}


@router.post("/knowledge", tags=["data"])
async def add_knowledge(data: dict, request: Request):
    """Add a knowledge base entry."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    if not actor_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    bot_id = data.get("bot_id")
    if bot_id:
        bot = await db.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if not _can_access_owner(bot.get("owner_user_id"), actor_user_id, actor_role):
            raise HTTPException(status_code=404, detail="Bot not found")
    if not data.get("question") or not data.get("answer"):
        raise HTTPException(status_code=422, detail="Question and Answer are required")
    await db.add_knowledge(
        topic=data.get("topic", "General"),
        question=data["question"],
        answer=data["answer"],
        keywords=data.get("keywords", []),
        bot_id=bot_id,
        priority=data.get("priority", 0),
        owner_user_id=actor_user_id if actor_role != "admin" else data.get("owner_user_id", actor_user_id),
    )
    return {"status": "added"}


@router.delete("/knowledge/{entry_id}", tags=["data"])
async def delete_knowledge(entry_id: int, request: Request):
    """Delete a knowledge base entry."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    entries = await db.list_knowledge(limit=100000)
    ent = next((e for e in entries if int(e.get("id", -1)) == entry_id), None)
    if not ent:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    if not _can_access_owner(ent.get("owner_user_id"), actor_user_id, actor_role):
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    await db.delete_knowledge(entry_id)
    return {"status": "deleted", "id": entry_id}


# ─── Metadata Endpoints ───────────────────────────────────────────────────────
def is_valid_key(key: str) -> bool:
    """Check if API key is valid (not empty or placeholder)."""
    if not key:
        return False
    # Treat template .env.example values as unset
    invalid_patterns = ["your_", "test_", "demo_", "xxxx", "1234"]
    key_lower = key.lower()
    return not any(p in key_lower for p in invalid_patterns)


@router.get("/metadata/models", tags=["metadata"])
async def get_supported_models():
    """List supported LLM models across providers. Keys checked via settings (loaded from .env)."""
    models = []

    # ✅ GROQ
    if is_valid_key(settings.groq_api_key):
        models += [
            {
                "id": "llama-3.3-70b-versatile",
                "name": "Llama 3.3 70B (Groq)",
                "provider": "groq",
                "context_window": 128000,
                "max_tpm": 6000,
                "cost_per_1k": 0.0006,
                "tags": ["fast", "balanced"]
            },
            {
                "id": "llama-3.1-8b-instant",
                "name": "Llama 3.1 8B (Groq)",
                "provider": "groq",
                "context_window": 128000,
                "max_tpm": 30000,
                "cost_per_1k": 0.00005,
                "tags": ["fast", "cheap"]
            },
        ]

    # ✅ GEMINI (Native) - Updated for 2026 Fleet
    if is_valid_key(settings.gemini_api_key):
        models += [
            {
                "id": "gemini-3.1-flash-lite-preview",
                "name": "Gemini 3.1 Flash Lite (Latest)",
                "provider": "gemini",
                "context_window": 1048576,
                "max_tpm": 1000000,
                "cost_per_1k": 0.00001,
                "tags": ["fastest", "realtime"]
            },
            {
                "id": "gemini-2.5-flash-preview-tts",
                "name": "Gemini 2.5 Flash (TTS Preview)",
                "provider": "gemini",
                "context_window": 1048576,
                "max_tpm": 1000000,
                "cost_per_1k": 0.00002,
                "tags": ["premium", "native-audio"]
            },
            {
                "id": "gemini-2.5-flash",
                "name": "Gemini 2.5 Flash (Production)",
                "provider": "gemini",
                "context_window": 1048576,
                "max_tpm": 1000000,
                "cost_per_1k": 0.00002,
                "tags": ["fast", "balanced"]
            },
            {
                "id": "gemini-2.5-flash-lite",
                "name": "Gemini 2.5 Flash Lite",
                "provider": "gemini",
                "context_window": 1048576,
                "max_tpm": 1000000,
                "cost_per_1k": 0.00001,
                "tags": ["cheap", "fallback"]
            },
        ]

    # ✅ OPENAI
    if is_valid_key(settings.openai_api_key):
        models += [
            {
                "id": "gpt-4o",
                "name": "GPT-4o (Premium)",
                "provider": "openai",
                "context_window": 128000,
                "max_tpm": 200000,
                "cost_per_1k": 0.005,
                "tags": ["premium", "balanced"]
            },
            {
                "id": "gpt-4o-mini",
                "name": "GPT-4o mini",
                "provider": "openai",
                "context_window": 128000,
                "max_tpm": 1000000,
                "cost_per_1k": 0.00015,
                "tags": ["fast", "cheap"]
            },
        ]

    # ✅ OPENROUTER
    if is_valid_key(settings.openrouter_api_key):
        models += [
            {
                "id": "google/gemini-2.0-flash-001",
                "name": "Gemini 2.0 Flash (OR)",
                "provider": "openrouter",
                "context_window": 1048576,
                "max_tpm": 20000,
                "cost_per_1k": 0.0001,
                "tags": ["fast", "realtime"]
            },
            {
                "id": "google/gemini-flash-1.5-8b",
                "name": "Gemini Flash 8B (OR)",
                "provider": "openrouter",
                "context_window": 1048576,
                "max_tpm": 20000,
                "cost_per_1k": 0.0,
                "tags": ["free", "fast"]
            },
            {
                "id": "google/gemini-2.0-flash-lite-001",
                "name": "Gemini 2.0 Flash Lite (OR)",
                "provider": "openrouter",
                "context_window": 1048576,
                "max_tpm": 20000,
                "cost_per_1k": 0.0,
                "tags": ["free", "fast", "low-code"]
            },
            {
                "id": "anthropic/claude-3-haiku",
                "name": "Claude Haiku (OR Fast)",
                "provider": "openrouter",
                "context_window": 200000,
                "max_tpm": 20000,
                "cost_per_1k": 0.00025,
                "tags": ["fast"]
            },
        ]

    # ✅ ANTHROPIC
    if is_valid_key(settings.anthropic_api_key):
        models += [
            {
                "id": "claude-3-5-haiku-latest",
                "name": "Claude 3.5 Haiku",
                "provider": "anthropic",
                "context_window": 200000,
                "max_tpm": 100000,
                "cost_per_1k": 0.00025,
                "tags": ["fast", "balanced"]
            },
            {
                "id": "claude-3-5-sonnet-latest",
                "name": "Claude 3.5 Sonnet",
                "provider": "anthropic",
                "context_window": 200000,
                "max_tpm": 80000,
                "cost_per_1k": 0.003,
                "tags": ["smart", "coding"]
            },
        ]

    return {
        "models": models,
        "total": len(models),
        "available_providers": list(set([m["provider"] for m in models]))
    }

@router.get("/metadata/voices", tags=["metadata"])
async def get_supported_voices():
    """List supported TTS voices across providers, dynamically fetching ElevenLabs voices."""
    voices = []

    # ✅ DEEPGRAM (Aura)
    if is_valid_key(settings.deepgram_api_key):
        voices += [
            {"id": "aura-asteria-en", "name": "Asteria (Hindi Accent / Deepgram)", "provider": "deepgram"},
            {"id": "aura-luna-en", "name": "Luna (Deepgram)", "provider": "deepgram"},
            {"id": "aura-stella-en", "name": "Stella (Hinglish / Deepgram)", "provider": "deepgram"},
            {"id": "aura-athena-en", "name": "Athena (Hinglish / Deepgram)", "provider": "deepgram"},
        ]

    # ✅ GEMINI (Native TTS)
    if is_valid_key(settings.gemini_api_key):
        voices += [
            {"id": "Zephyr", "name": "Zephyr (Warm / Gemini)", "provider": "gemini"},
            {"id": "Puck", "name": "Puck (Energetic / Gemini)", "provider": "gemini"},
            {"id": "Charon", "name": "Charon (Deep / Gemini)", "provider": "gemini"},
            {"id": "Corey", "name": "Corey (Natural / Gemini)", "provider": "gemini"},
        ]

    # ✅ ELEVENLABS (Dynamic Fetch)
    if is_valid_key(settings.elevenlabs_api_key):
        try:
            # from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
            # provider = ElevenLabsStreamingProvider()
            # el_voices = await provider.get_voices()
            # if el_voices:
            #     # Filter out known failing voices
            #     blacklist = ["RnauXKDOkyVg9FjwISwR", "FGY2WhTYpPnrIDTdsKH5"]
            #     el_voices = [v for v in el_voices if v["id"] not in blacklist]
            #     voices += el_voices
            # else:
            #     # Fallback to high-quality Hindi set if API fails
            voices += [
                    {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah (Hindi - Natural)", "provider": "elevenlabs"},
                    {"id": "zEvjs17jNQ2fH5FxAat2", "name": "Anika (Hindi - Gentle)", "provider": "elevenlabs"},
                    {"id": "BKAA4PPBFfn6s91XfihW", "name": "Roopa (Hindi - Professional)", "provider": "elevenlabs"},
                ]
        except Exception as e:
            logger.error("Failed to fetch ElevenLabs voices: %s", e)

    return {"voices": voices, "total": len(voices)}
    
@router.get("/metadata/guardrails", tags=["metadata", "guardrails"])
async def get_guardrail_options():
    """Return available trigger types, actions, and their metadata for UI builders."""
    return get_rule_metadata()

@router.post("/bots/{bot_id}/suggest-rules", tags=["bots", "guardrails"])
async def suggest_bot_rules(bot_id: str):
    """Analyze bot persona and suggest 5 tailored security guardrails."""
    db = await get_db()
    bot = await db.get_bot(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    suggestor = RuleSuggestor()
    suggestions = await suggestor.suggest_rules(
        bot_id=bot_id,
        persona=bot.get("persona", "general assistant"),
        system_prompt=bot.get("system_prompt", "")
    )
    
    # Also include the standard library for the user to pick from
    library = suggestor.get_standard_library()
    
    return {
        "bot_id": bot_id,
        "suggested_rules": [r.dict() for r in suggestions],
        "library_rules": [r.dict() for r in library]
    }

@router.post("/bots/suggest-prompt", tags=["bots"])
async def suggest_bot_prompt(data: dict):
    """Generate a high-quality system prompt based on bot identity and role."""
    name = str(data.get("name") or "").strip()
    role = str(data.get("role") or "").strip()
    persona = str(data.get("persona") or "").strip()
    
    if not name or not role:
        raise HTTPException(status_code=422, detail="'name' and 'role' are required for suggestion")
    
    from voicebot.core.guardrails.prompt_suggestor import SystemPromptSuggestor
    suggestor = SystemPromptSuggestor()
    suggested = await suggestor.suggest_prompt(
        name=name, 
        role=role, 
        persona=persona, 
        current_prompt=data.get("current_prompt")
    )
    
    return suggested


@router.get("/scopes", tags=["bots"])
async def list_scopes():
    """Return available tool scopes and the tools each scope enables."""
    from voicebot.core.orchestrator.brain import _SCOPE_TOOL_NAMES
    return {"scopes": {k: list(v) for k, v in _SCOPE_TOOL_NAMES.items()}}


def _extract_json_object(text: str) -> dict:
    """Robustly extract the first valid JSON object from LLM output."""
    import re
    # Strip markdown fences first
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Find the outermost { ... } block and parse that
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Last-resort: repair a truncated JSON object
    try:
        return _repair_truncated_json(text)
    except Exception:
        pass
    raise ValueError(f"No valid JSON object found in LLM response. Raw: {text[:200]}")


def _apply_auto_layout(wf_data: dict):
    """
    Deterministic hierarchical layout algorithm.
    Organizes nodes into a top-down tree with centering and 'Island Node' side-tracking.
    """
    nodes = wf_data.get("nodes", [])
    edges = wf_data.get("edges", [])
    if not nodes: return

    adj = {n["id"]: [] for n in nodes}
    in_degree = {n["id"]: 0 for n in nodes}
    for e in edges:
        source, target = e.get("source"), e.get("target")
        if source in adj and target in adj:
            adj[source].append(target)
            in_degree[target] += 1

    # Constants
    DY = 250
    DX = 600
    ISLAND_X = 1400
    CENTER_X = 600

    # 1. Identify Islands vs Tree Nodes
    island_types = ["knowledge", "backtrack", "sentiment", "llm_fallback"]
    islands = [n for n in nodes if n.get("type") in island_types or (in_degree[n["id"]] == 0 and not adj[n["id"]])]
    tree_node_ids = [n["id"] for n in nodes if n not in islands]
    
    # 2. Assign positions to Islands
    for i, n in enumerate(islands):
        n["position"] = {"x": ISLAND_X, "y": i * 150 + 50}

    # 3. Perform BFS on the main tree(s)
    roots = [n_id for n_id in tree_node_ids if in_degree[n_id] == 0]
    if not roots and tree_node_ids: roots = [tree_node_ids[0]] # Circle fallback
    
    levels = {} # depth -> [node_ids]
    visited = set()
    queue = [(r_id, 0) for r_id in roots]
    
    while queue:
        n_id, depth = queue.pop(0)
        if n_id in visited: continue
        visited.add(n_id)
        
        if depth not in levels: levels[depth] = []
        levels[depth].append(n_id)
        
        for child_id in adj.get(n_id, []):
            if child_id not in visited:
                queue.append((child_id, depth + 1))

    # 4. Final Position mapping
    node_map = {n["id"]: n for n in nodes if n["id"] in visited}
    for depth, level_nodes in levels.items():
        count = len(level_nodes)
        row_width = (count - 1) * DX
        start_x = CENTER_X - (row_width / 2)
        
        for i, n_id in enumerate(level_nodes):
            node_map[n_id]["position"] = {
                "x": start_x + (i * DX),
                "y": depth * DY + 50
            }

def _repair_truncated_json(text: str) -> dict:
    """Close an unclosed JSON object caused by mid-stream safety truncation."""
    import re
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    # Trim back to the last safe delimiter (comma or opening brace) to drop a partial value
    last_safe = max(cleaned.rfind(","), cleaned.rfind("{"))
    if last_safe > 0:
        cleaned = cleaned[:last_safe]
    # Count unclosed brackets and braces
    open_braces = cleaned.count("{") - cleaned.count("}")
    open_brackets = cleaned.count("[") - cleaned.count("]")
    cleaned += "]" * open_brackets + "}" * open_braces
    return json.loads(cleaned)


@router.post("/guardrails/suggest-data-access", tags=["guardrails"])
async def suggest_data_access_policy(data: dict):
    """Use AI to suggest data_access_policy based on bot context."""
    name = data.get("name", "")
    role = data.get("role", "")
    # Truncate system_prompt to avoid injecting special chars that break LLM JSON output
    raw_prompt = data.get("system_prompt", "")
    prompt_summary = raw_prompt[:250].replace('"', "'") if raw_prompt else ""
    available_scopes = data.get("available_scopes", {})

    scope_descriptions = "\n".join(
        f"  {scope}: {tools}"
        for scope, tools in available_scopes.items()
    )

    prompt = (
        f"Bot name: {name}\n"
        f"Bot role: {role}\n"
        f"Bot purpose summary: {prompt_summary}\n\n"
        f"Available scopes and their tools:\n{scope_descriptions}\n\n"
        "Return a JSON object selecting which scopes to enable for this bot.\n"
        "Rules:\n"
        "- Only include scopes relevant to the bot purpose.\n"
        "- Set appointments_match_session_user true only if bot handles personal appointments.\n"
        "- Include integrations.weather only if weather scope is selected.\n"
        "- The reasoning value must be a single plain sentence with no quotes inside.\n\n"
        "Required output format (JSON only, no markdown, no extra text):\n"
        '{"enabled_scopes":["scope1"],"appointments_match_session_user":false,'
        '"integrations":{},"reasoning":"reason here"}'
    )

    try:
        from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
        llm = GeminiStreamingProvider()
        result = ""
        # Use stream_completion (generate_content_stream) — immune to the silent
        # truncation that complete() (generate_content) suffers when safety filters
        # partially flag financial keywords like "banking" / "get_loan_status".
        async for chunk in llm.stream_completion(
            system_prompt="You output only valid compact JSON. No markdown. No explanation.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=1024,
        ):
            if chunk.content:
                result += chunk.content
        if not result:
            raise ValueError("Empty LLM response")
        policy = _extract_json_object(result)
        return policy
    except Exception as e:
        logger.error("Failed to suggest data access policy: %s", e)
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {e}")


# ─── Guardrail Sandbox ────────────────────────────────────────────────────────

async def _sandbox_llm_complete(llm, system_prompt: str, user_text: str, temperature: float, max_tokens: int) -> str:
    """Call LLM and aggregate full response text for sandbox testing."""
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
    if isinstance(llm, GeminiStreamingProvider):
        return await llm.complete(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_text}],
        )
    full = ""
    async for chunk in llm.stream_completion(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_text}],
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        if chunk.content:
            full += chunk.content
    return full


def _make_sandbox_llm(provider: str, model: str):
    """Instantiate the right LLM provider for sandbox test (mirrors /llm/test logic)."""
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
    if provider == "gemini":
        return GeminiStreamingProvider(model=model)
    if provider == "openrouter":
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
        return OpenRouterStreamingProvider(model=model)
    return GroqStreamingProvider(model=model or "llama-3.3-70b-versatile")


@router.post("/guardrails/sandbox-test", tags=["guardrails"])
async def sandbox_test(data: dict):
    """
    Live sandbox: apply guardrail rules and optionally call the real LLM.
    Uses the guardrail_policy sent from the UI (unsaved draft is fine).
    """
    from voicebot.core.guardrails import RuleEngine, GuardrailRule, RuleScope

    user_input: str = data.get("user_input", "")
    guardrail_policy: dict = data.get("guardrail_policy") or {}
    system_prompt: str = data.get("system_prompt", "You are a helpful AI assistant.")
    llm_model: str = data.get("llm_model", "llama-3.3-70b-versatile")
    llm_provider: str = data.get("llm_provider", "groq")
    temperature: float = float(data.get("temperature") or 0.7)
    max_tokens: int = min(int(data.get("max_tokens") or 512), 512)
    test_mode: str = data.get("test_mode", "guardrail_only")

    if not user_input.strip():
        raise HTTPException(status_code=422, detail="user_input is required")

    # 1. Build rule engine from the policy supplied by the UI
    rules_data = guardrail_policy.get("rules") or []
    try:
        rules = [GuardrailRule(**r) for r in rules_data if isinstance(r, dict)]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid rule definition: {e}")

    engine = RuleEngine(rules=rules, bot_id="sandbox")

    # 2. INPUT guardrail pass
    safe_input, input_block = await engine.apply_policies(user_input, RuleScope.INPUT)
    input_result = {
        "original": user_input,
        "sanitized": safe_input,
        "blocked": input_block is not None,
        "block_rule": input_block.get("rule_id") if input_block else None,
        "block_message": input_block.get("message") if input_block else None,
        "was_masked": safe_input != user_input and input_block is None,
    }

    if input_block or test_mode == "guardrail_only":
        return {"input_result": input_result, "llm_result": None, "output_result": None, "final_output": None}

    # 3. LLM call (full pipeline mode)
    try:
        llm = _make_sandbox_llm(llm_provider, llm_model)
        llm_text = await _sandbox_llm_complete(llm, system_prompt, safe_input, temperature, max_tokens)
    except Exception as e:
        logger.error("Sandbox LLM call failed: %s", e)
        return {
            "input_result": input_result,
            "llm_result": {"error": str(e)},
            "output_result": None,
            "final_output": None,
        }

    # 4. OUTPUT guardrail pass
    safe_output, output_block = await engine.apply_policies(llm_text, RuleScope.OUTPUT)
    output_result = {
        "original": llm_text,
        "sanitized": safe_output,
        "blocked": output_block is not None,
        "block_rule": output_block.get("rule_id") if output_block else None,
        "block_message": output_block.get("message") if output_block else None,
        "was_masked": safe_output != llm_text and output_block is None,
    }

    return {
        "input_result": input_result,
        "llm_result": llm_text,
        "output_result": output_result,
        "final_output": safe_output if not output_block else output_result["block_message"],
    }


# ─── 🛡️ Dynamic (No-Code) Tools ──────────────────────────────────────────────

@router.get("/tools/custom", tags=["tools"])
async def list_custom_tools():
    """List all dynamic tools created via UI."""
    db = await get_db()
    tools = await db.list_custom_tools()
    return {"tools": tools, "count": len(tools)}


@router.post("/tools/custom", tags=["tools"])
async def create_custom_tool(data: dict):
    """Create or update a dynamic tool."""
    import uuid
    tool_id = data.get("id") or str(uuid.uuid4())
    db = await get_db()
    
    await db.save_custom_tool(
        tool_id=tool_id,
        name=data["name"],
        description=data["description"],
        params=data.get("parameters", {}),
        config=data.get("config", {}),
        tool_type=data.get("type", "webhook")
    )
    return {"status": "success", "id": tool_id}


# ─── 📚 Knowledge Ingestion (Unified RAG) ────────────────────────────────────

@router.post("/knowledge/ingest/url", tags=["knowledge"])
async def ingest_url(data: dict, background_tasks: BackgroundTasks):
    """Trigger ingestion of a website URL into Vector Memory."""
    url = data.get("url")
    bot_id = data.get("bot_id")
    if not url:
        raise HTTPException(status_code=422, detail="url is required")
        
    db = await get_db()
    # 1. Register job
    job_id = str(uuid.uuid4())
    await db.save_ingestion_job(job_id, "url", url, bot_id)
    
    # 2. Start background processing
    from voicebot.services.memory.ingestor import KnowledgeIngestor
    from voicebot.services.memory.vector_provider import VectorMemoryProvider
    
    async def _process():
        vm = VectorMemoryProvider()
        await vm.connect()
        ingestor = KnowledgeIngestor(db=db, vector_memory=vm)
        result = await ingestor.ingest_url(url, bot_id)
        
        status = "completed" if "error" not in result else "failed"
        await db.update_ingestion_status(
            job_id, status, 
            chunk_count=result.get("chunks", 0), 
            error=result.get("error")
        )

    background_tasks.add_task(_process)
    return {"status": "accepted", "job_id": job_id}


@router.post("/knowledge/ingest/upload", tags=["knowledge"])
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    bot_id: Optional[str] = None
):
    """Upload a PDF file and trigger Vector Memory ingestion."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    # Save file locally
    upload_dir = "data/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{uuid.uuid4()}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        import shutil
        shutil.copyfileobj(file.file, buffer)
        
    db = await get_db()
    job_id = str(uuid.uuid4())
    await db.save_ingestion_job(job_id, "pdf", file.filename, bot_id)
    
    # Background process
    from voicebot.services.memory.ingestor import KnowledgeIngestor
    from voicebot.services.memory.vector_provider import VectorMemoryProvider
    
    async def _process_pdf():
        vm = VectorMemoryProvider()
        await vm.connect()
        ingestor = KnowledgeIngestor(db=db, vector_memory=vm)
        result = await ingestor.ingest_pdf(file_path, bot_id or "global")
        
        status = "completed" if "error" not in result else "failed"
        await db.update_ingestion_status(
            job_id, status,
            chunk_count=result.get("chunks", 0),
            error=result.get("error")
        )
        # Cleanup file after ingestion? Maybe keep it as reference?
        # For now we keep it.

    background_tasks.add_task(_process_pdf)
    return {"status": "accepted", "job_id": job_id, "filename": file.filename}


# ─── Test Utilities ───────────────────────────────────────────────────────────

@router.post("/tts/test", tags=["test"])
async def test_tts(data: dict):
    """Test TTS with a simple text. Returns binary audio stream."""
    from fastapi.responses import StreamingResponse
    from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
    from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider

    provider_type = data.get("provider", "deepgram")
    text = data.get("text", "Hello, I am the voice bot.")
    
    provider = DeepgramTTSProvider() if provider_type == "deepgram" else ElevenLabsStreamingProvider()

    async def generate():
        async for chunk in provider.stream_speech(text):
            yield chunk

    return StreamingResponse(generate(), media_type="audio/wav")


@router.post("/llm/test", tags=["test"])
async def test_llm(data: dict):
    """Test LLM with a simple prompt."""
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider

    provider_type = data.get("provider", "groq")
    prompt = data.get("prompt", "Hello.")
    model_name = data.get("model")
    
    provider = GeminiStreamingProvider(model=model_name) if provider_type == "gemini" else GroqStreamingProvider(model=model_name)

    full_response = ""
    async for chunk in provider.stream_completion(
        system_prompt="You are a concise, helpful voice assistant. Answer in 1-2 sentences.",
        messages=[{"role": "user", "content": prompt}]
    ):
        if chunk.content:
            full_response += chunk.content

    return {"response": full_response, "provider": provider_type}


# ─── Analytics Endpoints ───────────────────────────────────────────────────────
@router.get("/analytics/dashboard", tags=["analytics"])
async def get_dashboard_analytics(request: Request):
    """Get aggregated metrics for the dashboard overview."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    stats = await db.get_dashboard_analytics(
        owner_user_id=None if actor_role == "admin" else actor_user_id
    )
    return stats


@router.get("/analytics/latency", tags=["analytics"])
async def get_latency_analytics(request: Request, limit: int = 30):
    """Return per-session average latency metrics (STT/LLM/TTS/total) for the last N sessions."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    records = await db.get_latency_analytics(
        limit=limit,
        owner_user_id=None if actor_role == "admin" else actor_user_id,
    )
    return {"records": records, "count": len(records)}


@router.get("/analytics/intents", tags=["analytics"])
async def get_intent_analytics(request: Request, limit: int = 100):
    """Return intent distribution grouped by intent label from recent sessions."""
    db = await get_db()
    actor_user_id, actor_role = _actor(request)
    intents = await db.get_intent_analytics(
        limit=limit,
        owner_user_id=None if actor_role == "admin" else actor_user_id,
    )
    return {"intents": intents, "count": len(intents)}


@router.get("/analytics/training-data", tags=["analytics"])
async def get_training_data(
    type: Optional[str] = None,
    feedback: Optional[str] = None,
    format: str = "json",
    limit: int = 1000,
):
    """
    Export commitment training examples for fine-tuning.

    - **type**: filter by task_type (`extract_commitment` | `check_contradiction`)
    - **feedback**: filter by label (`correct` | `false_positive` | `missed` | null for all)
    - **format**: `json` (default) or `jsonl` (OpenAI/Groq fine-tune format)
    - **limit**: max rows (default 1000)
    """
    db = await get_db()
    if not hasattr(db, "get_commitment_training_export"):
        return {"examples": [], "count": 0}
    examples = await db.get_commitment_training_export(
        task_type=type, feedback=feedback, limit=limit
    )
    if format == "jsonl":
        import json as _json
        from fastapi.responses import PlainTextResponse
        lines = []
        for ex in examples:
            sys_msg = (
                "You are a strict commitment extractor. Reply with ONE sentence or NONE."
                if ex["task_type"] == "extract_commitment"
                else "You are a strict contradiction detector. Reply CONTRADICTION:... or NONE."
            )
            obj = {
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": ex["input_text"]},
                    {"role": "assistant", "content": ex["prediction"]},
                ]
            }
            lines.append(_json.dumps(obj, ensure_ascii=False))
        return PlainTextResponse("\n".join(lines), media_type="application/jsonl")
    return {"examples": examples, "count": len(examples)}


_vector_db: Optional[VectorMemoryProvider] = None

async def get_vector_db() -> VectorMemoryProvider:
    global _vector_db
    if _vector_db is None:
        from voicebot.services.memory.vector_provider import VectorMemoryProvider
        _vector_db = VectorMemoryProvider()
        await _vector_db.connect()
    elif not _vector_db._available:
        # Re-attempt connection if it was previously unavailable (e.g. chromadb just installed)
        await _vector_db.connect()
    return _vector_db

@router.get("/bots/{bot_id}/memory")
async def get_bot_memory(bot_id: str):
    """Retrieve all learned knowledge and memory for a specific bot."""
    provider = await get_vector_db()
    facts = await provider.list_bot_knowledge(bot_id)
    return {"bot_id": bot_id, "facts": facts, "count": len(facts)}

@router.delete("/memory/{fact_id}")
async def delete_memory_fact(fact_id: str):
    """Delete a specific learned fact from vector memory."""
    provider = await get_vector_db()
    success = await provider.delete_fact(fact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Fact not found or delete failed")
    return {"status": "deleted", "id": fact_id}

@router.get("/memory/all", tags=["data"])
async def list_all_vector_memory(limit: int = 100):
    """Retrieve all raw documents stored in the main ChromaDB collection."""
    provider = await get_vector_db()
    items = await provider.list_all_memory(limit=limit)
    return {"items": items, "count": len(items)}

@router.get("/memory/qa", tags=["data"])
async def list_qa_cache_memory(limit: int = 100):
    """Retrieve all semantically cached Q&A pairs from ChromaDB."""
    provider = await get_vector_db()
    items = await provider.list_qa_cache(limit=limit)
    return {"items": items, "count": len(items)}

@router.get("/health/vector", tags=["health"])
async def vector_health():
    """Check ChromaDB vector memory status and document count."""
    try:
        provider = await get_vector_db()
        if not provider._available:
            return {"status": "offline", "doc_count": 0, "reason": "chromadb not installed"}
        doc_count = 0
        if provider._collection is not None:
            doc_count = provider._collection.count()
        return {"status": "online", "doc_count": doc_count}
    except Exception as e:
        return {"status": "offline", "doc_count": 0, "reason": str(e)}


@router.get("/health")
async def health_check():
    """Health check for the gateway module."""
    return {"status": "ok", "module": "gateway"}

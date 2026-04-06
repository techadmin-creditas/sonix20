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
from typing import Optional

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, BackgroundTasks, Request
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

settings = get_settings()
logger = setup_logger("gateway-routes", level=settings.log_level)

router = APIRouter()

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

    await db.create_session(
        session_id,
        bot_id=bot_id,
        user_id=owner_user_id,
        language=session_language,
    )
    logger.info("Created session %s for user %s (bot=%s) transport=%s", session_id[:8], owner_user_id, bot_id, transport)

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
                agent = LiveKitVoiceAgent(lk["room_name"], bot_id=bot_id)
                background_tasks.add_task(agent.start)
                logger.info("Triggered LiveKit Agent for room %s", lk["room_name"])
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

    if current_node_id:
        workflow_data["start_node_id"] = current_node_id

    session = SessionState(session_id="test_simulator")
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
    yield_to_llm = await workflow_engine.evaluate(user_input)

    return {
        "status": "success",
        "speak_responses": speak_responses,
        "yield_to_llm": yield_to_llm,
        "next_node_id": workflow_engine.current_node_id,
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
@router.get("/metadata/models", tags=["metadata"])
async def get_supported_models():
    """List supported LLM models across providers. Keys checked via settings (loaded from .env)."""
    models = [
        {
            "id": "llama-3.3-70b-versatile",
            "name": "Llama 3.3 70B (Groq)",
            "provider": "groq",
            "context_window": 128000,
            "max_tpm": 6000, # Approx for Groq free tier or common tier
            "cost_per_1k": 0.0006
        },
        {
            "id": "llama-3.1-8b-instant",
            "name": "Llama 3.1 8B (Groq)",
            "provider": "groq",
            "context_window": 128000,
            "max_tpm": 30000,
            "cost_per_1k": 0.00005
        },
        {
            "id": "gemini-1.5-flash",
            "name": "Gemini 1.5 Flash",
            "provider": "gemini",
            "context_window": 1000000,
            "max_tpm": 1000000,
            "cost_per_1k": 0.000075
        },
        {
            "id": "gemini-1.5-pro",
            "name": "Gemini 1.5 Pro",
            "provider": "gemini",
            "context_window": 2000000,
            "max_tpm": 1000000,
            "cost_per_1k": 0.0035
        },
        {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "provider": "openai",
            "context_window": 128000,
            "max_tpm": 200000,
            "cost_per_1k": 0.005
        },
    ]
    if settings.openrouter_api_key:
        models += [
            {
                "id": "google/gemini-flash-1.5-8b",
                "name": "Gemini Flash 1.5 (OpenRouter Free)",
                "provider": "openrouter",
                "context_window": 1000000,
                "max_tpm": 20000,
                "cost_per_1k": 0.0
            },
            {
                "id": "anthropic/claude-3-haiku",
                "name": "Claude Haiku (OpenRouter Fast)",
                "provider": "openrouter",
                "context_window": 200000,
                "max_tpm": 20000,
                "cost_per_1k": 0.0
            },
            {
                "id": "meta-llama/llama-3.3-70b-instruct:free",
                "name": "Llama 70B (OpenRouter Free)",
                "provider": "openrouter",
                "context_window": 131000,
                "max_tpm": 15000,
                "cost_per_1k": 0.0
            },
            {
                "id": "meta-llama/llama-3.1-8b-instruct",
                "name": "Llama 8B (OpenRouter Free)",
                "provider": "openrouter",
                "context_window": 131000,
                "max_tpm": 15000,
                "cost_per_1k": 0.0
            },
            {
                "id": "anthropic/claude-3.5-sonnet",
                "name": "Claude 3.5 Sonnet (OpenRouter)",
                "provider": "openrouter",
                "context_window": 200000,
                "max_tpm": 80000,
                "cost_per_1k": 0.003
            },
            {
                "id": "openai/gpt-4o-mini",
                "name": "GPT-4o mini (OpenRouter)",
                "provider": "openrouter",
                "context_window": 128000,
                "max_tpm": 200000,
                "cost_per_1k": 0.005
            },
        ]
    if settings.anthropic_api_key:
        models += [
            {
                "id": "claude-haiku-3-5",
                "name": "Claude Haiku 3.5 (Anthropic)",
                "provider": "anthropic",
                "context_window": 200000,
                "max_tpm": 100000,
                "cost_per_1k": 0.00025
            },
            {
                "id": "claude-sonnet-3-5",
                "name": "Claude Sonnet 3.5 (Anthropic)",
                "provider": "anthropic",
                "context_window": 200000,
                "max_tpm": 80000,
                "cost_per_1k": 0.003
            },
        ]
    return {"models": models}

@router.get("/metadata/voices", tags=["metadata"])
async def get_supported_voices():
    """List supported TTS voices across providers."""
    return {
        "voices": [
            {"id": "aura-asteria-en", "name": "Asteria (Hindi Accent / Deepgram)", "provider": "deepgram"},
            {"id": "aura-luna-en", "name": "Luna (Deepgram)", "provider": "deepgram"},
            {"id": "aura-stella-en", "name": "Stella (Hinglish / Deepgram)", "provider": "deepgram"},
            {"id": "aura-athena-en", "name": "Athena (Hinglish / Deepgram)", "provider": "deepgram"},
            {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel (Hindi Multilingual / ElevenLabs)", "provider": "elevenlabs"},
            {"id": "ThT5KcBe7VKqW6E5kyPh", "name": "Dorothy (Hindi Multilingual / ElevenLabs)", "provider": "elevenlabs"},
            {"id": "AZnzlk1XhkUvSST7V3S6", "name": "Nicole (Hindi Natural / ElevenLabs)", "provider": "elevenlabs"},
            {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah (Hindi Natural / ElevenLabs)", "provider": "elevenlabs"},
        ]
    }

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

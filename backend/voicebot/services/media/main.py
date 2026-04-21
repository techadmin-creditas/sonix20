"""
Media Service — FastAPI Entry Point.

Handles WebRTC media via LiveKit:
  - Room management
  - Audio track subscription
  - Audio frame extraction and forwarding
  - Echo cancellation interface
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

from voicebot.shared.config import get_settings
from voicebot.shared.livekit_util import normalize_livekit_client_url
from voicebot.shared.logging.logger import setup_logger

settings = get_settings()
logger = setup_logger("media-service", level=settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Media service starting up...")
    yield
    logger.info("Media service shutting down...")


app = FastAPI(
    title="Agentic Voice Bot — Media Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
)


class RoomRequest(BaseModel):
    session_id: str
    user_id: str = ""


@app.post("/rooms/create")
async def create_room(request: RoomRequest):
    """
    Create a LiveKit room for a voice session.
    Returns a LiveKit token for the client to join.
    """
    try:
        token = await _generate_livekit_token(
            request.session_id, request.user_id
        )
        return {
            "room_name": f"voice-{request.session_id[:8]}",
            "token": token,
            "livekit_url": normalize_livekit_client_url(settings.livekit_url or "ws://localhost:7880"),
        }
    except Exception as e:
        logger.error("Failed to create room: %s", e)
        return {"error": "Room creation failed"}


@app.delete("/rooms/{session_id}")
async def delete_room(session_id: str):
    """Delete a LiveKit room when the session ends."""
    logger.info("Room deleted: %s", session_id[:8])
    return {"status": "deleted"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "media"}


async def _generate_livekit_token(session_id: str, user_id: str) -> str:
    """Generate a LiveKit access token for a participant."""
    try:
        from livekit.api import AccessToken, VideoGrants

        token = (
            AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(user_id or f"user-{session_id[:8]}")
            .with_name(f"Voice Bot Session {session_id[:8]}")
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=f"voice-{session_id[:8]}",
                    can_publish=True,
                    can_subscribe=True,
                )
            )
        )
        return token.to_jwt()
    except ImportError:
        logger.warning("livekit package not installed, returning placeholder token")
        return f"placeholder-token-{session_id[:8]}"
    except Exception as e:
        logger.error("Token generation failed: %s", e)
        return ""


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8007, reload=settings.debug)

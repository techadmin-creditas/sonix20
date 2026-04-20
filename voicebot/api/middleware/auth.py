"""
JWT Authentication Middleware for the Gateway Service.

Validates Bearer tokens on REST endpoints.
WebSocket connections use a token query parameter instead.
Skips auth for health checks and docs endpoints.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse

from voicebot.shared.config import get_settings
from voicebot.services.auth.auth_service import decode_access_token

logger = logging.getLogger("gateway-auth")
settings = get_settings()

# Paths that skip authentication
SKIP_AUTH_PATHS = {
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates JWT tokens on incoming requests.
    In development mode, auth is permissive (logs but doesn't block).
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ):
        # Always allow CORS preflight through.
        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        # Skip auth for WebSocket upgrades (handled separately)
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        # Extract the Bearer token if present
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        # Validate the JWT if provided
        if token:
            payload = _verify_jwt(token)
            if payload:
                # Attach user info to request state
                request.state.user_id = payload.get("sub", "")
                request.state.roles = payload.get("roles", [])
                request.state.permissions = payload.get("permissions", [])
            else:
                # If a token was provided but is invalid, we strictly reject.
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"},
                )

        # Enforce auth if NO valid token was found AND the path is not public.
        path = request.url.path
        is_public = path in SKIP_AUTH_PATHS or \
                    (path.endswith("/") and path[:-1] in SKIP_AUTH_PATHS) or \
                    (not path.endswith("/") and path + "/" in SKIP_AUTH_PATHS)
        
        # Unsafe bypass option for local debugging.
        debug_bypass = os.getenv("ALLOW_UNSAFE_DEBUG_AUTH_BYPASS", "").lower() in ("1", "true", "yes")

        if not getattr(request.state, "user_id", None) and not is_public and not debug_bypass:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        return await call_next(request)


def _verify_jwt(token: str) -> Optional[dict]:
    """
    Verify a JWT token and return the decoded payload.
    Returns None if verification fails.
    """
    payload = decode_access_token(token)
    if payload is None:
        logger.warning("JWT verification failed")
    return payload

"""
JWT Authentication Middleware for the Gateway Service.

Validates Bearer tokens on REST endpoints.
WebSocket connections use a token query parameter instead.
Skips auth for health checks and docs endpoints.
"""

from __future__ import annotations

import logging
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse

from voicebot.shared.config import get_settings

logger = logging.getLogger("gateway-auth")
settings = get_settings()

# Paths that skip authentication
SKIP_AUTH_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates JWT tokens on incoming requests.
    In development mode, auth is permissive (logs but doesn't block).
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ):
        # Skip auth for health/docs endpoints
        if request.url.path in SKIP_AUTH_PATHS:
            return await call_next(request)

        # Skip auth for WebSocket upgrades (handled separately)
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        # In development mode, allow all requests
        if settings.debug:
            return await call_next(request)

        # Extract the Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        token = auth_header[7:]  # Strip "Bearer "

        # Validate the JWT
        payload = _verify_jwt(token)
        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )

        # Attach user info to request state for downstream use
        request.state.user_id = payload.get("sub", "")
        request.state.roles = payload.get("roles", [])

        return await call_next(request)


def _verify_jwt(token: str) -> Optional[dict]:
    """
    Verify a JWT token and return the decoded payload.
    Returns None if verification fails.
    """
    try:
        import jwt

        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except Exception as e:
        logger.warning("JWT verification failed: %s", e)
        return None

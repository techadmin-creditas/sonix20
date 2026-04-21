"""
Rate Limiting Middleware — Token Bucket Algorithm.

Uses an in-memory store for MVP. In production, use Redis
for distributed rate limiting across gateway replicas.
"""

from __future__ import annotations

import time
import logging
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse

from voicebot.shared.config import get_settings

logger = logging.getLogger("gateway-ratelimit")
settings = get_settings()

# Skip rate limiting for these paths
SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple token-bucket rate limiter.
    Limits requests per client IP within a sliding window.
    """

    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        # {ip: {"tokens": int, "last_refill": float}}
        self._buckets: dict[str, dict] = defaultdict(
            lambda: {"tokens": 100, "last_refill": time.time()}
        )
        self._max_tokens = 100  # Max requests per window
        self._refill_rate = 100 / 60  # Tokens per second (100 per minute)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ):
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        # Skip rate limiting for WebSocket upgrades
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        # In development, use lenient limiting
        if settings.debug:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        bucket = self._buckets[client_ip]

        # Refill tokens based on elapsed time
        now = time.time()
        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(
            self._max_tokens,
            bucket["tokens"] + elapsed * self._refill_rate,
        )
        bucket["last_refill"] = now

        # Check if the client has enough tokens
        if bucket["tokens"] < 1:
            logger.warning("Rate limit exceeded for IP %s", client_ip)
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
                headers={"Retry-After": "60"},
            )

        # Consume a token
        bucket["tokens"] -= 1

        return await call_next(request)

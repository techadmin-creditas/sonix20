"""
Redis Session Provider — Short-term memory for active conversations.

Stores serialized SessionState objects in Redis with TTL-based expiration.
Provides atomic get/set operations for concurrent session access.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from voicebot.shared.config import get_settings

logger = logging.getLogger("memory-redis")
settings = get_settings()


class RedisSessionProvider:
    """
    Redis-backed session storage for voice conversations.

    Key format: "session:{session_id}"
    Value: JSON-serialized SessionState
    TTL: Configurable (default 1 hour)
    """

    def __init__(self, redis_url: str, default_ttl: int = 3600):
        self._redis_url = redis_url
        self._default_ttl = default_ttl
        self._redis = None

    async def connect(self) -> None:
        """Connect to Redis."""
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
            )
            await self._redis.ping()
            logger.info("Redis session provider connected")
        except Exception as e:
            logger.warning("Redis unavailable: %s", e)
            self._redis = None

    async def save_session(
        self,
        session_id: str,
        data: dict[str, Any],
        ttl: Optional[int] = None,
    ) -> None:
        """Save session state to Redis."""
        if not self._redis:
            logger.warning("Redis unavailable — session not saved")
            return

        key = f"session:{session_id}"
        try:
            await self._redis.setex(
                key,
                ttl or self._default_ttl,
                json.dumps(data, default=str),
            )
            logger.debug("Session saved: %s", session_id[:8])
        except Exception as e:
            logger.error("Failed to save session: %s", e)

    async def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        """Retrieve session state from Redis."""
        if not self._redis:
            return None

        key = f"session:{session_id}"
        try:
            data = await self._redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error("Failed to get session: %s", e)
            return None

    async def delete_session(self, session_id: str) -> None:
        """Delete a session from Redis."""
        if not self._redis:
            return

        key = f"session:{session_id}"
        try:
            await self._redis.delete(key)
            logger.debug("Session deleted: %s", session_id[:8])
        except Exception as e:
            logger.error("Failed to delete session: %s", e)

    # --- Prompt Caching ---
    async def get_cache(self, prompt_hash: str) -> Optional[str]:
        """Retrieve a cached LLM response for a given prompt hash."""
        if not self._redis:
            return None
        key = f"cache:{prompt_hash}"
        try:
            return await self._redis.get(key)
        except Exception:
            return None

    async def set_cache(self, prompt_hash: str, response: str, ttl: int = 3600) -> None:
        """Cache an LLM response for a fixed TTL."""
        if not self._redis:
            return
        key = f"cache:{prompt_hash}"
        try:
            await self._redis.setex(key, ttl, response)
        except Exception:
            pass

    # --- Transcript History ---
    async def add_history(self, session_id: str, message: dict, limit: int = 20) -> None:
        """Append a message to a session's history list in Redis."""
        if not self._redis:
            return
        key = f"history:{session_id}"
        try:
            # We use a Redis List for ordering
            await self._redis.rpush(key, json.dumps(message))
            await self._redis.ltrim(key, -limit, -1) # Keep last N messages
            await self._redis.expire(key, self._default_ttl)
        except Exception as e:
            logger.error("Failed to append history: %s", e)

    async def get_history(self, session_id: str) -> list[dict]:
        """Retrieve current session history from Redis."""
        if not self._redis:
            return []
        key = f"history:{session_id}"
        try:
            items = await self._redis.lrange(key, 0, -1)
            return [json.loads(i) for i in items]
        except Exception:
            return []

    async def extend_ttl(self, session_id: str, ttl: Optional[int] = None) -> None:
        """Extend the TTL of a session (keep-alive)."""
        if not self._redis:
            return

        key = f"session:{session_id}"
        try:
            await self._redis.expire(key, ttl or self._default_ttl)
        except Exception:
            pass

    async def ping(self) -> bool:
        """Check if Redis is alive and responding."""
        if not self._redis:
            return False
        try:
            await self._redis.ping()
            return True
        except Exception:
            return False

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            logger.info("Redis session provider disconnected")

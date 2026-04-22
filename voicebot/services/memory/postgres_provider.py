"""
PostgreSQL Memory Provider (using asyncpg).
Provides persistent storage for Neon/Vercel Postgres to replace SQLite in production.
"""

import asyncio
import json
import logging
import asyncpg
from typing import Any, Dict, List, Optional
from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("memory-postgres", level="INFO")
settings = get_settings()

class PostgresProvider:
    """
    Async Postgres provider for platform data.
    """

    def __init__(self, dsn: Optional[str] = None):
        self._dsn = dsn or settings.postgres_url
        self._pool: Optional[asyncpg.Pool] = None

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            if not self._dsn:
                raise ValueError("POSTGRES_URL is not configured.")
            logger.info("Initializing Postgres pool...")
            self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=10)
        return self._pool

    async def initialize(self) -> None:
        """Create all tables if they don't exist in Postgres."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            # Users Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            TEXT PRIMARY KEY,
                    username      TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'user',
                    permissions   TEXT DEFAULT '[]',
                    is_active     INTEGER NOT NULL DEFAULT 1,
                    created_at    DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
                    updated_at    DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))
                )
            """)

            # Bots Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bots (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    description TEXT,
                    persona     TEXT NOT NULL DEFAULT 'helpful assistant',
                    system_prompt TEXT NOT NULL,
                    greeting    TEXT,
                    tools_enabled TEXT NOT NULL DEFAULT '[]',
                    voice_id    TEXT,
                    llm_model   TEXT DEFAULT 'llama-3.3-70b-versatile',
                    role        TEXT DEFAULT 'AI Assistant',
                    icon        TEXT DEFAULT 'bot',
                    color       TEXT DEFAULT 'primary',
                    temperature REAL DEFAULT 0.7,
                    max_tokens  INTEGER DEFAULT 2048,
                    is_active   INTEGER NOT NULL DEFAULT 1,
                    created_at  DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
                    updated_at  DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
                    default_language TEXT DEFAULT 'en',
                    owner_user_id TEXT REFERENCES users(id)
                )
            """)

            # Sessions Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id          TEXT PRIMARY KEY,
                    bot_id      TEXT REFERENCES bots(id),
                    user_id     TEXT,
                    language    TEXT DEFAULT 'hi',
                    started_at  DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
                    ended_at    DOUBLE PRECISION,
                    turn_count  INTEGER DEFAULT 0,
                    metadata    TEXT DEFAULT '{}'
                )
            """)

            # Logs Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_logs (
                    id          SERIAL PRIMARY KEY,
                    session_id  TEXT NOT NULL REFERENCES sessions(id),
                    role        TEXT NOT NULL,
                    content     TEXT NOT NULL,
                    timestamp   DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
                    metadata    TEXT DEFAULT '{}'
                )
            """)

            # Admin Seed
            admin_check = await conn.fetchval("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            if admin_check == 0:
                await conn.execute("""
                    INSERT INTO users (id, username, password_hash, role, permissions)
                    VALUES ($1, $2, $3, $4, $5)
                """, 'admin-user', 'admin', 'scrypt:32768:8:1$CqH2vE9r... (admin123 hash)', 'admin', '["*"]')

        logger.info("Postgres initialized successfully.")

    async def list_bots(self, active_only: bool = True) -> List[Dict[str, Any]]:
        pool = await self._get_pool()
        query = "SELECT * FROM bots"
        if active_only:
            query += " WHERE is_active = 1"
        rows = await pool.fetch(query)
        return [dict(r) for r in rows]

    async def get_bot(self, bot_id: str) -> Optional[Dict[str, Any]]:
        pool = await self._get_pool()
        row = await pool.fetchrow("SELECT * FROM bots WHERE id = $1", bot_id)
        return dict(row) if row else None

    async def create_session(self, session_id: str, bot_id: str, user_id: str = None, language: str = 'hi') -> None:
        pool = await self._get_pool()
        await pool.execute("""
            INSERT INTO sessions (id, bot_id, user_id, language)
            VALUES ($1, $2, $3, $4)
        """, session_id, bot_id, user_id, language)

    async def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        pool = await self._get_pool()
        rows = await pool.fetch("SELECT * FROM sessions ORDER BY started_at DESC LIMIT $1", limit)
        return [dict(r) for r in rows]

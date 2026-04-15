"""
SQLite Long-Term Memory Provider.

Provides persistent storage for:
- Bot configurations (registry of all bot personas)
- Session history (all past sessions with analytics)
- Conversation logs (every turn, timestamped)
- Appointments (bookings made via voice)
- User facts (things users have told the bot)
- Knowledge base (searchable FAQs and domain info)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Optional
from concurrent.futures import ThreadPoolExecutor

from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.agent_task_spec import parse_agent_task_spec
from voicebot.shared.policy import parse_json_dict
from voicebot.shared.config import get_settings

logger = setup_logger("memory-sqlite", level="INFO")
settings = get_settings()

# Default DB path — can be overridden by env var
DEFAULT_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "voicebot.db"


class SQLiteProvider:
    """
    Async-compatible SQLite provider using thread pool for blocking I/O.
    Provides full CRUD for all platform data.
    """

    def __init__(self, db_path: Optional[str] = None):
        self._db_path = Path(db_path or DEFAULT_DB_PATH)
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="sqlite")
        self._lock = asyncio.Lock()
        self._conn: Optional[sqlite3.Connection] = None

    def _get_conn(self) -> sqlite3.Connection:
        """Get a thread-local SQLite connection."""
        if self._conn is None:
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")  # Write-ahead logging for concurrency
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    async def _run(self, fn, *args, **kwargs):
        """Execute a blocking function in the thread pool, shielded by an async lock."""
        async with self._lock:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(self._executor, lambda: fn(*args, **kwargs))

    # ─── 🛡️ Custom (No-Code) Tools ──────────────────────────────────────────

    async def save_custom_tool(self, tool_id: str, name: str, description: str, 
                               params: dict, config: dict, tool_type: str = "webhook"):
        """Save or update a dynamic UI-defined tool."""
        sql = """
            INSERT INTO custom_tools (id, name, description, parameters, config, type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                parameters=excluded.parameters,
                config=excluded.config,
                type=excluded.type,
                updated_at=excluded.updated_at
        """
        async with self._lock:
            self._conn.execute(sql, (
                tool_id, name, description, 
                json.dumps(params), json.dumps(config), tool_type
            ))
            self._conn.commit()

    async def list_custom_tools(self) -> List[Dict[str, Any]]:
        """List all dynamic tools available in the system."""
        sql = "SELECT * FROM custom_tools ORDER BY name ASC"
        async with self._lock:
            cursor = self._conn.execute(sql)
            rows = cursor.fetchall()
            
        tools = []
        for r in rows:
            tools.append({
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "type": r[3],
                "parameters": json.loads(r[4] or "{}"),
                "config": json.loads(r[5] or "{}"),
                "created_at": r[6]
            })
        return tools

    # ─── 📚 Knowledge Ingestion Tracking ────────────────────────────────────

    async def save_ingestion_job(self, job_id: str, source_type: str, source_path: str, bot_id: str = None):
        """Register a new knowledge ingestion job."""
        sql = """
            INSERT INTO knowledge_ingestion (id, source_type, source_path, bot_id)
            VALUES (?, ?, ?, ?)
        """
        async with self._lock:
            self._conn.execute(sql, (job_id, source_type, source_path, bot_id))
            self._conn.commit()

    async def update_ingestion_status(self, job_id: str, status: str, chunk_count: int = 0, error: str = None):
        """Update the status of an ingestion job."""
        sql = "UPDATE knowledge_ingestion SET status=?, chunk_count=?, error=? WHERE id=?"
        async with self._lock:
            self._conn.execute(sql, (status, chunk_count, error, job_id))
            self._conn.commit()

    # ─── Schema Initialization ────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Create all tables if they don't exist."""
        await self._run(self._create_tables)
        logger.info("SQLite DB initialized at %s", self._db_path)

    def _create_tables(self) -> None:
        conn = self._get_conn()
        # Identity table for dashboard users (admin + standard users)
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
                is_active     INTEGER NOT NULL DEFAULT 1,
                created_at    REAL NOT NULL DEFAULT (strftime('%s','now')),
                updated_at    REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            """
        )
        conn.commit()
        
        # 1. Create bots table
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS bots (
                id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))),
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
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now')),
                updated_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
        """)

        # 2. Add columns safely if they are missing (Migrations)
        for col_name, col_type in [
            ("llm_provider", "TEXT DEFAULT ''"),
            ("temperature", "REAL DEFAULT 0.7"),
            ("max_tokens", "INTEGER DEFAULT 2048"),
            ("workflow_id", "TEXT REFERENCES workflows(id)"),
            ("guardrail_policy", "TEXT DEFAULT '{}'"),
            ("data_access_policy", "TEXT DEFAULT '{}'"),
            ("conversation_policy", "TEXT DEFAULT '{}'"),
            ("pipeline_mode", "TEXT DEFAULT 'classic'"),
            ("agent_task_spec", "TEXT DEFAULT '{}'"),
            # Voice smoothness tuning fields (Phase 4)
            ("tts_provider", "TEXT DEFAULT 'deepgram_ws'"),      # deepgram_ws | deepgram_http | elevenlabs
            ("stt_endpointing_ms", "INTEGER DEFAULT 300"),        # Deepgram endpointing silence window
            ("stt_utterance_end_ms", "INTEGER DEFAULT 800"),      # Deepgram definitive utterance-end timeout
            ("first_segment_chars", "INTEGER DEFAULT 15"),        # First TTS flush char cap (fast-path)
            ("ultra_first_segment_chars", "INTEGER DEFAULT 8"),   # Ultra-early flush after ~2 words
            ("barge_in_grace_period_ms", "INTEGER DEFAULT 300"),  # Post-speech guard window before interrupt fires
            ("barge_in_debounce_ms", "INTEGER DEFAULT 100"),      # Confirmation window to avoid false barge-in
            ("topic_check_async", "INTEGER DEFAULT 1"),           # 1 = run topic check off critical path
            ("audio_frame_normalize", "INTEGER DEFAULT 1"),       # 1 = normalize to 20 ms frames
            ("default_language", "TEXT DEFAULT 'hi'"),
            ("proactive_prompts", "TEXT DEFAULT '[]'"),
            ("topic_restriction", "TEXT DEFAULT NULL"),
            ("refuse_off_topic", "INTEGER DEFAULT 0"),
            ("owner_user_id", "TEXT REFERENCES users(id)"),
            ("min_stt_confidence", "REAL DEFAULT 0.5"),
            ("is_landing_page_default", "INTEGER DEFAULT 0"),
            ("variable_mappings", "TEXT DEFAULT '{}'"),
            ("metadata_defaults", "TEXT DEFAULT '{}'"),
            ("tts_model", "TEXT DEFAULT ''"),
        ]:
            try:
                conn.execute(f"ALTER TABLE bots ADD COLUMN {col_name} {col_type}")
            except (sqlite3.OperationalError, sqlite3.DatabaseError) as e:
                # Check for "duplicate column name" in message or specifically skip if it exists
                if "duplicate column name" not in str(e).lower():
                    logger.error("Migration error adding %s: %s", col_name, e)
                    # We don't raise here to allow other columns to attempt creation
        
        conn.commit()

        # 3. Create other tables (workflows must exist before 2b ALTER on legacy DBs)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS workflows (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                description  TEXT,
                nodes_json   TEXT DEFAULT '[]',
                edges_json   TEXT DEFAULT '[]',
                owner_user_id TEXT REFERENCES users(id),
                is_active    INTEGER NOT NULL DEFAULT 1,
                created_at   REAL NOT NULL DEFAULT (strftime('%s','now')),
                updated_at   REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                bot_id      TEXT REFERENCES bots(id),
                user_id     TEXT,
                language    TEXT DEFAULT 'hi',
                started_at  REAL NOT NULL DEFAULT (strftime('%s','now')),
                ended_at    REAL,
                turn_count  INTEGER DEFAULT 0,
                metadata    TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS conversation_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL REFERENCES sessions(id),
                role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
                content     TEXT NOT NULL,
                timestamp   REAL NOT NULL DEFAULT (strftime('%s','now')),
                metadata    TEXT DEFAULT '{}'
            );

            -- 🛡️ UI-Defined (No-Code) Tools
            CREATE TABLE IF NOT EXISTS custom_tools (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL UNIQUE,
                description  TEXT NOT NULL,
                type         TEXT NOT NULL DEFAULT 'webhook',
                parameters   TEXT NOT NULL DEFAULT '{}',
                config       TEXT NOT NULL DEFAULT '{}',
                created_at   REAL NOT NULL DEFAULT (strftime('%s','now')),
                updated_at   REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            -- 📚 Knowledge Base Ingestion Registry 
            CREATE TABLE IF NOT EXISTS knowledge_ingestion (
                id           TEXT PRIMARY KEY,
                source_type  TEXT NOT NULL, -- 'pdf', 'url', 'api'
                source_path  TEXT NOT NULL,
                bot_id       TEXT REFERENCES bots(id),
                status       TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
                error        TEXT,
                chunk_count  INTEGER DEFAULT 0,
                created_at   REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT REFERENCES sessions(id),
                user_name   TEXT NOT NULL,
                date        TEXT NOT NULL,
                time        TEXT NOT NULL,
                reason      TEXT,
                status      TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'completed')),
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS user_facts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT REFERENCES sessions(id),
                user_id     TEXT,
                fact        TEXT NOT NULL,
                category    TEXT,
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS knowledge_base (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id      TEXT REFERENCES bots(id),
                owner_user_id TEXT REFERENCES users(id),
                topic       TEXT,
                question    TEXT NOT NULL,
                answer      TEXT NOT NULL,
                keywords    TEXT DEFAULT '[]',
                priority    INTEGER DEFAULT 0,
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS tool_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT REFERENCES sessions(id),
                tool_name   TEXT NOT NULL,
                arguments   TEXT NOT NULL DEFAULT '{}',
                result      TEXT,
                is_error    INTEGER DEFAULT 0,
                executed_at REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS session_feedback (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL REFERENCES sessions(id),
                outcome     TEXT NOT NULL DEFAULT 'resolved',
                csat_score  INTEGER NOT NULL DEFAULT 5,
                notes       TEXT,
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS commitment_training_examples (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_type   TEXT NOT NULL,
                input_text  TEXT NOT NULL,
                prediction  TEXT NOT NULL,
                feedback    TEXT DEFAULT NULL,
                session_id  TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_bot_id ON sessions(bot_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_logs_session_id ON conversation_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_kb_bot_id ON knowledge_base(bot_id);
            CREATE INDEX IF NOT EXISTS idx_tool_logs_session ON tool_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_user_facts_user_id ON user_facts(user_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_session ON session_feedback(session_id);
            CREATE INDEX IF NOT EXISTS idx_commitment_examples ON commitment_training_examples(task_type, feedback);

            CREATE TABLE IF NOT EXISTS customer_accounts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_number  TEXT NOT NULL UNIQUE,
                customer_name   TEXT NOT NULL,
                dob             TEXT NOT NULL,
                phone           TEXT,
                email           TEXT,
                balance         REAL NOT NULL DEFAULT 0.0,
                account_type    TEXT DEFAULT 'savings',
                test_meta_data  TEXT DEFAULT '{}',
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS loans (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_number  TEXT NOT NULL REFERENCES customer_accounts(account_number),
                loan_type       TEXT NOT NULL,
                principal       REAL NOT NULL,
                outstanding     REAL NOT NULL,
                emi_amount      REAL NOT NULL,
                emi_due_date    TEXT NOT NULL,
                next_due        TEXT NOT NULL,
                status          TEXT NOT NULL DEFAULT 'active',
                created_at      REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE INDEX IF NOT EXISTS idx_customers_account ON customer_accounts(account_number);
            CREATE INDEX IF NOT EXISTS idx_loans_account ON loans(account_number);

            CREATE TABLE IF NOT EXISTS learned_affinities (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                intent_label TEXT NOT NULL,
                pattern      TEXT NOT NULL UNIQUE,
                hit_count    INTEGER DEFAULT 0,
                is_verified  INTEGER DEFAULT 0,
                created_at   REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            CREATE INDEX IF NOT EXISTS idx_affinities_intent ON learned_affinities(intent_label);
            CREATE INDEX IF NOT EXISTS idx_affinities_pattern ON learned_affinities(pattern);
        """)

        # Ensure test_meta_data exists in customer_accounts
        existing_customer_cols = {row[1] for row in conn.execute("PRAGMA table_info(customer_accounts)").fetchall()}
        if "test_meta_data" not in existing_customer_cols:
            try:
                conn.execute("ALTER TABLE customer_accounts ADD COLUMN test_meta_data TEXT DEFAULT '{}'")
            except sqlite3.OperationalError:
                pass

        conn.commit()

        # 4. AI Persona Builder Registry
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS aiPersonas (
                id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
                name               TEXT NOT NULL,
                gender             TEXT DEFAULT 'Female',
                language           TEXT DEFAULT 'English',
                tone               TEXT DEFAULT '',
                use_case           TEXT DEFAULT '',
                psychology         TEXT DEFAULT '',
                emotion            TEXT DEFAULT 'Empathetic',
                urgency            REAL DEFAULT 45,
                empathy            REAL DEFAULT 75,
                stability          REAL DEFAULT 80,
                clarity            REAL DEFAULT 60,
                style_exaggeration REAL DEFAULT 35,
                base_model         TEXT DEFAULT 'Sonix-Flash-1',
                selected_voice     TEXT DEFAULT 'v1',
                theme_color        TEXT DEFAULT 'blue',
                is_active          INTEGER NOT NULL DEFAULT 1,
                is_deployed        INTEGER NOT NULL DEFAULT 0,
                created_at         REAL NOT NULL DEFAULT (strftime('%s','now')),
                updated_at         REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            CREATE INDEX IF NOT EXISTS idx_ai_personas_active ON aiPersonas(is_active);
        """)
        conn.commit()

        # 3b. Migrate legacy rows missing columns
        existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(workflows)").fetchall()}
        if "is_active" not in existing_cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
        if "updated_at" not in existing_cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN updated_at REAL NOT NULL DEFAULT 0")
            conn.execute("UPDATE workflows SET updated_at = created_at WHERE updated_at = 0")
        if "owner_user_id" not in existing_cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN owner_user_id TEXT REFERENCES users(id)")
        existing_kb_cols = {row[1] for row in conn.execute("PRAGMA table_info(knowledge_base)").fetchall()}
        if "owner_user_id" not in existing_kb_cols:
            conn.execute("ALTER TABLE knowledge_base ADD COLUMN owner_user_id TEXT REFERENCES users(id)")
        if "source" not in existing_kb_cols:
            conn.execute("ALTER TABLE knowledge_base ADD COLUMN source TEXT")
            logger.info("KB Migration: Added 'source' column for filename-based filtering.")
        
        # AI Personas Migration
        existing_persona_cols = {row[1] for row in conn.execute("PRAGMA table_info(aiPersonas)").fetchall()}
        if "theme_color" not in existing_persona_cols:
            conn.execute("ALTER TABLE aiPersonas ADD COLUMN theme_color TEXT DEFAULT 'blue'")
            # Backfill core personas with their specific colors
            color_map = {
                'ananya': 'amber', 'arjun': 'blue', 'priya': 'emerald', 'ravi': 'rose',
                'kavitha': 'purple', 'vikram': 'cyan', 'diya': 'teal', 'aditya': 'orange'
            }
            for pid, color in color_map.items():
                conn.execute("UPDATE aiPersonas SET theme_color = ? WHERE id = ?", (color, pid))
            logger.info("Migrated aiPersonas: Added theme_color column.")
        conn.commit()

        admin_id = self._seed_default_admin()
        self._backfill_owner_columns(admin_id)
        self._seed_default_bots()
        self._seed_ai_personas()

    def _seed_default_bots(self) -> None:
        """
        Ensure a stable blank recovery bot exists for dropped-call / handoff scenarios.
        Fixed id `recovery-blank` so integrations can target it without scanning the registry.
        """
        conn = self._get_conn()
        bot_id = "recovery-blank"
        row = conn.execute("SELECT id, is_active FROM bots WHERE id = ?", (bot_id,)).fetchone()
        if row:
            if row["is_active"] == 0:
                conn.execute(
                    "UPDATE bots SET is_active = 1, updated_at = strftime('%s','now') WHERE id = ?",
                    (bot_id,),
                )
                conn.commit()
            return

        name = "Blank Agent (Call Recovery)"
        if conn.execute("SELECT 1 FROM bots WHERE name = ? AND is_active = 1", (name,)).fetchone():
            return

        tools_json = json.dumps(
            ["search_knowledge", "get_appointments", "remember_user_fact"]
        )
        system_prompt = (
            "You are a concise, professional voice assistant for callers whose session may have "
            "dropped, transferred, or restarted. Greet briefly and confirm you are ready to help. "
            "If you need to look up information, use search_knowledge immediately without "
            "announcing it. Do not invent policies or data. Keep replies short and clear."
        )

        greeting = "Hi — I'm here to continue. What do you need help with?"
        description = (
            "Built-in fallback persona for call recovery and advanced handoff. No workflow binding; "
            "pure LLM + tools. Safe to use as default when bot_id is unknown."
        )
        owner_user_id = self._get_admin_user_id(conn)
        conn.execute(
            """
            INSERT INTO bots (
                id, name, description, persona, system_prompt, greeting, tools_enabled,
                llm_model, voice_id, role, icon, color, temperature, max_tokens, workflow_id, owner_user_id,
                 default_language
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            (
                bot_id,
                name,
                description,
                "calm, efficient, and helpful",
                system_prompt,
                greeting,
                tools_json,
                "llama-3.3-70b-versatile",
                "EXAVITQu4vr4xnSDxMaL",
                "Call recovery",
                "bot",
                "primary",
                0.6,
                1024,
                owner_user_id,
                "hi",
            ),
        )
        conn.commit()
        
        # Add test_meta_data for persistent simulator overrides if it doesn't exist
        try:
            conn.execute("ALTER TABLE customer_accounts ADD COLUMN test_meta_data TEXT DEFAULT '{}'")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        logger.info("Seeded default bot: %s (%s)", name, bot_id)

        # If the registry is otherwise empty, seed a small starter pack so Bot Factory + DIY
        # have usable personas out of the box.
        existing_non_recovery = conn.execute(
            "SELECT COUNT(1) AS c FROM bots WHERE is_active = 1 AND id != ?",
            (bot_id,),
        ).fetchone()
        if existing_non_recovery and int(existing_non_recovery["c"] or 0) > 0:
            return

        owner_user_id = self._get_admin_user_id(conn)
        tools_json = json.dumps(
            ["search_knowledge", "book_appointment", "get_appointments", "remember_user_fact"]
        )
        voice_default = "EXAVITQu4vr4xnSDxMaL"  # stable ElevenLabs voice used elsewhere

        starter = [
            {
                "id": "starter-female-hi-soft-focus",
                "name": "Starter · Female · Hindi · Soft · Focus",
                "description": "Calm, focused Hindi voice agent for concise assistance and clear next steps.",
                "persona": "A calm, focused, soft-spoken female Hindi voice agent. Polite, efficient, and empathetic.",
                "system_prompt": "You are a calm, focused female Hindi voice agent. Speak briefly and clearly. Ask one question at a time. Confirm key details. End with clear next steps.",
                "role": "Voice Agent",
                "icon": "concierge",
                "color": "primary",
                "default_language": "hi",
                "tts_provider": "elevenlabs",
            },
            {
                "id": "starter-female-en-firm-direct",
                "name": "Starter · Female · English · Firm · Direct",
                "description": "Firm, direct English agent for outcome-oriented conversations.",
                "persona": "A firm, direct female English voice agent. No fluff; outcome-oriented.",
                "system_prompt": "You are a firm, direct English voice agent. Be concise. Drive the conversation to a resolution with clear options. Avoid filler.",
                "role": "Voice Agent",
                "icon": "memory",
                "color": "secondary",
                "default_language": "en",
                "tts_provider": "elevenlabs",
            },
            {
                "id": "starter-male-hi-soft-empathy",
                "name": "Starter · Male · Hindi · Soft · Empathetic",
                "description": "Empathetic Hindi agent for sensitive support and reassurance.",
                "persona": "An empathetic male Hindi voice agent. Patient, reassuring, and helpful.",
                "system_prompt": "You are an empathetic male Hindi voice agent. Acknowledge feelings, reassure, then ask focused questions. Keep responses short.",
                "role": "Voice Agent",
                "icon": "event_busy",
                "color": "primary",
                "default_language": "hi",
                "tts_provider": "elevenlabs",
            },
            {
                "id": "starter-male-en-soft-support",
                "name": "Starter · Male · English · Soft · Support",
                "description": "Gentle English support agent with structured troubleshooting.",
                "persona": "A gentle male English support agent. Friendly and helpful, with structured troubleshooting.",
                "system_prompt": "You are a gentle English support agent. Ask clarifying questions, provide step-by-step guidance, confirm outcomes, and summarize next steps.",
                "role": "Voice Agent",
                "icon": "account_balance",
                "color": "secondary",
                "default_language": "en",
                "tts_provider": "elevenlabs",
            },
            {
                "id": "starter-female-hi-firm-collections",
                "name": "Starter · Female · Hindi · Firm · Collections",
                "description": "Firm Hindi collections agent for payments, due reminders, and objections handling.",
                "persona": "A firm female Hindi collections agent. Polite but assertive.",
                "system_prompt": "You are a firm Hindi collections agent. Verify identity, state the issue clearly, offer payment options, handle objections briefly, and close with an action.",
                "role": "Voice Agent",
                "icon": "concierge",
                "color": "primary",
                "default_language": "hi",
                "tts_provider": "elevenlabs",
            },
            {
                "id": "starter-female-en-warm-sales",
                "name": "Starter · Female · English · Warm · Sales",
                "description": "Warm English sales agent for discovery, objections, and confident next steps.",
                "persona": "A warm female English sales agent. Curious, confident, and persuasive.",
                "system_prompt": "You are a warm English sales agent. Discover needs, highlight benefits, handle objections, and propose the next step. Keep it short and confident.",
                "role": "Voice Agent",
                "icon": "memory",
                "color": "secondary",
                "default_language": "en",
                "tts_provider": "elevenlabs",
            },
        ]

        for b in starter:
            try:
                if conn.execute("SELECT 1 FROM bots WHERE id = ?", (b["id"],)).fetchone():
                    continue
                if conn.execute("SELECT 1 FROM bots WHERE name = ? AND is_active = 1", (b["name"],)).fetchone():
                    continue
                conn.execute(
                    """
                    INSERT INTO bots (
                        id, name, description, persona, system_prompt, greeting, tools_enabled,
                        llm_provider, llm_model, voice_id, role, icon, color, temperature, max_tokens,
                        workflow_id, default_language, tts_provider, proactive_prompts, topic_restriction,
                        refuse_off_topic, owner_user_id, min_stt_confidence
                    )
                    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, '[]', NULL, 0, ?, 0.35)
                    """,
                    (
                        b["id"],
                        b["name"],
                        b["description"],
                        b["persona"],
                        b["system_prompt"],
                        tools_json,
                        "gemini",
                        "gemini-2.0-flash-001",
                        voice_default,
                        b["role"],
                        b["icon"],
                        b["color"],
                        0.7,
                        2048,
                        b["default_language"],
                        b["tts_provider"],
                        owner_user_id,
                    ),
                )
            except Exception as _e:
                logger.warning("Starter bot seed failed for %s: %s", b.get("id"), _e)

        conn.commit()
        logger.info("Seeded starter bot pack (%d)", len(starter))

    def _seed_ai_personas(self) -> None:
        """
        Seed the aiPersonas table with the 8 core personas on a fresh database.
        Skips if any rows already exist.
        """
        conn = self._get_conn()
        count = conn.execute("SELECT COUNT(1) FROM aiPersonas").fetchone()[0]
        if count > 0:
            return  # already seeded — skip

        core = [
            {
                "id": "ananya",
                "name": "Ananya",
                "gender": "Female",
                "language": "Hindi/Hinglish",
                "tone": "Warm · Empathetic",
                "use_case": "Soft collections (DPD 1-30)",
                "psychology": "Helpful sister persona. Trust-builder.",
                "emotion": "Empathetic",
                "urgency": 30, "empathy": 85, "stability": 80, "clarity": 60,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v1",
                "theme_color": "amber",
            },
            {
                "id": "arjun",
                "name": "Arjun",
                "gender": "Male",
                "language": "Hindi/Hinglish",
                "tone": "Firm · Professional",
                "use_case": "Mid-stage (DPD 30-90)",
                "psychology": "Senior RM energy.",
                "emotion": "Firm",
                "urgency": 70, "empathy": 40, "stability": 90, "clarity": 80,
                "style_exaggeration": 35,
                "base_model": "Sonix-Pro-3",
                "selected_voice": "v2",
                "theme_color": "blue",
            },
            {
                "id": "priya",
                "name": "Priya",
                "gender": "Female",
                "language": "English",
                "tone": "Upbeat · Professional",
                "use_case": "Cards acquisition",
                "psychology": "Smart financial advisor.",
                "emotion": "Analytical",
                "urgency": 60, "empathy": 50, "stability": 70, "clarity": 90,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v1",
                "theme_color": "emerald",
            },
            {
                "id": "ravi",
                "name": "Ravi",
                "gender": "Male",
                "language": "Hindi",
                "tone": "Authoritative · Measured",
                "use_case": "NPA settlement",
                "psychology": "Data-driven pressure.",
                "emotion": "Firm",
                "urgency": 85, "empathy": 20, "stability": 95, "clarity": 75,
                "style_exaggeration": 35,
                "base_model": "Sonix-Pro-3",
                "selected_voice": "v2",
                "theme_color": "rose",
            },
            {
                "id": "kavitha",
                "name": "Kavitha",
                "gender": "Female",
                "language": "Tamil + English",
                "tone": "Patient · Respectful",
                "use_case": "Regional collections",
                "psychology": "Cultural respect + patience.",
                "emotion": "Empathetic",
                "urgency": 40, "empathy": 90, "stability": 85, "clarity": 60,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v3",
                "theme_color": "purple",
            },
            {
                "id": "vikram",
                "name": "Vikram",
                "gender": "Male",
                "language": "English",
                "tone": "Energetic · Consultative",
                "use_case": "Cross-sell, upsell",
                "psychology": "Consultative expert.",
                "emotion": "Analytical",
                "urgency": 55, "empathy": 45, "stability": 75, "clarity": 90,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v1",
                "theme_color": "cyan",
            },
            {
                "id": "diya",
                "name": "Diya",
                "gender": "Female",
                "language": "Hinglish",
                "tone": "Calm · Supportive",
                "use_case": "Hardship cases",
                "psychology": "Dignity-preserving.",
                "emotion": "Empathetic",
                "urgency": 20, "empathy": 95, "stability": 88, "clarity": 60,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v3",
                "theme_color": "teal",
            },
            {
                "id": "aditya",
                "name": "Aditya",
                "gender": "Male",
                "language": "English/Hindi",
                "tone": "Friendly · Celebratory",
                "use_case": "Relationship building",
                "psychology": "Positive reinforcement logic.",
                "emotion": "Casual",
                "urgency": 10, "empathy": 80, "stability": 60, "clarity": 60,
                "style_exaggeration": 35,
                "base_model": "Sonix-Flash-1",
                "selected_voice": "v2",
                "theme_color": "orange",
            },
        ]

        insert_sql = """
            INSERT OR IGNORE INTO aiPersonas (
                id, name, gender, language, tone, use_case, psychology,
                emotion, urgency, empathy, stability, clarity,
                style_exaggeration, base_model, selected_voice, theme_color
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        for p in core:
            try:
                conn.execute(insert_sql, (
                    p["id"], p["name"], p["gender"], p["language"],
                    p["tone"], p["use_case"], p["psychology"], p["emotion"],
                    float(p["urgency"]), float(p["empathy"]),
                    float(p["stability"]), float(p["clarity"]),
                    float(p["style_exaggeration"]),
                    p["base_model"], p["selected_voice"], p["theme_color"],
                ))
            except Exception as _e:
                logger.warning("AI persona seed failed for %s: %s", p.get("id"), _e)

        conn.commit()
        logger.info("Seeded 8 core AI personas")


    def _hash_password_seed(self, password: str, *, iterations: int = 150_000) -> str:
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), iterations
        ).hex()
        return f"pbkdf2_sha256${iterations}${salt}${dk}"

    def _seed_default_admin(self) -> str:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"
        ).fetchone()
        if row:
            return str(row["id"])
        username = (settings.admin_username if hasattr(settings, "admin_username") else "") or "admin"
        password = (settings.admin_password if hasattr(settings, "admin_password") else "") or "admin123"
        admin_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO users (id, username, password_hash, role, is_active)
            VALUES (?, ?, ?, 'admin', 1)
            """,
            (admin_id, username, self._hash_password_seed(password)),
        )
        conn.commit()
        logger.info("Seeded default admin user: %s", username)
        return admin_id

    def _get_admin_user_id(self, conn: sqlite3.Connection) -> Optional[str]:
        row = conn.execute(
            "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY created_at LIMIT 1"
        ).fetchone()
        return str(row["id"]) if row else None

    def _backfill_owner_columns(self, admin_id: str) -> None:
        conn = self._get_conn()
        conn.execute(
            "UPDATE bots SET owner_user_id = COALESCE(owner_user_id, ?) WHERE owner_user_id IS NULL",
            (admin_id,),
        )
        conn.execute(
            "UPDATE workflows SET owner_user_id = COALESCE(owner_user_id, ?) WHERE owner_user_id IS NULL",
            (admin_id,),
        )
        conn.execute(
            "UPDATE knowledge_base SET owner_user_id = COALESCE(owner_user_id, ?) WHERE owner_user_id IS NULL",
            (admin_id,),
        )
        conn.execute(
            "UPDATE sessions SET user_id = COALESCE(user_id, ?) WHERE user_id IS NULL OR user_id = ''",
            (admin_id,),
        )
        conn.commit()

    # ─── Bot Registry ─────────────────────────────────────────────────────────

    # ─── User Registry / Auth ────────────────────────────────────────────────

    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        def _do():
            row = self._get_conn().execute(
                "SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)

    async def get_user_by_username(self, username: str) -> Optional[dict]:
        def _do():
            row = self._get_conn().execute(
                "SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE lower(username) = lower(?)",
                (username,),
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)

    async def list_users(self) -> list[dict]:
        def _do():
            rows = self._get_conn().execute(
                "SELECT id, username, role, is_active, created_at, updated_at FROM users ORDER BY created_at ASC"
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def create_user(self, username: str, password_hash: str, role: str = "user") -> dict:
        def _do():
            conn = self._get_conn()
            user_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO users (id, username, password_hash, role, is_active)
                VALUES (?, ?, ?, ?, 1)
                """,
                (user_id, username, password_hash, role),
            )
            conn.commit()
            return {"id": user_id, "username": username, "role": role, "is_active": 1}
        return await self._run(_do)

    async def update_user(self, user_id: str, *, username: Optional[str] = None, role: Optional[str] = None, is_active: Optional[bool] = None) -> bool:
        def _do():
            updates: dict[str, Any] = {}
            if username is not None:
                updates["username"] = username
            if role is not None:
                updates["role"] = role
            if is_active is not None:
                updates["is_active"] = 1 if is_active else 0
            if not updates:
                return False
            updates["updated_at"] = time.time()
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [user_id]
            conn = self._get_conn()
            conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def change_password(self, user_id: str, password_hash: str) -> bool:
        def _do():
            conn = self._get_conn()
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (password_hash, time.time(), user_id),
            )
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def create_bot(self, name: str, persona: str, system_prompt: str,
                         description: str = "", greeting: Optional[str] = None,
                         tools_enabled: Optional[list] = None,
                         llm_provider: str = "",
                         llm_model: str = "llama-3.3-70b-versatile",
                         voice_id: Optional[str] = None,
                         role: str = "AI Assistant",
                         icon: str = "bot",
                         color: str = "primary",
                         temperature: float = 0.7,
                         max_tokens: int = 2048, tts_provider: str = "deepgram_ws", default_language: str = "hi", proactive_prompts: Optional[list] = None,
                         topic_restriction: Optional[str] = None, refuse_off_topic: bool = False,
                         owner_user_id: Optional[str] = None, min_stt_confidence: float = 0.35,
                         is_landing_page_default: bool = False,
                         workflow_id: Optional[str] = None,
                         tts_model: Optional[str] = None) -> dict:
        """Create a new bot configuration."""
        def _do():
            conn = self._get_conn()
            if is_landing_page_default:
                conn.execute("UPDATE bots SET is_landing_page_default = 0")
            
            bot_id = str(uuid.uuid4())[:8]
            tools_json = json.dumps(tools_enabled or [])
            conn.execute("""
                INSERT INTO bots (id, name, description, persona, system_prompt, greeting, tools_enabled, llm_provider, llm_model, voice_id, role, icon, color, temperature, max_tokens, workflow_id, default_language, tts_provider, tts_model, proactive_prompts, topic_restriction, refuse_off_topic, owner_user_id, min_stt_confidence,is_landing_page_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (bot_id, name, description, persona, system_prompt, greeting, tools_json, llm_provider, llm_model, voice_id, role, icon, color, temperature, max_tokens, workflow_id, default_language, tts_provider, tts_model, json.dumps(proactive_prompts or []), topic_restriction, 1 if refuse_off_topic else 0, owner_user_id, min_stt_confidence, 1 if is_landing_page_default else 0))
            conn.commit()
            return {"id": bot_id, "name": name, "persona": persona}

        result = await self._run(_do)
        logger.info("Bot created: %s (%s)", name, result["id"])
        return result

    async def get_bot(self, bot_id: str) -> Optional[dict]:
        """Retrieve a bot configuration by ID."""
        def _do():
            conn = self._get_conn()
            row = conn.execute("SELECT * FROM bots WHERE id = ? AND is_active = 1", (bot_id,)).fetchone()
            if row:
                d = dict(row)
                d["tools_enabled"] = json.loads(d.get("tools_enabled", "[]"))
                d["guardrail_policy"] = parse_json_dict(d.get("guardrail_policy"))
                d["data_access_policy"] = parse_json_dict(d.get("data_access_policy"))
                d["conversation_policy"] = parse_json_dict(d.get("conversation_policy"))
                if d.get("pipeline_mode") is None:
                    d["pipeline_mode"] = "classic"
                d["agent_task_spec"] = parse_agent_task_spec(d.get("agent_task_spec"))
                d["proactive_prompts"] = json.loads(d.get("proactive_prompts", "[]"))
                d["variable_mappings"] = json.loads(d.get("variable_mappings", "{}"))
                d["metadata_defaults"] = json.loads(d.get("metadata_defaults", "{}"))
                return d
            return None
        return await self._run(_do)

    async def get_bot_by_name(self, name: str) -> Optional[dict]:
        """Retrieve a bot configuration by name."""
        def _do():
            conn = self._get_conn()
            row = conn.execute("SELECT * FROM bots WHERE name = ? AND is_active = 1", (name,)).fetchone()
            if row:
                d = dict(row)
                d["tools_enabled"] = json.loads(d.get("tools_enabled", "[]"))
                d["guardrail_policy"] = parse_json_dict(d.get("guardrail_policy"))
                d["data_access_policy"] = parse_json_dict(d.get("data_access_policy"))
                d["conversation_policy"] = parse_json_dict(d.get("conversation_policy"))
                if d.get("pipeline_mode") is None:
                    d["pipeline_mode"] = "classic"
                d["agent_task_spec"] = parse_agent_task_spec(d.get("agent_task_spec"))
                d["proactive_prompts"] = json.loads(d.get("proactive_prompts", "[]"))
                d["variable_mappings"] = json.loads(d.get("variable_mappings", "{}"))
                d["metadata_defaults"] = json.loads(d.get("metadata_defaults", "{}"))
                return d
            return None
        return await self._run(_do)

    async def list_bots(self) -> list[dict]:
        """List all active bots."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("SELECT id, name, description, persona, role, icon, color, tools_enabled, llm_model, voice_id, temperature, max_tokens, is_active, created_at, topic_restriction, refuse_off_topic, min_stt_confidence, owner_user_id FROM bots WHERE is_active = 1 ORDER BY created_at DESC").fetchall()
            results = []
            for r in rows:
                d = dict(r)
                if d.get("tools_enabled") and isinstance(d["tools_enabled"], str):
                    try:
                        d["tools_enabled"] = json.loads(d["tools_enabled"])
                    except:
                        d["tools_enabled"] = []
                results.append(d)
            return results
        return await self._run(_do)

    async def update_bot(self, bot_id: str, **fields) -> bool:
        """Update bot fields."""
        def _do():
            conn = self._get_conn()
            allowed = {
                "name", "description", "persona", "system_prompt", "greeting", "tools_enabled",
                "llm_provider", "llm_model", "voice_id", "role", "icon", "color", "temperature", "max_tokens", "workflow_id",
                "guardrail_policy", "data_access_policy", "conversation_policy", "pipeline_mode",
                "agent_task_spec", "default_language", "tts_provider", "stt_endpointing_ms",
                "stt_utterance_end_ms", "first_segment_chars", "ultra_first_segment_chars",
                "barge_in_grace_period_ms", "barge_in_debounce_ms", "topic_check_async",
                "audio_frame_normalize", "proactive_prompts",
                "topic_restriction", "refuse_off_topic", "min_stt_confidence",
                "is_landing_page_default", "variable_mappings", "metadata_defaults", "tts_model",
            }
            updates = {k: v for k, v in fields.items() if k in allowed}
            
            if updates.get("is_landing_page_default"):
                conn.execute("UPDATE bots SET is_landing_page_default = 0")
                updates["is_landing_page_default"] = 1
            elif "is_landing_page_default" in updates:
                 updates["is_landing_page_default"] = 0

            for field in ("tools_enabled", "proactive_prompts", "agent_task_spec", 
                          "variable_mappings", "metadata_defaults",
                          "guardrail_policy", "data_access_policy", "conversation_policy"):
                if field in updates and (isinstance(updates[field], (dict, list))):
                    updates[field] = json.dumps(updates[field])
            if "refuse_off_topic" in updates:
                updates["refuse_off_topic"] = 1 if updates["refuse_off_topic"] else 0
            
            updates["updated_at"] = time.time()
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [bot_id]
            conn.execute(f"UPDATE bots SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def get_landing_page_default_bot(self) -> Optional[dict]:
        """Fetch the bot explicitly marked for the landing page."""
        def _do():
            conn = self._get_conn()
            row = conn.execute("SELECT * FROM bots WHERE is_landing_page_default = 1 AND is_active = 1 LIMIT 1").fetchone()
            if row:
                d = dict(row)
                d["tools_enabled"] = json.loads(d.get("tools_enabled", "[]"))
                return d
            return None
        return await self._run(_do)

    async def delete_bot(self, bot_id: str) -> bool:
        """Soft-delete a bot."""
        def _do():
            conn = self._get_conn()
            conn.execute("UPDATE bots SET is_active = 0 WHERE id = ?", (bot_id,))
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    # ─── Workflow Management ──────────────────────────────────────────────────

    async def save_workflow(self, workflow_id: str, name: str, description: str, nodes: list, edges: list, owner_user_id: Optional[str] = None) -> None:
        """Create or update a workflow graph."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO workflows (id, name, description, nodes_json, edges_json, updated_at)
                VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    nodes_json=excluded.nodes_json,
                    edges_json=excluded.edges_json,
                    updated_at=strftime('%s','now')
            """, (workflow_id, name, description, json.dumps(nodes), json.dumps(edges)))
            if owner_user_id:
                conn.execute(
                    "UPDATE workflows SET owner_user_id = COALESCE(owner_user_id, ?) WHERE id = ?",
                    (owner_user_id, workflow_id),
                )
            conn.commit()
        await self._run(_do)

    async def get_workflow(self, workflow_id: str) -> Optional[dict]:
        """Fetch a workflow graph by ID and parse its structure."""
        def _do():
            row = self._get_conn().execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
            if not row: return None
            data = dict(row)
            data['nodes'] = json.loads(data['nodes_json'])
            data['edges'] = json.loads(data['edges_json'])
            return data
        return await self._run(_do)

    async def list_workflows(self) -> list[dict]:
        """Fetch all workflow graphs."""
        def _do():
            rows = self._get_conn().execute("SELECT * FROM workflows ORDER BY updated_at DESC, created_at DESC").fetchall()
            results = []
            for row in rows:
                data = dict(row)
                data['nodes'] = json.loads(data['nodes_json'])
                data['edges'] = json.loads(data['edges_json'])
                results.append(data)
            return results
        return await self._run(_do)

    # ─── Session Management ───────────────────────────────────────────────────

    async def create_session(self, session_id: str, bot_id: Optional[str] = None,
                             user_id: Optional[str] = None, language: str = "hi",
                             metadata: Optional[dict] = None) -> None:
        """Register or update a session in SQLite."""
        meta_json = json.dumps(metadata or {})
        def _do():
            conn = self._get_conn()
            # 1. Insert session record if it doesn't exist yet
            conn.execute("""
                INSERT OR IGNORE INTO sessions (id, bot_id, user_id, language, metadata, started_at)
                VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
            """, (session_id, bot_id, user_id, language, meta_json))
            
            # 2. Update existing session fields (except started_at)
            conn.execute("""
                UPDATE sessions 
                SET bot_id = COALESCE(?, bot_id),
                    user_id = COALESCE(?, user_id),
                    language = ?,
                    metadata = ?
                WHERE id = ?
            """, (bot_id, user_id, language, meta_json, session_id))
            
            conn.commit()
        await self._run(_do)
        logger.info("Session registered/updated in DB: %s", session_id[:8])

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Fetch a session record by ID, including bot name and metadata."""
        def _do():
            conn = self._get_conn()
            row = conn.execute("""
                SELECT s.id, s.bot_id, b.name as bot_name, s.user_id, s.language, 
                       s.started_at, s.ended_at, s.turn_count, s.metadata
                FROM sessions s LEFT JOIN bots b ON s.bot_id = b.id
                WHERE s.id = ?
            """, (session_id,)).fetchone()
            if row:
                res = dict(row)
                res["metadata"] = json.loads(res["metadata"]) if res["metadata"] else {}
                mrow = conn.execute(
                    """
                    SELECT
                        COUNT(*) AS n,
                        AVG(json_extract(arguments, '$.stt_ms')) AS avg_stt,
                        AVG(json_extract(arguments, '$.llm_ms')) AS avg_llm,
                        AVG(json_extract(arguments, '$.tts_ms')) AS avg_tts,
                        AVG(json_extract(arguments, '$.total_ms')) AS avg_total,
                        AVG(json_extract(arguments, '$.first_audio_ms')) AS avg_first_audio
                    FROM tool_logs
                    WHERE session_id = ? AND tool_name = '__metrics__'
                    """,
                    (session_id,),
                ).fetchone()
                n = int(mrow["n"] or 0) if mrow else 0
                metrics_patch: dict = {"metrics_turn_count": n}
                if n > 0:
                    metrics_patch.update(
                        {
                            "avg_stt_ms": round(mrow["avg_stt"] or 0, 1),
                            "avg_llm_ms": round(mrow["avg_llm"] or 0, 1),
                            "avg_tts_ms": round(mrow["avg_tts"] or 0, 1),
                            "avg_total_ms": round(mrow["avg_total"] or 0, 1),
                            "avg_first_audio_ms": round(
                                mrow["avg_first_audio"] or 0, 1
                            ),
                        }
                    )
                res["metadata"] = {**res["metadata"], **metrics_patch}
                return res
            return None
        return await self._run(_do)

    async def merge_session_metadata(self, session_id: str, patch: dict) -> None:
        """Merge ``patch`` into sessions.metadata JSON without changing ended_at / turn_count."""
        if not patch:
            return

        def _do():
            conn = self._get_conn()
            row = conn.execute(
                "SELECT metadata FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if not row:
                return
            existing_meta = json.loads(row[0]) if row[0] else {}
            existing_meta.update(patch)
            conn.execute(
                "UPDATE sessions SET metadata = ? WHERE id = ?",
                (json.dumps(existing_meta), session_id),
            )
            conn.commit()

        await self._run(_do)

    async def close_session(self, session_id: str, turn_count: int = 0, metadata: dict = None) -> None:
        """Mark session as ended and optionally append metadata (like generic summaries)."""
        def _do():
            conn = self._get_conn()
            
            # Fetch existing metadata to merge
            row = conn.execute("SELECT metadata FROM sessions WHERE id = ?", (session_id,)).fetchone()
            existing_meta = json.loads(row[0]) if row and row[0] else {}
            if metadata:
                existing_meta.update(metadata)
            
            conn.execute("""
                UPDATE sessions 
                SET ended_at = strftime('%s','now'), 
                    turn_count = ?,
                    metadata = ?
                WHERE id = ?
            """, (turn_count, json.dumps(existing_meta), session_id))
            conn.commit()
        await self._run(_do)

    async def list_sessions(self, limit: int = 50) -> list[dict]:
        """List recent sessions."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("""
                SELECT s.id, s.bot_id, b.name as bot_name, s.user_id, s.language,
                       s.started_at, s.ended_at, s.turn_count, s.metadata
                FROM sessions s LEFT JOIN bots b ON s.bot_id = b.id
                ORDER BY s.started_at DESC LIMIT ?
            """, (limit,)).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
                results.append(d)
            return results
        return await self._run(_do)

    # ─── Conversation Logging ─────────────────────────────────────────────────

    async def log_turn(self, session_id: str, role: str, content: str, metadata: dict = None) -> None:
        """Log a single conversation turn."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO conversation_logs (session_id, role, content, metadata)
                VALUES (?, ?, ?, ?)
            """, (session_id, role, content, json.dumps(metadata or {})))
            conn.commit()
        await self._run(_do)

    async def get_session_log(self, session_id: str) -> list[dict]:
        """Get full conversation log for a session."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("""
                SELECT role, content, timestamp, metadata
                FROM conversation_logs WHERE session_id = ?
                ORDER BY timestamp
            """, (session_id,)).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    # ─── Appointments ─────────────────────────────────────────────────────────

    async def book_appointment(self, user_name: str, date: str, time_str: str,
                               reason: str = "", session_id: Optional[str] = None) -> dict:
        """Book a new appointment."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO appointments (session_id, user_name, date, time, reason)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, user_name, date, time_str, reason))
            conn.commit()
            row = conn.execute("SELECT * FROM appointments ORDER BY id DESC LIMIT 1").fetchone()
            return dict(row)
        result = await self._run(_do)
        logger.info("Appointment booked: %s on %s at %s", user_name, date, time_str)
        return result

    async def get_appointments(
        self,
        user_name: Optional[str] = None,
        limit: int = 10,
        data_access: Optional[dict] = None,
    ) -> list[dict]:
        """Get upcoming appointments, optionally filtered by name."""
        da = data_access or {}
        try:
            cap = int(da.get("max_appointment_rows", da.get("max_rows", limit)))
            limit = max(1, min(limit, cap))
        except (TypeError, ValueError):
            pass

        def _do():
            conn = self._get_conn()
            if user_name:
                rows = conn.execute("""
                    SELECT * FROM appointments
                    WHERE user_name LIKE ? AND status = 'confirmed'
                    ORDER BY date, time LIMIT ?
                """, (f"%{user_name}%", limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM appointments WHERE status = 'confirmed'
                    ORDER BY date, time LIMIT ?
                """, (limit,)).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    # ─── User Facts ───────────────────────────────────────────────────────────

    async def save_user_fact(self, fact: str, session_id: Optional[str] = None,
                             user_id: Optional[str] = None, category: str = "general") -> None:
        """Store a fact the user shared in conversation."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO user_facts (session_id, user_id, fact, category)
                VALUES (?, ?, ?, ?)
            """, (session_id, user_id, fact, category))
            conn.commit()
        await self._run(_do)
        logger.info("User fact saved: %s", fact[:60])

    async def replace_session_extracted_facts(
        self,
        session_id: str,
        user_id: Optional[str],
        rows: list[tuple[str, str]],
    ) -> None:
        """
        Remove prior LLM-extracted entities for this session (category ``session_extracted.%``)
        and insert fresh rows. Does not delete facts from ``remember_user_fact`` (other categories).
        """
        def _do():
            conn = self._get_conn()
            conn.execute(
                """
                DELETE FROM user_facts
                WHERE session_id = ? AND category LIKE 'session_extracted.%'
                """,
                (session_id,),
            )
            for fact, category in rows:
                conn.execute(
                    """
                    INSERT INTO user_facts (session_id, user_id, fact, category)
                    VALUES (?, ?, ?, ?)
                    """,
                    (session_id, user_id, fact, category),
                )
            conn.commit()

        await self._run(_do)
        logger.debug(
            "Session extracted facts replaced: session=%s count=%d",
            session_id[:8],
            len(rows),
        )

    # ─── Commitment Training (Self-Learning) ─────────────────────────────────

    async def save_commitment_training_example(
        self, task_type: str, input_text: str, prediction: str, session_id: Optional[str] = None
    ) -> None:
        """Store a raw commitment extraction or contradiction detection prediction for self-learning."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                "INSERT INTO commitment_training_examples (task_type, input_text, prediction, session_id) VALUES (?, ?, ?, ?)",
                (task_type, input_text[:500], prediction[:200], session_id),
            )
            conn.commit()
        await self._run(_do)

    async def get_commitment_few_shots(self, task_type: str, limit: int = 5) -> list[dict]:
        """Return confirmed-correct past predictions for dynamic few-shot injection."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute(
                "SELECT input_text, prediction FROM commitment_training_examples "
                "WHERE task_type = ? AND feedback = 'correct' AND prediction != 'NONE' "
                "ORDER BY created_at DESC LIMIT ?",
                (task_type, limit),
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def auto_label_commitment_examples(self, session_id: str) -> None:
        """
        Infer feedback labels for this session's training examples.
        - If bot raised a CONTRADICTION and user's NEXT turn confirmed it → 'correct'
        - If user's NEXT turn denied it → 'false_positive'
        Uses conversation_logs to find confirmation/denial signals.
        """
        def _do():
            conn = self._get_conn()
            # Get all unlabeled contradiction examples for this session
            examples = conn.execute(
                "SELECT id, prediction FROM commitment_training_examples "
                "WHERE session_id = ? AND task_type = 'check_contradiction' AND feedback IS NULL AND prediction != 'NONE'",
                (session_id,),
            ).fetchall()
            if not examples:
                return

            # Get conversation turns for this session
            turns = conn.execute(
                "SELECT role, content FROM conversation_logs WHERE session_id = ? AND role IN ('user','assistant') ORDER BY id",
                (session_id,),
            ).fetchall()
            turns = [dict(t) for t in turns]

            confirm_words = {"haan", "sahi", "theek", "correct", "yes", "right", "bilkul", "okay"}
            deny_words = {"nahi", "nahi", "no", "galat", "wrong", "maine nahi", "kabhi nahi", "false"}

            # Find assistant turns that reference a contradiction, check what user said next
            for i, turn in enumerate(turns):
                if turn["role"] == "assistant" and i + 1 < len(turns):
                    content_lower = turn["content"].lower()
                    if "pehle" in content_lower or "baat ki thi" in content_lower or "committed" in content_lower.lower():
                        next_user = turns[i + 1]
                        if next_user["role"] == "user":
                            user_words = set(next_user["content"].lower().split())
                            if user_words & confirm_words:
                                feedback = "correct"
                            elif user_words & deny_words:
                                feedback = "false_positive"
                            else:
                                continue
                            for ex in examples:
                                conn.execute(
                                    "UPDATE commitment_training_examples SET feedback = ? WHERE id = ?",
                                    (feedback, ex["id"]),
                                )
            conn.commit()
        await self._run(_do)

    async def get_commitment_training_export(self, task_type: Optional[str] = None, feedback: Optional[str] = None, limit: int = 1000) -> list[dict]:
        """Export training examples for fine-tuning. Returns list of dicts."""
        def _do():
            conn = self._get_conn()
            where = []
            params = []
            if task_type:
                where.append("task_type = ?")
                params.append(task_type)
            if feedback:
                where.append("feedback = ?")
                params.append(feedback)
            clause = ("WHERE " + " AND ".join(where)) if where else ""
            rows = conn.execute(
                f"SELECT task_type, input_text, prediction, feedback, session_id, created_at "
                f"FROM commitment_training_examples {clause} ORDER BY created_at DESC LIMIT ?",
                params + [limit],
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def get_user_facts(self, user_id: Optional[str] = None, session_id: Optional[str] = None) -> list[dict]:
        """Get stored facts about a user."""
        def _do():
            conn = self._get_conn()
            if user_id:
                rows = conn.execute("SELECT * FROM user_facts WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
            elif session_id:
                rows = conn.execute("SELECT * FROM user_facts WHERE session_id = ? ORDER BY created_at DESC", (session_id,)).fetchall()
            else:
                return []
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def get_user_cross_session_context(self, user_id: str) -> dict:
        """
        Return the 3-layer cross-session memory for a returning user.

        Layer 1 — User facts (permanent knowledge stored across all sessions).
        Layer 2 — Past session summaries (LLM-generated, compressed digests).
        Layer 3 — Recent turns from the most recent prior session (verbatim continuity).
        """
        def _do():
            conn = self._get_conn()

            # Layer 1: Persistent user facts
            facts_rows = conn.execute(
                "SELECT fact, category FROM user_facts WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
                (user_id,)
            ).fetchall()

            # Layer 2: Past session summaries (last 5 completed sessions)
            past_rows = conn.execute("""
                SELECT id, ended_at, metadata
                FROM sessions
                WHERE user_id = ? AND ended_at IS NOT NULL
                ORDER BY ended_at DESC LIMIT 5
            """, (user_id,)).fetchall()

            summaries = []
            latest_session_id = None
            for row in past_rows:
                meta = json.loads(row["metadata"]) if row["metadata"] else {}
                summary = meta.get("summary", "")
                intent = meta.get("intent", "")
                if summary and summary != "No meaningful conversation occurred.":
                    summaries.append({
                        "summary": summary,
                        "intent": intent,
                        "ended_at": row["ended_at"],
                    })
                if latest_session_id is None:
                    latest_session_id = row["id"]

            # Layer 3: Last 8 turns from most recent prior session
            recent_turns = []
            if latest_session_id:
                turn_rows = conn.execute("""
                    SELECT role, content FROM conversation_logs
                    WHERE session_id = ? AND role IN ('user', 'assistant')
                    ORDER BY timestamp DESC LIMIT 8
                """, (latest_session_id,)).fetchall()
                recent_turns = list(reversed([dict(r) for r in turn_rows]))

            return {
                "facts": [dict(r) for r in facts_rows],
                "past_summaries": summaries,
                "recent_turns": recent_turns,
            }
        return await self._run(_do)

    # ─── Knowledge Base ───────────────────────────────────────────────────────

    async def search_knowledge(
        self,
        query: str,
        bot_id: Optional[str] = None,
        limit: int = 3,
        data_access: Optional[dict] = None,
    ) -> list[dict]:
        """
        Full-text search in the knowledge base.
        Searches across topic, question, answer, and keywords.
        Optional data_access: max_kb_hits, knowledge_topic_allowlist, knowledge_source_allowlist.
        """
        da = data_access or {}
        try:
            cap = int(da.get("max_kb_hits", da.get("max_rows", limit)))
            limit = max(1, min(limit, cap))
        except (TypeError, ValueError):
            pass
            
        topic_allow = da.get("knowledge_topic_allowlist")
        if isinstance(topic_allow, list) and topic_allow:
            topic_allow = [str(t) for t in topic_allow if t]
        else:
            topic_allow = None

        source_allow = da.get("knowledge_source_allowlist")
        if isinstance(source_allow, list) and source_allow:
            source_allow = [str(s) for s in source_allow if s]
        else:
            source_allow = None

        def _do():
            conn = self._get_conn()
            q = f"%{query.lower()}%"
            
            # Base conditions
            conditions = ["(lower(topic) LIKE ? OR lower(question) LIKE ? OR lower(answer) LIKE ? OR lower(keywords) LIKE ?)"]
            params = [q, q, q, q]
            
            # Bot ID grouping
            if bot_id:
                conditions.append("(bot_id = ? OR bot_id IS NULL)")
                params.append(bot_id)
            
            # Topic Filter
            if topic_allow:
                ph = ",".join("?" * len(topic_allow))
                conditions.append(f"topic IN ({ph})")
                params.extend(topic_allow)
                
            # Source (Filename) Filter
            if source_allow:
                ph = ",".join("?" * len(source_allow))
                conditions.append(f"source IN ({ph})")
                params.extend(source_allow)
                
            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT topic, source, question, answer, priority 
                FROM knowledge_base
                WHERE {where_clause}
                ORDER BY priority DESC, id LIMIT ?
            """
            params.append(limit)
            
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]
            
        return await self._run(_do)

    async def add_knowledge(self, topic: str, question: str, answer: str,
                             keywords: Optional[list] = None, bot_id: Optional[str] = None,
                             priority: int = 0, owner_user_id: Optional[str] = None,source: Optional[str] = None) -> None:
        """Add a knowledge base entry."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO knowledge_base (bot_id, owner_user_id, topic,source, question, answer, keywords, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (bot_id, owner_user_id, topic,source, question, answer, json.dumps(keywords or []), priority))
            conn.commit()
        await self._run(_do)

    # ─── Analytics ────────────────────────────────────────────────────────────
    async def get_dashboard_analytics(self, owner_user_id: Optional[str] = None) -> dict:
        """Calculate and return key metrics for the dashboard overview."""
        def _do():
            conn = self._get_conn()

            if owner_user_id:
                total_sessions = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE user_id = ?",
                    (owner_user_id,),
                ).fetchone()[0]
                active_bots = conn.execute(
                    "SELECT COUNT(*) FROM bots WHERE is_active = 1 AND owner_user_id = ?",
                    (owner_user_id,),
                ).fetchone()[0]
                avg_duration = conn.execute(
                    "SELECT AVG(ended_at - started_at) FROM sessions WHERE ended_at IS NOT NULL AND user_id = ?",
                    (owner_user_id,),
                ).fetchone()[0] or 0
                successful_sessions = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE turn_count > 2 AND user_id = ?",
                    (owner_user_id,),
                ).fetchone()[0]
            else:
                # 1. Total Sessions
                total_sessions = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
                # 2. Active Bots
                active_bots = conn.execute("SELECT COUNT(*) FROM bots WHERE is_active = 1").fetchone()[0]
                # 3. Average Session Duration
                avg_duration = conn.execute("SELECT AVG(ended_at - started_at) FROM sessions WHERE ended_at IS NOT NULL").fetchone()[0] or 0
                # 4. Success Rate
                successful_sessions = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count > 2").fetchone()[0]
            success_rate = (successful_sessions / total_sessions * 100) if total_sessions > 0 else 0
            
            # 5. Bot Usage Distribution
            if owner_user_id:
                bot_usage = conn.execute("""
                    SELECT b.name, COUNT(s.id) as count
                    FROM bots b LEFT JOIN sessions s ON b.id = s.bot_id AND s.user_id = ?
                    WHERE b.is_active = 1 AND b.owner_user_id = ?
                    GROUP BY b.id
                """, (owner_user_id, owner_user_id)).fetchall()
            else:
                bot_usage = conn.execute("""
                    SELECT b.name, COUNT(s.id) as count
                    FROM bots b LEFT JOIN sessions s ON b.id = s.bot_id
                    WHERE b.is_active = 1
                    GROUP BY b.id
                """).fetchall()
            usage_data = [{"name": r["name"], "value": r["count"]} for r in bot_usage]
            
            # 6. Peak Hours (last 24h by hour)
            if owner_user_id:
                peak_hours = conn.execute("""
                    SELECT strftime('%H', datetime(started_at, 'unixepoch')) as hour, COUNT(*) as count
                    FROM sessions
                    WHERE started_at > strftime('%s', 'now', '-1 day') AND user_id = ?
                    GROUP BY hour
                    ORDER BY hour
                """, (owner_user_id,)).fetchall()
            else:
                peak_hours = conn.execute("""
                    SELECT strftime('%H', datetime(started_at, 'unixepoch')) as hour, COUNT(*) as count
                    FROM sessions
                    WHERE started_at > strftime('%s', 'now', 'start of day')
                    GROUP BY hour
                    ORDER BY hour
                """).fetchall()
            hour_data = [{"hour": r["hour"] + ":00", "sessions": r["count"]} for r in peak_hours]
            
            # 7. Session History (last 8 days)
            if owner_user_id:
                history = conn.execute("""
                    SELECT strftime('%m-%d', datetime(started_at, 'unixepoch')) as day, COUNT(*) as count
                    FROM sessions
                    WHERE started_at > strftime('%s', 'now', '-8 days') AND user_id = ?
                    GROUP BY day
                    ORDER BY day
                """, (owner_user_id,)).fetchall()
            else:
                history = conn.execute("""
                    SELECT strftime('%m-%d', datetime(started_at, 'unixepoch')) as day, COUNT(*) as count
                    FROM sessions
                    WHERE started_at > strftime('%s', 'now', '-8 days')
                    GROUP BY day
                    ORDER BY day
                """).fetchall()
            history_data = [{"name": r["day"], "value": r["count"]} for r in history]
            
            # 8. Tool Usage Breakdown (with Bot Context)
            if owner_user_id:
                tool_usage = conn.execute("""
                    SELECT 
                        CASE 
                            WHEN tl.tool_name = 'search_knowledge' THEN 'Knowledge (' || b.name || ')'
                            ELSE tl.tool_name 
                        END as display_name,
                        COUNT(*) as count
                    FROM tool_logs tl
                    JOIN sessions s ON tl.session_id = s.id
                    JOIN bots b ON s.bot_id = b.id
                    WHERE tl.tool_name != '__metrics__' AND s.user_id = ?
                    GROUP BY display_name
                    ORDER BY count DESC
                """, (owner_user_id,)).fetchall()
            else:
                tool_usage = conn.execute("""
                    SELECT 
                        CASE 
                            WHEN tl.tool_name = 'search_knowledge' THEN 'Knowledge (' || b.name || ')'
                            ELSE tl.tool_name 
                        END as display_name,
                        COUNT(*) as count
                    FROM tool_logs tl
                    JOIN sessions s ON tl.session_id = s.id
                    JOIN bots b ON s.bot_id = b.id
                    WHERE tl.tool_name != '__metrics__'
                    GROUP BY display_name
                    ORDER BY count DESC
                """).fetchall()
            tool_data = [{"name": r["display_name"], "count": r["count"]} for r in tool_usage]
            
            # 9. Per-Bot Success Rate
            if owner_user_id:
                bot_performance = conn.execute("""
                    SELECT b.name, 
                           COUNT(s.id) as total,
                           SUM(CASE WHEN s.turn_count > 2 THEN 1 ELSE 0 END) as success
                    FROM bots b JOIN sessions s ON b.id = s.bot_id
                    WHERE b.is_active = 1 AND b.owner_user_id = ?
                    GROUP BY b.id
                    HAVING total > 0
                    ORDER BY total DESC
                    LIMIT 3
                """, (owner_user_id,)).fetchall()
            else:
                bot_performance = conn.execute("""
                    SELECT b.name, 
                           COUNT(s.id) as total,
                           SUM(CASE WHEN s.turn_count > 2 THEN 1 ELSE 0 END) as success
                    FROM bots b JOIN sessions s ON b.id = s.bot_id
                    WHERE b.is_active = 1
                    GROUP BY b.id
                    HAVING total > 0
                    ORDER BY total DESC
                    LIMIT 3
                """).fetchall()
            
            perf_data = [
                {"name": r["name"], "rate": int((r["success"] / r["total"]) * 100)} 
                for r in bot_performance
            ]
            
            # 10. Call Duration Distribution
            duration_bins = [
                {"range": "< 1m", "max": 60, "min": 0},
                {"range": "1-3m", "max": 180, "min": 60},
                {"range": "3-5m", "max": 300, "min": 180},
                {"range": "> 5m", "max": 999999, "min": 300},
            ]
            duration_data = []
            for bin in duration_bins:
                if owner_user_id:
                    count = conn.execute("""
                        SELECT COUNT(*) FROM sessions 
                        WHERE ended_at IS NOT NULL AND (ended_at - started_at) >= ? AND (ended_at - started_at) < ? AND user_id = ?
                    """, (bin["min"], bin["max"], owner_user_id)).fetchone()[0]
                else:
                    count = conn.execute("""
                        SELECT COUNT(*) FROM sessions 
                        WHERE ended_at IS NOT NULL AND (ended_at - started_at) >= ? AND (ended_at - started_at) < ?
                    """, (bin["min"], bin["max"])).fetchone()[0]
                duration_data.append({"range": bin["range"], "count": count})
            
            # 11. KPI: Average Latency (from __metrics__ tool logs)
            if owner_user_id:
                avg_lat_row = conn.execute("""
                    SELECT AVG(json_extract(arguments, '$.total_ms')) as avg_lat
                    FROM tool_logs tl JOIN sessions s ON tl.session_id = s.id
                    WHERE tl.tool_name = '__metrics__' AND s.user_id = ?
                """, (owner_user_id,)).fetchone()
            else:
                avg_lat_row = conn.execute("""
                    SELECT AVG(json_extract(arguments, '$.total_ms')) as avg_lat
                    FROM tool_logs
                    WHERE tool_name = '__metrics__'
                """).fetchone()
            avg_latency_ms = avg_lat_row["avg_lat"] if avg_lat_row and avg_lat_row["avg_lat"] else 0

            # 12. KPI: Total Tokens (from session metadata)
            if owner_user_id:
                tokens_row = conn.execute("""
                    SELECT SUM(json_extract(metadata, '$.tokens_total')) as total
                    FROM sessions
                    WHERE metadata IS NOT NULL AND user_id = ?
                """, (owner_user_id,)).fetchone()
            else:
                tokens_row = conn.execute("""
                    SELECT SUM(json_extract(metadata, '$.tokens_total')) as total
                    FROM sessions
                    WHERE metadata IS NOT NULL
                """).fetchone()
            total_tokens = tokens_row["total"] if tokens_row and tokens_row["total"] else 0
            
            # 7. Sentiment — Calculated from session engagement (heuristic)
            if owner_user_id:
                pos = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count > 5 AND user_id = ?", (owner_user_id,)).fetchone()[0]
                neu = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count BETWEEN 2 AND 5 AND user_id = ?", (owner_user_id,)).fetchone()[0]
                neg = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count <= 1 AND user_id = ?", (owner_user_id,)).fetchone()[0]
            else:
                pos = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count > 5").fetchone()[0]
                neu = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count BETWEEN 2 AND 5").fetchone()[0]
                neg = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count <= 1").fetchone()[0]
            
            total_sent = max(pos + neu + neg, 1)
            sentiment = {
                "positive": int((pos / total_sent) * 100),
                "neutral": int((neu / total_sent) * 100),
                "negative": int((neg / total_sent) * 100),
                "note": "Based on engagement"
            }

            return {
                "metrics": {
                    "totalSessions": total_sessions,
                    "activeBots": active_bots,
                    "avgLatency": f"{int(avg_latency_ms)}ms" if avg_latency_ms else "—",
                    "totalTokens": f"{int(total_tokens / 1000)}k" if total_tokens > 1000 else str(int(total_tokens)),
                    "successRate": f"{int(success_rate)}%",
                    "avgDuration": f"{int(avg_duration)}s" if avg_duration else "—",
                },
                "botUsage": usage_data,
                "peakHours": hour_data,
                "sessionHistory": history_data,
                "toolUsage": tool_data,
                "botPerformance": perf_data,
                "durationDistribution": duration_data,
                "sentiment": sentiment,
            }
        return await self._run(_do)

    async def list_knowledge(self, limit: int = 100) -> list[dict]:
        """List all knowledge base entries."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("SELECT * FROM knowledge_base ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def delete_knowledge(self, entry_id: int) -> bool:
        """Delete a knowledge base entry."""
        def _do():
            conn = self._get_conn()
            conn.execute("DELETE FROM knowledge_base WHERE id = ?", (entry_id,))
            conn.commit()
            return True
        return await self._run(_do)

    # ─── Tool Logging ─────────────────────────────────────────────────────────

    async def log_turn_metrics(
        self,
        session_id: str,
        stt_ms: float = 0.0,
        llm_ms: float = 0.0,
        tts_ms: float = 0.0,
        total_ms: float = 0.0,
        first_audio_ms: float = 0.0,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        sentiment_score: float = 0.0,
        interrupt_type: str = "clean",
    ) -> None:
        """Persist per-turn pipeline latency and token metrics."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO tool_logs (session_id, tool_name, arguments, result, is_error)
                VALUES (?, '__metrics__', ?, '', 0)
            """, (session_id, json.dumps({
                "stt_ms": round(stt_ms, 1),
                "llm_ms": round(llm_ms, 1),
                "tts_ms": round(tts_ms, 1),
                "total_ms": round(total_ms, 1),
                "first_audio_ms": round(first_audio_ms, 1),
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "sentiment_score": round(sentiment_score, 2),
                "interrupt_type": interrupt_type
            })))
            conn.commit()
        await self._run(_do)

    async def get_bot_usage(self, bot_id: str) -> dict:
        """Aggregate lifetime token usage for a specific bot."""
        def _do():
            conn = self._get_conn()
            # We join sessions and tool_logs to find metrics for this bot
            cursor = conn.execute("""
                SELECT t.arguments 
                FROM tool_logs t
                JOIN sessions s ON t.session_id = s.id
                WHERE s.bot_id = ? AND t.tool_name = '__metrics__'
            """, (bot_id,))
            
            total_prompt = 0
            total_completion = 0
            for row in cursor:
                try:
                    metrics = json.loads(row[0])
                    total_prompt += metrics.get("prompt_tokens", 0)
                    total_completion += metrics.get("completion_tokens", 0)
                except Exception:
                    continue
            
            return {
                "prompt_tokens": total_prompt,
                "completion_tokens": total_completion,
                "total_tokens": total_prompt + total_completion
            }
        return await self._run(_do)

    async def log_tool_call(self, session_id: str, tool_name: str,
                             arguments: dict, result: str, is_error: bool = False) -> None:
        """Log a tool execution for audit."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO tool_logs (session_id, tool_name, arguments, result, is_error)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, tool_name, json.dumps(arguments), result, int(is_error)))
            conn.commit()
        await self._run(_do)

    # ─── Workflow / Session Delete ───────────────────────────────────────────

    async def delete_workflow(self, workflow_id: str) -> bool:
        """Hard-delete a workflow by ID."""
        def _do():
            conn = self._get_conn()
            # Unlink any bots currently using this workflow
            conn.execute("UPDATE bots SET workflow_id = NULL WHERE workflow_id = ?", (workflow_id,))
            conn.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
            conn.commit()
            return True
        return await self._run(_do)

    async def delete_session(self, session_id: str) -> bool:
        """Hard-delete a session and all its associated rows."""
        def _do():
            conn = self._get_conn()
            for table in ("session_feedback", "tool_logs", "user_facts", "conversation_logs"):
                conn.execute(f"DELETE FROM {table} WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return True
        return await self._run(_do)

    # ─── Session Feedback ─────────────────────────────────────────────────────

    async def save_session_feedback(
        self,
        session_id: str,
        outcome: str,
        csat_score: int,
        notes: Optional[str] = None,
    ) -> dict:
        """Save CSAT feedback for a session."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO session_feedback (session_id, outcome, csat_score, notes)
                VALUES (?, ?, ?, ?)
            """, (session_id, outcome, csat_score, notes))
            conn.commit()
            row = conn.execute(
                "SELECT * FROM session_feedback WHERE session_id = ? ORDER BY id DESC LIMIT 1",
                (session_id,)
            ).fetchone()
            return dict(row) if row else {}
        return await self._run(_do)

    async def get_session_feedback(self, session_id: str) -> Optional[dict]:
        """Get stored CSAT feedback for a session."""
        def _do():
            conn = self._get_conn()
            row = conn.execute(
                "SELECT * FROM session_feedback WHERE session_id = ? ORDER BY id DESC LIMIT 1",
                (session_id,)
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)

    # ─── Session Facts ────────────────────────────────────────────────────────

    async def get_session_facts(self, session_id: str) -> list[dict]:
        """Return user_facts rows associated with a session."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute(
                "SELECT * FROM user_facts WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,)
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    # ─── Analytics ───────────────────────────────────────────────────────────

    async def get_latency_analytics(self, limit: int = 30, owner_user_id: Optional[str] = None) -> list[dict]:
        """Return per-session average latency metrics from the last N sessions."""
        def _do():
            conn = self._get_conn()
            if owner_user_id:
                rows = conn.execute("""
                    SELECT
                        t.session_id,
                        AVG(json_extract(t.arguments, '$.stt_ms'))      AS stt_ms,
                        AVG(json_extract(t.arguments, '$.llm_ms'))      AS llm_ms,
                        AVG(json_extract(t.arguments, '$.tts_ms'))      AS tts_ms,
                        AVG(json_extract(t.arguments, '$.total_ms'))    AS total_ms,
                        AVG(json_extract(t.arguments, '$.first_audio_ms')) AS first_audio_ms
                    FROM tool_logs t
                    JOIN sessions s ON s.id = t.session_id
                    WHERE t.tool_name = '__metrics__' AND s.user_id = ?
                    GROUP BY t.session_id
                    ORDER BY MAX(t.executed_at) DESC
                    LIMIT ?
                """, (owner_user_id, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT
                        t.session_id,
                        AVG(json_extract(t.arguments, '$.stt_ms'))      AS stt_ms,
                        AVG(json_extract(t.arguments, '$.llm_ms'))      AS llm_ms,
                        AVG(json_extract(t.arguments, '$.tts_ms'))      AS tts_ms,
                        AVG(json_extract(t.arguments, '$.total_ms'))    AS total_ms,
                        AVG(json_extract(t.arguments, '$.first_audio_ms')) AS first_audio_ms
                    FROM tool_logs t
                    WHERE t.tool_name = '__metrics__'
                    GROUP BY t.session_id
                    ORDER BY MAX(t.executed_at) DESC
                    LIMIT ?
                """, (limit,)).fetchall()
            return [
                {
                    "session_id": r["session_id"],
                    "stt_ms": round(r["stt_ms"] or 0, 1),
                    "llm_ms": round(r["llm_ms"] or 0, 1),
                    "tts_ms": round(r["tts_ms"] or 0, 1),
                    "total_ms": round(r["total_ms"] or 0, 1),
                    "first_audio_ms": round(r["first_audio_ms"] or 0, 1),
                }
                for r in rows
            ]
        return await self._run(_do)

    async def get_intent_analytics(self, limit: int = 100, owner_user_id: Optional[str] = None) -> list[dict]:
        """Return intent distribution from recent sessions."""
        def _do():
            conn = self._get_conn()
            if owner_user_id:
                rows = conn.execute("""
                    SELECT
                        json_extract(metadata, '$.intent') AS intent,
                        COUNT(*) AS count
                    FROM sessions
                    WHERE metadata IS NOT NULL
                      AND json_extract(metadata, '$.intent') IS NOT NULL
                      AND user_id = ?
                    GROUP BY intent
                    ORDER BY count DESC
                    LIMIT ?
                """, (owner_user_id, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT
                        json_extract(metadata, '$.intent') AS intent,
                        COUNT(*) AS count
                    FROM sessions
                    WHERE metadata IS NOT NULL
                      AND json_extract(metadata, '$.intent') IS NOT NULL
                    GROUP BY intent
                    ORDER BY count DESC
                    LIMIT ?
                """, (limit,)).fetchall()
            return [{"intent": r["intent"], "count": r["count"]} for r in rows]
        return await self._run(_do)

    # ─── Banking Tools ────────────────────────────────────────────────────────

    async def verify_customer(self, account_number: str, dob: str, phone_last_4: str) -> Optional[dict]:
        """Verify a customer by account number, date of birth, and last 4 digits of phone."""
        def _do():
            conn = self._get_conn()
            row = conn.execute(
                """SELECT id, account_number, customer_name, balance, account_type
                   FROM customer_accounts
                   WHERE account_number = ? AND dob = ? AND substr(phone, -4) = ? AND is_active = 1""",
                (account_number.upper().strip(), dob.strip(), phone_last_4.strip()),
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)

    async def get_account_balance(self, account_number: str) -> Optional[dict]:
        """Return balance and account info for an account number."""
        def _do():
            conn = self._get_conn()
            row = conn.execute(
                """SELECT account_number, customer_name, balance, account_type
                   FROM customer_accounts
                   WHERE account_number = ? AND is_active = 1""",
                (account_number.upper().strip(),),
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)

    async def get_loan_details(self, account_number: str) -> list:
        """Return all active loans for an account number."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute(
                """SELECT loan_type, principal, outstanding, emi_amount,
                          emi_due_date, next_due, status
                   FROM loans
                   WHERE account_number = ?
                   ORDER BY next_due ASC""",
                (account_number.upper().strip(),),
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def upsert_customer(self, account_number: str, customer_name: str, dob: str,
                               balance: float, account_type: str = "savings",
                               phone: str = "", email: str = "") -> None:
        """Insert or replace a customer account row (used by seed script)."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO customer_accounts
                       (account_number, customer_name, dob, phone, email, balance, account_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(account_number) DO UPDATE SET
                       customer_name = excluded.customer_name,
                       dob           = excluded.dob,
                       phone         = excluded.phone,
                       email         = excluded.email,
                       balance       = excluded.balance,
                       account_type  = excluded.account_type""",
                (account_number.upper().strip(), customer_name, dob, phone, email, balance, account_type),
            )
            conn.commit()
        return await self._run(_do)

    async def upsert_loan(self, account_number: str, loan_type: str, principal: float,
                           outstanding: float, emi_amount: float, emi_due_date: str,
                           next_due: str, status: str = "active") -> None:
        """Insert a loan row (used by seed script)."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO loans
                       (account_number, loan_type, principal, outstanding,
                        emi_amount, emi_due_date, next_due, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (account_number.upper().strip(), loan_type, principal, outstanding,
                 emi_amount, emi_due_date, next_due, status),
            )
            conn.commit()
        return await self._run(_do)

    async def get_customer(self, account_number: str) -> Optional[dict]:
        """Fetch a single customer record by account number."""
        def _do():
            conn = self._get_conn()
            row = conn.execute(
                "SELECT * FROM customer_accounts WHERE account_number = ?",
                (account_number.upper().strip(),)
            ).fetchone()
            return dict(row) if row else None
        return await self._run(_do)
    
    async def get_customer_schema(self) -> list[dict]:
        """Return the current columns and types of the customer_accounts table."""
        def _do():
            conn = self._get_conn()
            cursor = conn.execute("PRAGMA table_info(customer_accounts)")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def add_customer_column(self, name: str, data_type: str = "TEXT") -> tuple[bool, str]:
        """
        Dynamically add a new column to the customer_accounts table.
        Returns (success, message).
        """
        # 1. Auto-correction: Replace spaces/hyphens with underscores, lowercase everything
        clean_name = name.strip().replace(" ", "_").replace("-", "_").lower()
        
        # 2. Strict Validation: Alphanumeric and underscores only
        if not clean_name:
            return False, "Column name cannot be empty"
            
        if not clean_name[0].isalpha() and clean_name[0] != "_":
            return False, "Column name must start with a letter or underscore"
            
        if not all(c.isalnum() or c == "_" for c in clean_name):
            return False, "Column name can only contain letters, numbers, and underscores"

        # Valid SQLite types
        valid_types = {"TEXT", "INTEGER", "REAL", "BLOB", "NUMERIC"}
        clean_type = data_type.upper() if data_type.upper() in valid_types else "TEXT"
        
        def _do():
            conn = self._get_conn()
            try:
                conn.execute(f"ALTER TABLE customer_accounts ADD COLUMN {clean_name} {clean_type}")
                conn.commit()
                return True, f"Column '{clean_name}' added successfully"
            except sqlite3.OperationalError as e:
                error_str = str(e).lower()
                if "duplicate column name" in error_str:
                    return False, f"Column '{clean_name}' already exists"
                return False, f"Database error: {str(e)}"
        return await self._run(_do)

    async def list_customers_dynamic(self, limit: int = 200) -> list[dict]:
        """Fetch all customer records with all columns dynamically."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute(f"SELECT * FROM customer_accounts ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def upsert_customer_dynamic(self, data: dict[str, Any]) -> str:
        """Upsert a customer record using all provided keys as columns."""
        if not data.get("account_number"):
            raise ValueError("account_number is required for dynamic upsert")
        
        account_number = data["account_number"].upper().strip()
        
        def _do():
            conn = self._get_conn()
            # 1. Get current columns
            cursor = conn.execute("PRAGMA table_info(customer_accounts)")
            columns = {r["name"] for r in cursor.fetchall()}
            
            # 2. Filter data for only valid columns
            valid_data = {k: v for k, v in data.items() if k in columns}
            valid_data["account_number"] = account_number
            
            keys = list(valid_data.keys())
            placeholders = ", ".join(["?" for _ in keys])
            cols_clause = ", ".join(keys)
            
            # 3. Handle conflict (Update everything except account_number)
            update_clause = ", ".join([f"{k} = excluded.{k}" for k in keys if k != "account_number"])
            
            sql = f"""
                INSERT INTO customer_accounts ({cols_clause})
                VALUES ({placeholders})
                ON CONFLICT(account_number) DO UPDATE SET
                    {update_clause}
            """
            conn.execute(sql, list(valid_data.values()))
            conn.commit()
            return account_number
        return await self._run(_do)

    async def delete_customer(self, account_number: str) -> bool:
        """Delete a customer record by account number."""
        def _do():
            conn = self._get_conn()
            conn.execute("DELETE FROM customer_accounts WHERE account_number = ?", (account_number,))
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    # ─── Cleanup ─────────────────────────────────────────────────────────────
    async def update_customer_metadata(self, account_number: str, metadata: dict) -> bool:
        """Update the test_meta_data JSON for a customer."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                "UPDATE customer_accounts SET test_meta_data = ? WHERE account_number = ?",
                (json.dumps(metadata), account_number.upper().strip())
            )
            conn.commit()
            return True
        return await self._run(_do)

    async def save_learned_affinity(self, intent: str, pattern: str, is_verified: bool = False) -> bool:
        """Save a new learned intent pattern (UPSERT)."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO learned_affinities (intent_label, pattern, is_verified)
                VALUES (?, ?, ?)
                ON CONFLICT(pattern) DO UPDATE SET
                    intent_label = excluded.intent_label,
                    is_verified = MAX(is_verified, excluded.is_verified)
            """, (intent, pattern, 1 if is_verified else 0))
            conn.commit()
            return True
        return await self._run(_do)

    async def list_learned_affinities(self, intent_label: Optional[str] = None) -> list[dict]:
        """Fetch all learned patterns, optionally filtered by intent."""
        def _do():
            conn = self._get_conn()
            if intent_label:
                rows = conn.execute(
                    "SELECT * FROM learned_affinities WHERE intent_label = ? ORDER BY hit_count DESC",
                    (intent_label,)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM learned_affinities ORDER BY hit_count DESC"
                ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def increment_affinity_hit(self, pattern: str) -> bool:
        """Increment the usage counter for a learned pattern."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                "UPDATE learned_affinities SET hit_count = hit_count + 1 WHERE pattern = ?",
                (pattern,)
            )
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def close(self) -> None:

        """Close the connection pool."""
        if self._conn:
            self._conn.close()
            self._conn = None
        self._executor.shutdown(wait=False)
        logger.info("SQLite provider closed")

    # ─── 🧠 AI Persona Builder CRUD ───────────────────────────────────────────

    async def create_ai_persona(self, data: dict) -> dict:
        """Create a new AI Persona in the registry."""
        def _do():
            conn = self._get_conn()
            persona_id = str(uuid.uuid4())[:16]
            conn.execute(
                """
                INSERT INTO aiPersonas (
                    id, name, gender, language, tone, use_case, psychology,
                    emotion, urgency, empathy, stability, clarity,
                    style_exaggeration, base_model, selected_voice, theme_color
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    persona_id,
                    data.get("name", "Unnamed"),
                    data.get("gender", "Female"),
                    data.get("language", "English"),
                    data.get("tone", ""),
                    data.get("useCase", data.get("use_case", "")),
                    data.get("psychology", ""),
                    data.get("emotion", "Empathetic"),
                    float(data.get("urgency", 45)),
                    float(data.get("empathy", 75)),
                    float(data.get("stability", 80)),
                    float(data.get("clarity", 60)),
                    float(data.get("styleExaggeration", data.get("style_exaggeration", 35))),
                    data.get("baseModel", data.get("base_model", "Sonix-Flash-1")),
                    data.get("selectedVoice", data.get("selected_voice", "v1")),
                    data.get("themeColor", data.get("theme_color", "blue")),
                ),
            )
            conn.commit()
            return {"id": persona_id, **data}
        return await self._run(_do)

    async def get_ai_persona(self, persona_id: str) -> Optional[dict]:
        """Retrieve a single AI Persona by ID."""
        def _do():
            row = self._get_conn().execute(
                "SELECT * FROM aiPersonas WHERE id = ?", (persona_id,)
            ).fetchone()
            return _persona_row_to_dict(row) if row else None
        return await self._run(_do)

    async def list_ai_personas(self) -> list[dict]:
        """List all AI Personas ordered by creation date."""
        def _do():
            rows = self._get_conn().execute(
                "SELECT * FROM aiPersonas ORDER BY created_at DESC"
            ).fetchall()
            return [_persona_row_to_dict(r) for r in rows]
        return await self._run(_do)

    async def update_ai_persona(self, persona_id: str, data: dict) -> bool:
        """Update fields on an existing AI Persona."""
        field_map = {
            "name": "name",
            "gender": "gender",
            "language": "language",
            "tone": "tone",
            "useCase": "use_case",
            "use_case": "use_case",
            "psychology": "psychology",
            "emotion": "emotion",
            "urgency": "urgency",
            "empathy": "empathy",
            "stability": "stability",
            "clarity": "clarity",
            "styleExaggeration": "style_exaggeration",
            "style_exaggeration": "style_exaggeration",
            "baseModel": "base_model",
            "base_model": "base_model",
            "selectedVoice": "selected_voice",
            "selected_voice": "selected_voice",
            "is_active": "is_active",
            "is_deployed": "is_deployed",
            "themeColor": "theme_color",
            "theme_color": "theme_color",
        }
        def _do():
            conn = self._get_conn()
            updates = {}
            for k, v in data.items():
                col = field_map.get(k)
                if col:
                    updates[col] = v
            if not updates:
                return False
            updates["updated_at"] = time.time()
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [persona_id]
            conn.execute(f"UPDATE aiPersonas SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def delete_ai_persona(self, persona_id: str) -> bool:
        """Permanently delete an AI Persona."""
        def _do():
            conn = self._get_conn()
            conn.execute("DELETE FROM aiPersonas WHERE id = ?", (persona_id,))
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
        return await self._run(_do)

    async def toggle_ai_persona_deployment(self, persona_id: str) -> Optional[dict]:
        """Toggle the is_deployed flag on a persona. Returns updated persona."""
        def _do():
            conn = self._get_conn()
            conn.execute(
                """
                UPDATE aiPersonas
                SET is_deployed = CASE WHEN is_deployed = 1 THEN 0 ELSE 1 END,
                    updated_at  = strftime('%s','now')
                WHERE id = ?
                """,
                (persona_id,),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM aiPersonas WHERE id = ?", (persona_id,)).fetchone()
            return _persona_row_to_dict(row) if row else None
        return await self._run(_do)


def _persona_row_to_dict(row) -> dict:
    """Convert a sqlite3.Row from aiPersonas to a clean camelCase dict for the API."""
    d = dict(row)
    return {
        "id":               d.get("id"),
        "name":             d.get("name"),
        "gender":           d.get("gender"),
        "language":         d.get("language"),
        "tone":             d.get("tone"),
        "useCase":          d.get("use_case"),
        "psychology":       d.get("psychology"),
        "emotion":          d.get("emotion"),
        "urgency":          d.get("urgency"),
        "empathy":          d.get("empathy"),
        "stability":        d.get("stability"),
        "clarity":          d.get("clarity"),
        "styleExaggeration": d.get("style_exaggeration"),
        "baseModel":        d.get("base_model"),
        "selectedVoice":    d.get("selected_voice"),
        "themeColor":       d.get("theme_color", "blue"),
        "isActive":         bool(d.get("is_active", 1)),
        "isDeployed":       bool(d.get("is_deployed", 0)),
        "createdAt":        d.get("created_at"),
        "updatedAt":        d.get("updated_at"),
    }


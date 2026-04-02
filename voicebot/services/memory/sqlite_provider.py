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
import json
import logging
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Optional
from concurrent.futures import ThreadPoolExecutor

from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.agent_task_spec import parse_agent_task_spec
from voicebot.shared.policy import parse_json_dict

logger = setup_logger("memory-sqlite", level="INFO")

# Default DB path — can be overridden by env var
DEFAULT_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "voicebot.db"


class SQLiteProvider:
    """
    Async-compatible SQLite provider using thread pool for blocking I/O.
    Provides full CRUD for all platform data.
    """

    def __init__(self, db_path: Optional[str] = None):
        self._db_path = Path(db_path or DEFAULT_DB_PATH)
        # Fix: SQLite connections are NOT thread-safe for concurrent operations. 
        # Using max_workers=1 ensures all DB tasks are serialized, preventing segmentation faults.
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="sqlite")
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
        """Execute a blocking function in the thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, lambda: fn(*args, **kwargs))

    # ─── Schema Initialization ────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Create all tables if they don't exist."""
        await self._run(self._create_tables)
        logger.info("SQLite DB initialized at %s", self._db_path)

    def _create_tables(self) -> None:
        conn = self._get_conn()
        
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
            ("first_segment_chars", "INTEGER DEFAULT 80"),        # First TTS flush char cap (fast-path)
            ("audio_frame_normalize", "INTEGER DEFAULT 1"),       # 1 = normalize to 20 ms frames
            ("default_language", "TEXT DEFAULT 'hi'"),
            ("proactive_prompts", "TEXT DEFAULT '[]'"),
            ("topic_restriction", "TEXT DEFAULT NULL"),
            ("refuse_off_topic", "INTEGER DEFAULT 0"),
        ]:
            try:
                conn.execute(f"ALTER TABLE bots ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    raise
        
        conn.commit()

        # 3. Create other tables (workflows must exist before 2b ALTER on legacy DBs)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS workflows (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                description  TEXT,
                nodes_json   TEXT DEFAULT '[]',
                edges_json   TEXT DEFAULT '[]',
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

            CREATE INDEX IF NOT EXISTS idx_sessions_bot_id ON sessions(bot_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_logs_session_id ON conversation_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_kb_bot_id ON knowledge_base(bot_id);
            CREATE INDEX IF NOT EXISTS idx_tool_logs_session ON tool_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_user_facts_user_id ON user_facts(user_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_session ON session_feedback(session_id);

            CREATE TABLE IF NOT EXISTS customer_accounts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_number  TEXT NOT NULL UNIQUE,
                customer_name   TEXT NOT NULL,
                dob             TEXT NOT NULL,
                phone           TEXT,
                email           TEXT,
                balance         REAL NOT NULL DEFAULT 0.0,
                account_type    TEXT DEFAULT 'savings',
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
        """)
        conn.commit()

        # 3b. Migrate legacy workflows rows missing columns (table exists from CREATE above)
        existing_workflow_cols = {row[1] for row in conn.execute("PRAGMA table_info(workflows)").fetchall()}
        if "is_active" not in existing_workflow_cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
        if "updated_at" not in existing_workflow_cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN updated_at REAL NOT NULL DEFAULT 0")
            conn.execute("UPDATE workflows SET updated_at = created_at WHERE updated_at = 0")
        conn.commit()

        self._seed_default_bots()

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
            "dropped, transferred, or restarted. Greet briefly, confirm you are ready to help, and "
            "keep replies short and clear. For business facts, use search_knowledge when appropriate. "
            "Do not invent policies or data you have not retrieved."
        )
        greeting = "Hi — I'm here to continue. What do you need help with?"
        description = (
            "Built-in fallback persona for call recovery and advanced handoff. No workflow binding; "
            "pure LLM + tools. Safe to use as default when bot_id is unknown."
        )
        conn.execute(
            """
            INSERT INTO bots (
                id, name, description, persona, system_prompt, greeting, tools_enabled,
                llm_model, voice_id, role, icon, color, temperature, max_tokens, workflow_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
                "aura-asteria-en",
                "Call recovery",
                "bot",
                "primary",
                0.6,
                1024,
            ),
        )
        conn.commit()
        logger.info("Seeded default bot: %s (%s)", name, bot_id)

    # ─── Bot Registry ─────────────────────────────────────────────────────────

    async def create_bot(self, name: str, persona: str, system_prompt: str,
                         description: str = "", greeting: Optional[str] = None,
                         tools_enabled: Optional[list] = None,
                         llm_model: str = "llama-3.3-70b-versatile",
                         voice_id: Optional[str] = None,
                         role: str = "AI Assistant",
                         icon: str = "bot",
                         color: str = "primary",
                         temperature: float = 0.7,
                         max_tokens: int = 2048, tts_provider: str = "deepgram_ws", default_language: str = "hi", proactive_prompts: Optional[list] = None,
                         topic_restriction: Optional[str] = None, refuse_off_topic: bool = False) -> dict:
        """Create a new bot configuration."""
        def _do():
            conn = self._get_conn()
            bot_id = str(uuid.uuid4())[:8]
            tools_json = json.dumps(tools_enabled or [])
            conn.execute("""
                INSERT INTO bots (id, name, description, persona, system_prompt, greeting, tools_enabled, llm_model, voice_id, role, icon, color, temperature, max_tokens, workflow_id, default_language, tts_provider, proactive_prompts, topic_restriction, refuse_off_topic)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (bot_id, name, description, persona, system_prompt, greeting, tools_json, llm_model, voice_id, role, icon, color, temperature, max_tokens, None, default_language, tts_provider, json.dumps(proactive_prompts or []), topic_restriction, 1 if refuse_off_topic else 0))
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
                return d
            return None
        return await self._run(_do)

    async def list_bots(self) -> list[dict]:
        """List all active bots."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("SELECT id, name, description, persona, role, icon, color, tools_enabled, llm_model, voice_id, temperature, max_tokens, is_active, created_at, topic_restriction, refuse_off_topic FROM bots WHERE is_active = 1 ORDER BY created_at").fetchall()
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
                "llm_model", "voice_id", "role", "icon", "color", "temperature", "max_tokens", "workflow_id",
                "guardrail_policy", "data_access_policy", "conversation_policy", "pipeline_mode",
                "agent_task_spec", "default_language", "tts_provider", "stt_endpointing_ms",
                "agent_task_spec", "default_language", "tts_provider", "stt_endpointing_ms",
                "stt_utterance_end_ms", "first_segment_chars", "audio_frame_normalize", "proactive_prompts",
                "topic_restriction", "refuse_off_topic",
            }
            updates = {k: v for k, v in fields.items() if k in allowed}
            if "tools_enabled" in updates and isinstance(updates["tools_enabled"], list):
                updates["tools_enabled"] = json.dumps(updates["tools_enabled"])
            if "proactive_prompts" in updates and isinstance(updates["proactive_prompts"], list):
                updates["proactive_prompts"] = json.dumps(updates["proactive_prompts"])
            if "refuse_off_topic" in updates:
                updates["refuse_off_topic"] = 1 if updates["refuse_off_topic"] else 0
            if "agent_task_spec" in updates and isinstance(updates["agent_task_spec"], dict):
                updates["agent_task_spec"] = json.dumps(updates["agent_task_spec"])
            for pol in ("guardrail_policy", "data_access_policy", "conversation_policy"):
                if pol in updates and isinstance(updates[pol], dict):
                    updates[pol] = json.dumps(updates[pol])
            updates["updated_at"] = time.time()
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [bot_id]
            conn.execute(f"UPDATE bots SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return conn.execute("SELECT changes()").fetchone()[0] > 0
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

    async def save_workflow(self, workflow_id: str, name: str, description: str, nodes: list, edges: list) -> None:
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
                             user_id: Optional[str] = None, language: str = "hi") -> None:
        """Register or update a session in SQLite."""
        def _do():
            conn = self._get_conn()
            # 1. Insert session record if it doesn't exist yet
            conn.execute("""
                INSERT OR IGNORE INTO sessions (id, bot_id, user_id, language, started_at)
                VALUES (?, ?, ?, ?, strftime('%s','now'))
            """, (session_id, bot_id, user_id, language))
            
            # 2. Update existing session fields (except started_at)
            conn.execute("""
                UPDATE sessions 
                SET bot_id = COALESCE(?, bot_id),
                    user_id = COALESCE(?, user_id),
                    language = ?
                WHERE id = ?
            """, (bot_id, user_id, language, session_id))
            
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
                return res
            return None
        return await self._run(_do)

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
        Optional data_access: max_kb_hits/max_rows, knowledge_topic_allowlist.
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

        def _do():
            conn = self._get_conn()
            q = f"%{query.lower()}%"
            if bot_id:
                if topic_allow:
                    ph = ",".join("?" * len(topic_allow))
                    rows = conn.execute(f"""
                        SELECT topic, question, answer, priority FROM knowledge_base
                        WHERE (bot_id = ? OR bot_id IS NULL)
                        AND topic IN ({ph})
                        AND (lower(topic) LIKE ? OR lower(question) LIKE ? OR lower(answer) LIKE ? OR lower(keywords) LIKE ?)
                        ORDER BY priority DESC, id LIMIT ?
                    """, (bot_id, *topic_allow, q, q, q, q, limit)).fetchall()
                else:
                    rows = conn.execute("""
                        SELECT topic, question, answer, priority FROM knowledge_base
                        WHERE (bot_id = ? OR bot_id IS NULL)
                        AND (lower(topic) LIKE ? OR lower(question) LIKE ? OR lower(answer) LIKE ? OR lower(keywords) LIKE ?)
                        ORDER BY priority DESC, id LIMIT ?
                    """, (bot_id, q, q, q, q, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT topic, question, answer, priority FROM knowledge_base
                    WHERE lower(topic) LIKE ? OR lower(question) LIKE ? OR lower(answer) LIKE ? OR lower(keywords) LIKE ?
                    ORDER BY priority DESC, id LIMIT ?
                """, (q, q, q, q, limit)).fetchall()
            return [dict(r) for r in rows]
        return await self._run(_do)

    async def add_knowledge(self, topic: str, question: str, answer: str,
                             keywords: Optional[list] = None, bot_id: Optional[str] = None,
                             priority: int = 0) -> None:
        """Add a knowledge base entry."""
        def _do():
            conn = self._get_conn()
            conn.execute("""
                INSERT INTO knowledge_base (bot_id, topic, question, answer, keywords, priority)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (bot_id, topic, question, answer, json.dumps(keywords or []), priority))
            conn.commit()
        await self._run(_do)

    # ─── Analytics ────────────────────────────────────────────────────────────
    async def get_dashboard_analytics(self) -> dict:
        """Calculate and return key metrics for the dashboard overview."""
        def _do():
            conn = self._get_conn()
            
            # 1. Total Sessions
            total_sessions = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            
            # 2. Active Bots
            active_bots = conn.execute("SELECT COUNT(*) FROM bots WHERE is_active = 1").fetchone()[0]
            
            # 3. Average Session Duration
            # Assuming sessions with ended_at > started_at
            avg_duration = conn.execute("SELECT AVG(ended_at - started_at) FROM sessions WHERE ended_at IS NOT NULL").fetchone()[0] or 0
            
            # 4. Success Rate (Mocking for now as sessions with > 2 turns)
            successful_sessions = conn.execute("SELECT COUNT(*) FROM sessions WHERE turn_count > 2").fetchone()[0]
            success_rate = (successful_sessions / total_sessions * 100) if total_sessions > 0 else 0
            
            # 5. Bot Usage Distribution
            bot_usage = conn.execute("""
                SELECT b.name, COUNT(s.id) as count
                FROM bots b LEFT JOIN sessions s ON b.id = s.bot_id
                WHERE b.is_active = 1
                GROUP BY b.id
            """).fetchall()
            usage_data = [{"name": r["name"], "value": r["count"]} for r in bot_usage]
            
            # 6. Peak Hours (last 24h by hour)
            # This is a bit complex for SQLite without a date table, but we can aggregate by strftime
            peak_hours = conn.execute("""
                SELECT strftime('%H', datetime(started_at, 'unixepoch')) as hour, COUNT(*) as count
                FROM sessions
                WHERE started_at > strftime('%s', 'now', '-1 day')
                GROUP BY hour
                ORDER BY hour
            """).fetchall()
            hour_data = [{"hour": r["hour"] + ":00", "sessions": r["count"]} for r in peak_hours]
            
            # 7. Sentiment — not computed from DB yet; UI can hide or show placeholder
            sentiment = {"positive": 0, "neutral": 0, "negative": 0, "note": "unavailable"}

            return {
                "metrics": {
                    "totalSessions": total_sessions,
                    "activeBots": active_bots,
                    "avgLatency": "—",
                    "successRate": f"{int(success_rate)}%",
                    "avgDuration": f"{int(avg_duration)}s" if avg_duration else "—",
                },
                "botUsage": usage_data,
                "peakHours": hour_data,
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
                "total_tokens": prompt_tokens + completion_tokens
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

    async def get_latency_analytics(self, limit: int = 30) -> list[dict]:
        """Return per-session average latency metrics from the last N sessions."""
        def _do():
            conn = self._get_conn()
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

    async def get_intent_analytics(self, limit: int = 100) -> list[dict]:
        """Return intent distribution from recent sessions."""
        def _do():
            conn = self._get_conn()
            rows = conn.execute("""
                SELECT
                    json_extract(metadata, '$.intent') AS intent,
                    COUNT(*) AS count
                FROM sessions
                WHERE metadata IS NOT NULL
                  AND json_extract(metadata, '$.intent') IS NOT NULL
                ORDER BY count DESC
                LIMIT ?
            """, (limit,)).fetchall()
            return [{"intent": r["intent"], "count": r["count"]} for r in rows]
        return await self._run(_do)

    # ─── Banking Tools ────────────────────────────────────────────────────────

    async def verify_customer(self, account_number: str, dob: str) -> Optional[dict]:
        """Verify a customer by account number and date of birth."""
        def _do():
            conn = self._get_conn()
            row = conn.execute(
                """SELECT account_number, customer_name, balance, account_type
                   FROM customer_accounts
                   WHERE account_number = ? AND dob = ? AND is_active = 1""",
                (account_number.upper().strip(), dob.strip()),
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

    # ─── Cleanup ─────────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the connection pool."""
        if self._conn:
            self._conn.close()
            self._conn = None
        self._executor.shutdown(wait=False)
        logger.info("SQLite provider closed")

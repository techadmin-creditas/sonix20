# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A production-grade real-time voice AI platform. Audio streams from browser → WebSocket → FastAPI backend → Deepgram STT → Groq/Gemini/OpenAI LLM → Deepgram/ElevenLabs TTS → browser, targeting sub-800ms end-to-end latency. Includes a React control plane UI (Obsidian Command) for bot/workflow/KB management.

---

## Commands

### Backend (Python)

```bash
# Activate virtualenv
source venv/bin/activate

# Start dev server
uvicorn voicebot.main:app --reload --host 0.0.0.0 --port 8000

# Seed banking test data (idempotent)
python3 scripts/seed_banking_db.py

# Smoke tests (server must be running)
python3 scripts/test_session.py
python3 scripts/test_websocket.py

# Ad-hoc real integration tests (no mocks)
python3 test_all_tools_real.py
python3 test_guardrail_features.py
```

### Frontend (Obsidian Command UI)

```bash
cd obsidian-command
npm install
npm run dev        # http://localhost:5173
npm run build
```

### LiveKit Agent (standalone mode)

```bash
python3 -m voicebot.livekit_agent
```

---

## Architecture

### Request Flow

```
Browser (PCM audio) → WS /ws/voice/{session_id}
  → WebSocketVoiceTransport (voicebot/core/transport/voice_transport.py)
  → DeepgramStreamingProvider (STT)
    → AgenticBrain.process_stt_partial() → barge-in detection
    → AgenticBrain.process_stt_final()  → turn completed
      → WorkflowEngine.process_turn()   → node-graph routing
      → AgenticBrain._run_llm_turn()    → LLM stream → TTS pipeline
        → _tts_queue_consumer()         → concurrent TTS dispatch
        → ElevenLabs / Deepgram WS TTS → PCM frames back to browser
```

### Key Files

| File | Role |
|---|---|
| `voicebot/main.py` | FastAPI app, WebSocket handler, session lifecycle, post-call archival |
| `voicebot/livekit_agent.py` | Standalone LiveKit room agent (alternative to WebSocket) |
| `voicebot/api/v1/routes.py` | All REST endpoints |
| `voicebot/core/orchestrator/brain.py` | **Primary file** — `AgenticBrain` state machine, all per-turn logic |
| `voicebot/core/orchestrator/workflow_engine.py` | Node-graph conversation flows (speech/logic/sentiment/action/backtrack nodes) |
| `voicebot/core/orchestrator/turn_detector.py` | End-of-turn heuristics, sentence boundary detection for TTS flushing |
| `voicebot/core/orchestrator/task_manager.py` | Speculative background task execution with confidence gating |
| `voicebot/services/memory/sqlite_provider.py` | All SQLite ops: bots, sessions, logs, KB, tools, banking data. Auto-migrates schema on startup. |
| `voicebot/services/tts/deepgram_ws_tts_provider.py` | Persistent WebSocket TTS, ~50ms TTFA, Speak+Flush+Reset protocol |
| `voicebot/shared/policy.py` | `guardrail_policy` and `data_access_policy` JSON parsing helpers |

### AgenticBrain State Machine

States: `IDLE → LISTENING → PROCESSING → SPEAKING → INTERRUPTED`

Critical design invariants:
- `_interrupt_event: asyncio.Event` — checked at every await point in `_run_llm_turn`
- `_active_tts_consumer_task` — stored reference for instant cancel on barge-in
- `handle_interruption()` cancels the consumer task immediately (don't wait for segment boundary)
- `_force_no_tools_this_turn` flag — set by loop detector, prevents tool calls for one iteration
- `full_response` is **always `""`** during streaming — text accumulates in `text_accumulated_whole_turn`

### conversation_policy Keys (stored per-bot in SQLite)

All latency-sensitive settings are read from `conversation_policy` JSON (not hardcoded):

```json
{
  "barge_in_grace_period_ms": 300,
  "barge_in_debounce_ms": 100,
  "ultra_first_segment_chars": 8,
  "first_segment_chars": 15,
  "max_tts_buffer_chars": 100,
  "tts_streaming_mode": "chunked",
  "llm_latency_watchdog_sec": 1.2,
  "topic_check_async": true
}
```

Read in `_apply_conversation_policy_derived()` — if you add a new policy key, register it there.

### Hallucination Defense Layers (brain.py)

```
Token stream
  → [L1] Suspicious-prefix hold (_held_prefix / _suspicious_prefix_length)
  → [L2] _guard_tts_segment / _strip_technical_artifacts  (per TTS flush)
  → [L3] _extract_hallucinated_tool_calls (post-stream, 8 formats)
  → [L4] _execute_tools dummy-value guard (string + numeric + account + date checks)
```

`_extract_hallucinated_tool_calls` supports: XML `<function=...>`, paren styles, markdown blocks, raw JSON objects, Python-style calls, bracket `[TOOL:]`, and natural language intent. All require the tool name to exist in `_tool_instances`.

### TTS Pipeline

- `use_pipeline = True` (default for `tts_streaming_mode=chunked`) → producer/consumer decoupled via `asyncio.Queue(maxsize=3)`
- Ultra-flush: fires TTS at first word boundary after `ultra_first_segment_chars` chars (default 8) — targets <300ms TTFS
- Deepgram WS TTS: persistent connection, `Reset` message drains queue and stops speech
- ElevenLabs: audio cached in Redis by MD5 hash of text

### Tool System

Tools are registered in `voicebot/core/tools/registry.py`. Custom (no-code) tools live in SQLite `custom_tools` table and are loaded into `_tool_instances` at session start via `_load_custom_tools()`. Tool parameters use JSON Schema; flat dicts are auto-repaired to proper schema format.

### Schema Migrations

`SQLiteProvider.initialize()` performs additive migrations automatically on server start using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. New columns should be added there — never require manual migration steps.

### WorkflowEngine Nodes

`speech` / `userInput` / `logic` / `sentiment` / `language` / `knowledge` / `action` / `backtrack` / `llm_fallback`. Two-stage global interceptor runs before every node. Backtrack support allows returning to prior nodes.

---

## Environment Variables

Minimum for local dev (`.env`):

```dotenv
DEEPGRAM_API_KEY=...
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
REDIS_URL=redis://localhost:6379/0
SQLITE_DB_PATH=./data/voicebot.db
```

Optional extras: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

---

## Docs

- `docs/ORCHESTRATOR.md` — Full reference for brain.py, turn_detector, workflow_engine, task_manager, STT/TTS providers
- `docs/ARCHITECTURE.md` — System architecture and data flow
- `docs/LIVE_TEST_GUIDE.md` — End-to-end banking bot test with seeded credentials (ACC1001–ACC1005)
- `docs/VOICE_LATENCY.md` — Latency optimization notes

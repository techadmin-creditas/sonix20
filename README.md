# Agentic Voice Bot

A production-grade AI voice bot platform. Callers speak into a browser, audio is streamed over WebSocket to a FastAPI backend, transcribed in real time by Deepgram, processed by an LLM (Groq / OpenAI / Gemini / Anthropic), and spoken back by ElevenLabs TTS — all within ~600 ms end-to-end.

The platform ships with:
- **Banking tools** — real customer identity verification, balance lookup, and loan status from SQLite
- **Workflow engine** — graph-based multi-turn conversation flows with branching logic
- **Cross-session memory** — callers are recognised across calls (Redis + SQLite + ChromaDB vector search)
- **Guardrails** — prompt injection detection, PII filtering, output regex masking
- **Obsidian Command** — a dark glassmorphism control plane UI for creating bots, building workflows, managing knowledge bases, and reviewing live sessions

---

## Monorepo Layout

```
agentic-voice-bot/
├── voicebot/           ← FastAPI backend (Python 3.10+)
├── obsidian-command/   ← Control plane UI (React + Vite + Tailwind)
├── scripts/            ← Seed scripts and test utilities
├── docs/               ← Architecture, API, design, and live test guide
├── data/               ← SQLite database files (auto-created)
└── requirements.txt    ← Backend Python dependencies
```

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Python | 3.10 | Backend runtime |
| Node.js | 18.x | Frontend build |
| npm | 9.x | Frontend package manager |
| Redis | 6.x | Session cache + TTS audio cache. Run locally or via Docker |

**API Keys required** (add to `.env` before starting):

| Key | Provider | Used for |
|---|---|---|
| `DEEPGRAM_API_KEY` | [deepgram.com](https://deepgram.com) | Real-time STT transcription |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | LLM inference (recommended: llama-3.3-70b) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) | TTS voice synthesis |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | Optional — alternative LLM |
| `GEMINI_API_KEY` | [ai.google.dev](https://ai.google.dev) | Optional — alternative LLM |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Optional — alternative LLM |

---

## Backend Setup (`voicebot/`)

### 1. Create and activate a virtual environment

```bash
cd agentic-voice-bot
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

Install optional extras only if you need them:

```bash
# WebRTC browser transport
pip install aiortc==1.14.0

# Anthropic Claude LLM support
pip install "anthropic>=0.40.0"

# Vector memory / RAG via ChromaDB
pip install "chromadb>=0.5.0"

# LiveKit integration
pip install livekit==1.1.3 livekit-api==1.1.0
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Open .env and fill in your API keys
```

Minimum keys to set for a working local run:

```dotenv
DEEPGRAM_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
REDIS_URL=redis://localhost:6379/0
SQLITE_DB_PATH=./data/voicebot.db
```

### 4. Start Redis (if not already running)

```bash
# Docker (recommended)
docker run -d -p 6379:6379 redis:7-alpine

# Or via system package manager
sudo service redis start
```

### 5. Seed the banking test database

Populates `customer_accounts` and `loans` tables with 5 mock customers for live testing:

```bash
python3 scripts/seed_banking_db.py
```

This is idempotent — safe to run multiple times.

### 6. Database Migrations
The system handles schema updates automatically on startup via `SQLiteProvider.initialize()`. There is no need to run manual migration scripts. When you pull the latest code and restart the server, any new columns or tables will be added automatically to your `voicebot.db` without wiping your existing bots.

### 7. Start the backend server

```bash
uvicorn voicebot.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now available at:
- REST API: `http://localhost:8000/api/v1/`
- WebSocket voice: `ws://localhost:8000/ws/voice/{session_id}`
- Interactive docs: `http://localhost:8000/docs`

#### Production start (no reload, multiple workers)

```bash
uvicorn voicebot.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Frontend Setup (`obsidian-command/`)

### 1. Install dependencies

```bash
cd obsidian-command
npm install
```

### 2. Configure the API base URL

The frontend connects to the backend at `http://localhost:8000` by default. To override, set `VITE_API_BASE_URL` in an `.env.local` file:

```bash
# obsidian-command/.env.local
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Start the development server

```bash
npm run dev
```

The UI opens at **http://localhost:5173**

### 4. Build for production

```bash
npm run build       # outputs to obsidian-command/dist/
npm run preview     # preview the production build locally
```

---

## Running Both Together (Quick Start)

Open two terminal tabs from `agentic-voice-bot/`:

**Terminal 1 — Backend**

```bash
source venv/bin/activate
uvicorn voicebot.main:app --reload
```

**Terminal 2 — Frontend**

```bash
cd obsidian-command
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Testing a Live Banking Bot

See [`docs/LIVE_TEST_GUIDE.md`](docs/LIVE_TEST_GUIDE.md) for the full end-to-end walkthrough including:
- Seeded customer credentials (ACC1001–ACC1005)
- Bot creation with banking tools enabled
- 9 live session test scenarios (identity verification, balance, loan status, overdue alerts, prompt injection, sentiment escalation)
- Post-session analytics review
- Cross-session memory verification

### Quick smoke test (no browser needed)

```bash
# Start server first, then in a second terminal:
python3 scripts/test_session.py
python3 scripts/test_websocket.py
```

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/bots` | List all bots |
| `POST` | `/api/v1/bots` | Create a bot |
| `PATCH` | `/api/v1/bots/{id}` | Update bot config |
| `DELETE` | `/api/v1/bots/{id}` | Soft-delete a bot |
| `GET` | `/api/v1/workflows` | List workflows |
| `POST` | `/api/v1/workflows` | Create workflow |
| `DELETE` | `/api/v1/workflows/{id}` | Delete workflow |
| `POST` | `/api/v1/sessions` | Start a session |
| `GET` | `/api/v1/sessions` | List sessions |
| `DELETE` | `/api/v1/sessions/{id}` | Delete session + cascade |
| `GET` | `/api/v1/sessions/{id}/facts` | Get extracted entities |
| `POST` | `/api/v1/sessions/{id}/feedback` | Submit CSAT feedback |
| `GET` | `/api/v1/analytics/latency` | STT/LLM/TTS latency data |
| `GET` | `/api/v1/analytics/intents` | Intent distribution |
| `GET` | `/api/v1/health` | Service health check |
| `WS` | `/ws/voice/{session_id}` | Binary PCM audio stream |

Full interactive docs available at `http://localhost:8000/docs` when the server is running.

---

## Docs

| File | Contents |
|---|---|
| [`docs/LIVE_TEST_GUIDE.md`](docs/LIVE_TEST_GUIDE.md) | Full UI banking bot live test guide |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture and data flow |
| [`docs/API.md`](docs/API.md) | REST API reference |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Obsidian Command UI design system |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Feature-to-UI mapping |

---

## Project Structure (Backend)

```
voicebot/
├── main.py                          ← FastAPI app entry point, WebSocket handler
├── api/
│   └── v1/routes.py                 ← All REST endpoints
├── core/
│   ├── orchestrator/
│   │   ├── brain.py                 ← AgenticBrain — per-turn logic, tools, guardrails
│   │   ├── turn_detector.py         ← End-of-turn heuristics (punctuation, pause, length)
│   │   └── workflow_engine.py       ← Graph-based conversation flow execution
│   └── tools/
│       ├── registry.py              ← Tool lookup and instantiation
│       └── implementations/
│           ├── banking_tools.py     ← VerifyCustomerTool, GetAccountBalanceTool, GetLoanStatusTool
│           ├── knowledge_search.py  ← SearchKnowledgeTool (ChromaDB + SQLite KB)
│           └── secondary_tools.py  ← RememberUserFactTool, WeatherTool, GetAppointmentsTool
├── services/
│   ├── stt/deepgram_provider.py     ← Deepgram real-time WebSocket STT
│   ├── tts/elevenlabs_provider.py   ← ElevenLabs streaming TTS + Redis cache
│   ├── llm/
│   │   ├── openai_provider.py       ← OpenAI streaming provider
│   │   ├── groq_provider.py         ← Groq streaming provider
│   │   ├── gemini_provider.py       ← Google Gemini provider
│   │   └── anthropic_provider.py    ← Anthropic Claude provider
│   ├── memory/
│   │   ├── sqlite_provider.py       ← All SQLite operations (bots, sessions, banking, KB)
│   │   ├── redis_provider.py        ← Redis session state
│   │   └── vector_provider.py       ← ChromaDB vector search for RAG
│   └── guardrail/
│       ├── injection_detector.py    ← Prompt injection detection (17 patterns)
│       ├── pii_detector.py          ← PII masking (names, card numbers, DOB)
│       └── output_guard.py          ← Regex-based output filtering
└── shared/
    ├── config/settings.py           ← Pydantic settings from .env
    ├── policy.py                    ← guardrail_policy and data_access_policy parsing
    └── agent_task_spec.py           ← agent_task_spec prompt appendix rendering
```

# Obsidian Command — Feature & UI Parity Map

> Living document. Update whenever a backend feature is added or a UI surface changes.  
> Use as the primary QA checklist before any release.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented & surfaced in UI |
| 🔧 | Backend implemented, UI surfaced |
| 📋 | Backend implemented, UI not yet surfaced |
| ❌ | Not implemented |

---

## 1 · Cross-Session Memory

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| `user_id` threading | `main.py` → `voice_websocket` | `POST /sessions?user_id=` | `SessionControl.tsx` Caller ID input | ✅ |
| User facts storage | `sqlite_provider.get_user_cross_session_context` | — | — | 🔧 |
| User facts retrieval per session | `sqlite_provider.get_session_facts` | `GET /sessions/{id}/facts` | `SessionDetail.tsx` Entities tab | ✅ |
| Cross-session context injected into LLM | `brain._load_cross_session_context` | — | — | 🔧 |
| `user_id` shown in session list | — | `GET /sessions` | `Sessions.tsx` session row | ✅ |
| `user_id` shown in session detail | — | `GET /sessions/{id}` | `SessionDetail.tsx` metadata sidebar | ✅ |

---

## 2 · Real-Time Sentiment Analysis

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Per-turn sentiment scoring | `brain._analyze_and_emit_sentiment` | WS event `{type: "sentiment", label}` | `SessionControl.tsx` live badge | ✅ |
| Sentiment dot on transcript turn | — | WS event | `SessionControl.tsx` transcript | ✅ |
| Rolling negative sentiment alert | — | WS event | `SessionControl.tsx` amber banner | ✅ |
| Auto-escalation on 3+ negative turns | `brain._analyze_and_emit_sentiment` | — | — | 🔧 |
| Sentiment per turn in stored transcript | `conversation_logs.metadata.sentiment` | `GET /sessions/{id}/log` | `SessionDetail.tsx` transcript dots | ✅ |
| Aggregate sentiment score per session | `sessions.metadata.sentiment_score` | `GET /sessions/{id}` | `SessionDetail.tsx` metadata | ✅ |
| Sentiment score in session list | — | `GET /sessions` | `Sessions.tsx` sentiment bar | ✅ |

---

## 3 · Automatic Entity Extraction

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Regex entity extraction (name/amount/ref/date) | `brain._extract_and_store_entities` | WS log event `{tag: "[ENTITY]"}` | `SessionControl.tsx` Entities tab | ✅ |
| Entities stored as user_facts | `sqlite_provider.save_user_fact` | `GET /sessions/{id}/facts` | `SessionDetail.tsx` Entities tab | ✅ |

---

## 4 · Webhook Integrations

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| `escalate_webhook_url` bot field | `workflow_engine._handle_escalation` | `PATCH /bots/{id}` | `BotConfig.tsx` Integrations section | ✅ |
| `actions_webhook_url` bot field | `workflow_engine._execute_node_chain` | `PATCH /bots/{id}` | `BotConfig.tsx` Integrations section | ✅ |
| `post_call_webhook_url` bot field | `main.py` finally block | `PATCH /bots/{id}` | `BotConfig.tsx` Integrations section | ✅ |
| `min_stt_confidence` bot field | `brain._process_user_turn` | `PATCH /bots/{id}` | `BotConfig.tsx` Integrations section | ✅ |

---

## 5 · CSAT / Session Feedback

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Feedback table `session_feedback` | `sqlite_provider.save_session_feedback` | `POST /sessions/{id}/feedback` | `SessionDetail.tsx` Stats tab | ✅ |
| Retrieve stored feedback | `sqlite_provider.get_session_feedback` | `GET /sessions/{id}/feedback` | `SessionDetail.tsx` Stats tab | ✅ |
| Star rating (1–5) UI | — | — | `SessionDetail.tsx` CSAT form | ✅ |
| Outcome dropdown (resolved / escalated / abandoned) | — | — | `SessionDetail.tsx` CSAT form | ✅ |

---

## 6 · Latency Observability

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Per-turn STT/LLM/TTS metrics logged | `brain._finalize_turn` → `db.log_turn_metrics` | `GET /analytics/latency` | `Analytics.tsx` Latency chart | ✅ |
| Per-turn metrics in live session | WS event `{type: "metrics"}` | — | `SessionControl.tsx` metric cards | ✅ |
| Avg latency per session in detail view | `sessions.metadata.*_ms` | `GET /sessions/{id}` | `SessionDetail.tsx` Stats tab | ✅ |

---

## 7 · Intent Analytics

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Intent distribution | `sessions.metadata.intent` | `GET /analytics/intents` | `Analytics.tsx` Intent chart | ✅ |
| Intent shown in session list | — | `GET /sessions` | `Sessions.tsx` session row | ✅ |
| Intent shown in session detail | — | `GET /sessions/{id}` | `SessionDetail.tsx` Summary tab | ✅ |

---

## 8 · Vector Memory (RAG / ChromaDB)

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| ChromaDB vector store | `vector_provider.py` | `GET /health/vector` | `Settings.tsx` DB section | ✅ |
| Session summary stored as embeddings | `vector_provider.store_conversation` | — | — | 🔧 |
| Semantic retrieval injected into LLM | `brain._process_user_turn` | — | — | 🔧 |

---

## 9 · Anthropic LLM Provider

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| `AnthropicStreamingProvider` | `services/llm/anthropic_provider.py` | — | — | 🔧 |
| Anthropic models in metadata list | `routes.get_supported_models` (ANTHROPIC_API_KEY check) | `GET /metadata/models` | `BotConfig.tsx` LLM Engine dropdown | ✅ |

---

## 10 · STT Confidence Recovery

| Feature | Backend | API Endpoint | UI Page | Status |
|---------|---------|-------------|---------|--------|
| Low-confidence utterance recovery | `brain._process_user_turn` confidence check | — | Via `min_stt_confidence` in BotConfig | ✅ |

---

## API Quick Reference

```
POST   /api/v1/sessions                    Create session (user_id, bot_id, transport)
GET    /api/v1/sessions                    List sessions
GET    /api/v1/sessions/{id}               Session detail
GET    /api/v1/sessions/{id}/log           Conversation transcript
POST   /api/v1/sessions/{id}/feedback      Submit CSAT feedback
GET    /api/v1/sessions/{id}/feedback      Retrieve CSAT feedback
GET    /api/v1/sessions/{id}/facts         User facts / entities extracted in session
GET    /api/v1/bots                        List bots
GET    /api/v1/bots/{id}                   Get bot config
POST   /api/v1/bots                        Create bot
PATCH  /api/v1/bots/{id}                   Update bot (incl. webhook URLs)
DELETE /api/v1/bots/{id}                   Soft-delete bot
GET    /api/v1/analytics/dashboard         Dashboard KPIs
GET    /api/v1/analytics/latency           Per-session STT/LLM/TTS latency (last 30)
GET    /api/v1/analytics/intents           Intent distribution (last 100 sessions)
GET    /api/v1/metadata/models             Supported LLM models (Anthropic if key set)
GET    /api/v1/metadata/voices             Supported TTS voices
GET    /api/v1/health/vector               ChromaDB status + document count
GET    /health                             Gateway health check
WS     /ws/voice/{session_id}              Voice pipeline WebSocket
```

---

## WebSocket Event Reference

| Event `type` | Direction | Payload fields | Consumer |
|-------------|-----------|---------------|---------|
| `status` | server→client | `state`, `message` | `SessionControl` status label |
| `transcript` | server→client | `text`, `is_final`, `confidence` | `SessionControl` transcript |
| `bot_transcript` | server→client | `text`, `is_final` | `SessionControl` transcript |
| `sentiment` | server→client | `label` (positive\|neutral\|negative) | `SessionControl` sentiment badge |
| `log` | server→client | `tag`, `message`, `color` | `SessionControl` Neural Logs |
| `metrics` | server→client | `stt`, `llm`, `tts`, `total` | `SessionControl` metric cards |
| `infra_status` | server→client | `redis`, `stt`, `llm`, `tts`, `uptime` | `SessionControl` infra panel |
| `tool_call` | server→client | `name`, `arguments` | `SessionControl` Tool Engine log |
| `tool_result` | server→client | `name`, `result` | `SessionControl` Tool Engine log |
| `session_ended` | server→client | `reason` | `SessionControl` end state |
| `error` | server→client | `message` | `SessionControl` fatal log |
| `text_query` | client→server | `text` | brain simulator mode |
| `interrupt` | client→server | — | brain interrupt handler |
| `switch_bot` | client→server | `bot_id` | runtime bot swap |

---

## QA Test Checklist

### Cross-Session Memory
- [ ] Start session with Caller ID "test-user-1", say your name — check Entities tab shows name
- [ ] End session, start new session with same Caller ID — verify `[MEMORY]` block in system prompt (server logs)
- [ ] Check `Sessions.tsx` shows `User: test-user-1` in the session row

### Sentiment
- [ ] Express frustration during a session — verify red dot appears on transcript turn
- [ ] Express 3+ negative turns — verify amber `Sentiment Alert` banner appears
- [ ] After session, open `SessionDetail.tsx` → Transcript tab — verify sentiment dots on user turns

### Entities
- [ ] Say "My name is Alice and I owe ₹5000" — check Entities tab shows Name: Alice, Amount: ₹5000
- [ ] After session, open `SessionDetail.tsx` → Entities tab — verify fact cards

### CSAT Feedback
- [ ] Open `SessionDetail.tsx` → Stats tab
- [ ] Select star rating, outcome, notes → click Submit Feedback
- [ ] Reload page — verify feedback is shown as read-only with amber checkmark

### Integrations / Webhooks
- [ ] Open `BotConfig.tsx` for any bot
- [ ] Scroll to Integrations & Webhooks section
- [ ] Enter webhook URLs and Min STT Confidence slider
- [ ] Click Save Changes — verify values persist on reload

### Analytics
- [ ] Complete at least one voice session with several turns
- [ ] Open `Analytics.tsx` — verify Latency chart shows session bar(s)
- [ ] Check Intent Distribution chart updates when session metadata has `intent` set

### Settings / Health
- [ ] Open `Settings.tsx` → Database Status section
- [ ] Verify Redis, SQLite, ChromaDB status dots and labels match actual server state
- [ ] Stop Redis server, reload page — verify Redis shows red `offline` badge

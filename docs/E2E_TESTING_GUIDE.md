# End-to-End Testing Guide
## Voice Bot — UI to Backend Validation

This guide walks through every layer of the voice bot stack from a fresh checkout
to a live voice call through the Obsidian Command UI.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | ≥ 3.11 | `pyenv install 3.11` |
| Node.js | ≥ 20 | `nvm install 20` |
| Docker | any recent | docker.com |
| LiveKit server | latest | see Step 1 |
| Deepgram API key | — | deepgram.com |
| Groq API key | — | console.groq.com |

---

## Step 1 — Start Infrastructure

### 1a. LiveKit Server (WebRTC)

```bash
docker run --rm -d \
  --name livekit \
  -p 7880:7880 \
  -p 7881:7881/udp \
  -p 50000-50100:50000-50100/udp \
  livekit/livekit-server:latest --dev
```

Verify: `curl http://localhost:7880` → should return LiveKit info JSON.

### 1b. (Optional) Redis for semantic cache

```bash
docker run --rm -d --name redis -p 6379:6379 redis:7-alpine
```

---

## Step 2 — Configure Environment

```bash
cd agentic-voice-bot
cp .env.example .env
```

Edit `.env` and set:

```dotenv
DEEPGRAM_API_KEY=dg_xxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
# Optional — enables semantic cache
REDIS_HOST=localhost
```

---

## Step 3 — Install Python Dependencies

```bash
cd agentic-voice-bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# If requirements.txt is absent, install manually:
pip install fastapi uvicorn[standard] websockets httpx groq \
            deepgram-sdk livekit livekit-api pydantic redis \
            python-dotenv aiohttp
```

---

## Step 4 — Seed the Database

```bash
python scripts/seed_db.py
```

This creates `data/voicebot.db` and inserts a default bot:

```
Bot: "Aria" (Deepgram Aura TTS, Groq LLaMA 3.3 70B)
Voice: aura-asteria-en
Pipeline: classic (upgraded to deepgram_ws by new schema)
```

Verify:

```bash
python - <<'EOF'
import sqlite3
conn = sqlite3.connect("data/voicebot.db")
rows = conn.execute("SELECT id, name, voice_id, tts_provider FROM bots").fetchall()
for r in rows: print(dict(r))
EOF
```

Expected output includes `tts_provider = 'deepgram_ws'` (from Phase 4 migration).

---

## Step 5 — Start the Backend Server

```bash
# From agentic-voice-bot/
uvicorn voicebot.main:app --host 0.0.0.0 --port 8000 --reload
```

Watch the startup logs. You should see:

```
✅ SQLite DB initialized
🚀 Unified VoiceBot Server starting (ENV=development)...
```

Health check:

```bash
curl http://localhost:8000/health
# → {"status":"healthy","services":{"stt":"deepgram","tts":"elevenlabs",...}}
```

---

## Step 6 — Start the Obsidian Command UI

```bash
cd obsidian-command
npm install
cp .env.example .env.local
# Edit .env.local:
#   VITE_API_BASE=http://localhost:8000/api/v1
npm run dev
```

Open: **http://localhost:5173**

---

## Step 7 — Create / Verify a Bot

1. In the sidebar click **Bots → Create Bot**
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `TestBot` |
   | LLM Model | `llama-3.3-70b-versatile` |
   | Voice Profile | `aura-asteria-en` |
   | TTS Provider | `deepgram_ws` |
   | Greeting | `Hello! I'm TestBot. How can I help you today?` |
   | System Prompt | `You are a friendly assistant. Keep answers brief, under 3 sentences.` |

3. Save the bot. Note its **Bot ID** from the URL.

---

## Step 8 — Run the Full Voice Pipeline Tests

### Test A — WebSocket Classic Pipeline (Browser)

1. Navigate to **Sessions → New Session** in the UI
2. Select `TestBot`
3. Click **Start Session**
4. In the terminal observe:

   ```
   ✅ STT Bridge established
   ✅ Deepgram WS TTS connected (model=aura-asteria-en)
   ```

5. The bot should play its **greeting audio** within ~2 seconds

**What to verify:**
- [ ] Greeting audio plays (no silence, no error)
- [ ] `bot_transcript` WebSocket message arrives with `is_final: true`
- [ ] Status bar shows `listening`

---

### Test B — Microphone → STT → LLM → TTS Loop

1. With the session active, **say**: *"What's the capital of France?"*
2. Watch the UI transcript pane and backend logs

**Expected flow (in logs):**

```
[STT] PARTIAL: "what's the" (final=False)
[STT] FINAL: "what's the capital of France?" (final=True)
[BRAIN] Silence timer fired (50ms) → _process_user_turn
[METRIC] LLM TTFT: ~180ms
[STREAM] TTS segment (first_audio_latency_ms ~ 280ms)
[STREAM] TTS segment → audio playing
[METRIC] Turn complete: TAT=~500ms
```

**What to verify:**
- [ ] Transcript shows correct text in real time
- [ ] Bot responds in < 1 second (first audio)
- [ ] Inter-sentence gap is not audible (< 30 ms on WS TTS)
- [ ] Metrics WebSocket message contains `first_audio`, `tts_ttfs`, `inter_segment_gap`

---

### Test C — Interruption / Barge-In

1. Ask a long question: *"Can you list all the countries in Europe?"*
2. **Interrupt mid-response**: say *"Stop, I meant just France"*

**Expected:**
- [ ] Bot stops speaking within 100 ms of your voice
- [ ] New response addresses "just France"
- [ ] `false_interruptions` in metrics is 0 (no self-interruptions from echo)
- [ ] No audio bleed from the previous response

---

### Test D — Persistent WS TTS Gap Test

Ask a multi-sentence question: *"Tell me about the water cycle in three sentences."*

**In browser DevTools → Network → WS:**
- Open the active WebSocket connection
- Watch `on_audio_output` binary frames arrive
- Measure gap between last frame of sentence 1 and first frame of sentence 2

**Expected:** gap < 30 ms (was 80–300 ms with HTTP TTS)

**Automated check:**

```bash
python scripts/test_websocket.py
# Should print audio chunk timing between segments
```

---

### Test E — LiveKit Voice Session

```bash
# Start the LiveKit agent for a test room
python -m voicebot.livekit_agent test-room <BOT_ID>
```

In another terminal, join the room with the test script:

```bash
python scripts/test_session.py --room test-room
```

Or use the **LiveKit Playground**: https://meet.livekit.io (use devkey/secret, point to localhost:7880)

**What to verify:**
- [ ] Agent logs `✅ Audio stream LIVE ... (settle=0.1s)` (exponential backoff, not 1s sleep)
- [ ] Audio resampler logs `48000Hz 1ch → 16000Hz 1ch` on first frame
- [ ] Bot greeting plays through WebRTC within 3 seconds of room join
- [ ] User speech arrives at Deepgram (check STT partial logs)

---

### Test F — Speech-Speech (S2S) Pipeline

Requires `OPENAI_API_KEY` in `.env`.

1. Create a bot with **Pipeline Mode = `speech_speech`**
2. Start a session
3. Speak to the bot

**Expected:**
- [ ] Backend logs `[S2S] OpenAI Realtime bridge connected`
- [ ] No Deepgram STT / Groq LLM / Deepgram TTS logs (bypassed entirely)
- [ ] Bot responds in ~300 ms (OpenAI Realtime TTFS)
- [ ] `session_ended` message arrives on disconnect with post-call summary

---

## Step 9 — Metrics Dashboard Validation

After any voice turn, the UI receives a `metrics` WebSocket message:

```json
{
  "type": "metrics",
  "stt": 180,
  "llm": 210,
  "tts_ttfs": 52,
  "first_audio": 390,
  "inter_segment_gap": 18,
  "false_interruptions": 0,
  "tts_provider": "DeepgramWSTTSProvider",
  "total": 450
}
```

In the **Analytics** page of Obsidian UI, check that latency graphs update after each turn.

**Target numbers (Phase 3 complete):**

| Metric | Target | Fail if |
|---|---|---|
| `first_audio` | < 500 ms | > 1500 ms |
| `tts_ttfs` | < 100 ms (WS) / < 400 ms (HTTP) | > 600 ms |
| `inter_segment_gap` | < 30 ms (WS) | > 200 ms |
| `false_interruptions` | 0 | > 2 per session |
| `total` | < 800 ms | > 2000 ms |

---

## Step 10 — Automated Script Tests

Run the full test suite from the scripts folder:

```bash
# 1. Database health
python scripts/test_workflow_engine.py

# 2. Session API
python scripts/test_session.py

# 3. WebSocket voice pipeline (text mode, no mic needed)
python scripts/test_websocket.py

# 4. Agent terminal (interactive text → bot)
python scripts/agent_terminal.py

# 5. Full audio pipeline (needs mic)
python scripts/talk_to_bot.py
```

---

## Common Issues & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| No greeting audio | Deepgram WS TTS connect failed | Check `DEEPGRAM_API_KEY`; logs show fallback to HTTP |
| STT not transcribing | Deepgram STT websocket failed | Check key; look for `❌ Deepgram STT failed` in logs |
| Bot self-interrupts | Acoustic echo from speakers | Use headphones, or set `pipeline_mode=speech_speech` |
| LiveKit no audio | AudioResampler race | Upgrade to latest `livekit` SDK; verify logs show `settle=0.1s` |
| `tts_ttfs` > 400 ms | Using HTTP TTS | Set bot `tts_provider = deepgram_ws` in DB / UI |
| LLM cold start delay | Groq client not warmed | Check brain log for `Warming up Groq client` on init |
| `inter_segment_gap` > 100 ms | WS TTS not connected | Verify `tts_provider = deepgram_ws` and WS connect log |

---

## Bot Config Reference (Obsidian → Bot Settings)

```json
{
  "name": "TestBot",
  "llm_model": "llama-3.3-70b-versatile",
  "voice_id": "aura-asteria-en",
  "tts_provider": "deepgram_ws",
  "pipeline_mode": "classic",
  "first_segment_chars": 80,
  "audio_frame_normalize": true,
  "conversation_policy": {
    "silence_threshold_ms": 400,
    "max_tts_buffer_chars": 100,
    "tts_flush_mode": "balanced",
    "tts_pipeline_llm": true,
    "first_segment_chars": 80,
    "stt_endpointing_ms": 300,
    "stt_utterance_end_ms": 800
  }
}
```

---

## Architecture Flow (All Phases Complete)

```
Browser/LiveKit
      │
      │  PCM audio (16 kHz mono)
      ▼
  [Deepgram STT WebSocket]
      │  interim + final transcripts (vad_events, 300ms endpointing)
      ▼
  [AgenticBrain]
      │  _utterance_buffer accumulates finals
      │  _wait_for_silence (50–150 ms after final)
      │
      ├─ Guardrail (PII check) ~10ms
      ├─ Semantic cache (Redis) ~10ms
      │
      ▼
  [Groq LLM Stream] ← pre-warmed client
      │  tokens arrive ~100-200ms TTFT
      │
      ▼ first 80 chars (fast-path)
  [Deepgram WS TTS]  ← persistent connection
      │  ~50ms TTFS
      │
      ▼  640-byte / 20ms normalized frames
  [AudioFrameNormalizer]
      │
      ▼
  Browser AudioWorklet / LiveKit AudioSource
      (smooth, jitter-free playback)
```

# Voice Bot Platform — API Reference & Integration Guide

This document describes the REST and WebSocket endpoints available for the **voicebot** platform, mapped to the features shown in the **Ember Pulse** dashboard.

---

## 🚀 Authentication & Base URL
- **Base URL**: `http://localhost:8000/api/v1`
- **WebSocket URL**: `ws://localhost:8000/ws/voice`
- **Content-Type**: `application/json`

---

## 📊 1. Overview Dashboard APIs
These endpoints power the main command center metrics and activity feeds.

### List Recent Sessions
`GET /sessions`
- **Description**: Retrieves a list of the most recent voice interactions for the activity table.
- **Query Params**: `limit` (default: 50)
- **Response**:
  ```json
  {
    "sessions": [
      { "session_id": "...", "bot_id": "...", "start_time": "...", "duration": 262, "turns": 12, "sentiment": 0.82 }
    ],
    "count": 1
  }
  ```

### System Health
`GET /health`
- **Description**: Returns the status of the gateway and underlying services (STT, LLM, TTS).
- **Response**: `{ "status": "ok", "module": "gateway" }`

---

## 🤖 2. Bot Management APIs
Used for creating and configuring the AI personas shown in the Bots Grid.

### List All Bots
`GET /bots`
- **Description**: Fetches all configured AI personas.
- **Response**: `{ "bots": [...], "count": 5 }`

### Create New Bot
`POST /bots`
- **Request Body**:
  ```json
  {
    "name": "Ember Assistant",
    "system_prompt": "You are a helpful voice bot...",
    "persona": "Friendly and concise",
    "voice_id": "expressive_amber_v2",
    "tools_enabled": ["search_knowledge", "remember_user_fact"]
  }
  ```

### Update/Delete Bot
- `PATCH /bots/{bot_id}`: Update specific fields (name, prompt, etc.).
- `DELETE /bots/{bot_id}`: Soft-delete the bot.

---

## 🎙️ 3. Live Session & Real-time Connectivity
The core engine for the "Live Session" screen and the Voice Orb.

### Initialize Session
`POST /sessions`
- **Description**: Generates a unique session ID and prepares the environment for a new call.
- **Request Body**: `{ "bot_id": "alex-v1", "user_id": "client-99" }`
- **Response**:
  ```json
  {
    "session_id": "9bcd6c67...",
    "websocket_url": "/ws/voice/9bcd6c67...",
    "status": "created"
  }
  ```

### Real-time Voice Stream (WebSocket)
`WS /ws/voice/{session_id}`
- **Description**: Bi-directional stream for audio and transcript updates.
- **Messages (JSON)**:
  - `type: "transcript"`: Real-time text-to-UI update.
  - `type: "audio"`: Binary PCM audio chunks for playback.
  - `type: "tool_call"`: Notification that the bot is searching knowledge or performing a task.

---

## 📜 4. Session History & Transcripts
Powers the audit log and detailed call analysis screens.

### Get Full Transcript
`GET /sessions/{session_id}/log`
- **Description**: Retrieves every turn (user/assistant) for a specific call.
- **Response**:
  ```json
  {
    "session_id": "...",
    "turns": [
      { "role": "user", "content": "How do I reset my password?", "timestamp": "..." },
      { "role": "assistant", "content": "I can help with that...", "timestamp": "..." }
    ]
  }
  ```

---

## 🧠 5. Knowledge Base (RAG)
Endpoints for the "Knowledge Base" editor and search test tool.

### Add Knowledge Entry
`POST /knowledge`
- **Request Body**:
  ```json
  {
    "topic": "Troubleshooting",
    "question": "How to reset router?",
    "answer": "Hold the reset button for 10 seconds.",
    "keywords": ["router", "reset", "internet"]
  }
  ```

### Test Search
`GET /knowledge/search?q=reset`
- **Description**: Validates that the AI can correctly retrieve the answer for the given query.

---

## 🧪 6. Test Utilities
One-off test endpoints for the Settings/Dev screen.
- `POST /tts/test`: Test sound quality for a specific voice provider.
- `POST /llm/test`: Benchmark LLM response speed and reasoning.

# Unified VoiceBot Platform - Technical Architecture

This document provides a comprehensive overview of the VoiceBot's architecture, features, and conversational intelligence.

## 1. Core Orchestration (The "Brain")
The system is built around an asynchronous state machine (`AgenticBrain`) that manages the real-time lifecycle of a voice turn:
- **States**: `IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`.
- **Interruption Flow**: `SPEAKING` → `INTERRUPTED` → `LISTENING`.
- **Latency-First Design**: Uses `asyncio.Event` and non-blocking streaming loops to ensure zero-latency cancellation during interruptions.

## 2. Multimodal Pipeline
The bot integrates industry-leading providers for high-performance voice interaction:
- **STT (Speech-to-Text)**: 
  - Primarily **Deepgram** via WebSockets (sub-200ms latency).
  - Supports English and Hindi with automatic language detection.
- **LLM (Reasoning)**:
  - **Groq (Llama-3.3-70b)**: The default for ultra-fast "First Sentence" responses.
  - **Gemini / OpenAI / Anthropic**: Supported for complex reasoning and long-context tasks.
  - **Agentic Tool Calling**: The LLM can execute real-time tools (Knowledge search, Banking API, Booking, etc.).
- **TTS (Text-to-Speech)**:
  - **Deepgram Aura**: High-speed, high-quality English synthesis.
  - **ElevenLabs (Multilingual V2)**: The gold standard for Hindi and emotional prosody.

## 3. High-Performance Optimizations
- **Predictive Pre-warming**: The LLM client begins initializing as soon as keywords are detected in *partial* transcripts, shaving 300-500ms off the final response time.
- **Audio Frame Normalization**: Converts variable TTS chunks into uniform **10ms PCM frames** (320 bytes), preventing audio stuttering in the browser.
- **First-Segment Fast-Flush**: Emits the first sentence of an LLM response immediately (at ~80 chars) instead of waiting for the full paragraph.

## 4. Advanced Conversation Control
- **Barge-in (Interruption Handling)**: 
  - **350ms Debounce**: Uses a configurable window to filter out noise/echo.
  - **Immediate Flush**: Signals the UI to stop audio playback *instantly* the moment speech starts.
  - **Text Recovery**: Captures user words spoken *during* the cancellation phase so the bot "hears" why it was interrupted.
- **Proactive Engagement**: If the user is silent for 10 seconds, the bot automatically sends a "Still there?" prompt to prevent session deadlocks.

## 5. Intelligence Layers
- **Workflow Engine**: A hybrid node-graph system that allows deterministic paths (e.g., Collection scripts) with seamless hand-off to free-form LLM logic.
- **Real-time Sentiment**: Analyzes every user turn (Positive/Neutral/Negative) and can trigger automatic supervisor escalation after 3 consecutive negative turns.
- **Entity Extraction**: Background logic automatically extracts names, loan amounts, dates, and account numbers into a "User Facts" database without extra LLM calls.
- **Guardrails**:
  - **PII Detector**: Redacts sensitive info (SSN, Phone, Email) before it reaches the LLM.
  - **Injection Shield**: Blocks prompt-injection attempts.
  - **Topic Restricted**: Ensures the bot stays within its "Banking" or "Assistance" domain.

## 6. Memory & Knowledge (RAG)
- **Short-term (Redis)**: High-speed caching for transient turn data.
- **Long-term (SQLite)**: Full session storage and turn history.
- **Vector RAG (ChromaDB)**: Injects relevant Knowledge Base snippets into the LLM context in real-time.
- **Cross-Session Memory**: Greets returning users by looking up summaries and key facts from their *previous* calls.

## 7. Post-Call Lifecycle
- **Auto-Summarization**: Generates a 2-sentence summary and intent tag immediately after hang-up.
- **Webhooks**: Fires data to external CRM/API endpoints for "Post-Call" and "Escalation" events.
- **Analytics**: Records detailed latency metrics (STT, LLM, TTS, First-Audio) for every single turn.

---

# Our Project: The Elevator Pitch (Prompt)

> "We've built a **next-generation Voice AI Platform** designed for high-stakes, low-latency industries like Banking and Customer Support. 
> 
> Unlike traditional bots that feel 'laggy' or robotic, our system responds in **under 800ms** and handles **natural interruptions** (barge-in) just like a human operator. It speaks fluent **Hindi and English**, automatically detects user sentiment to handle frustrated callers with empathy, and uses **Vector Search (RAG)** to provide 100% accurate information from internal knowledge bases. 
> 
> It's not just a chatbot with a voice; it's a **stateful, guardrailed agent** that can execute real business actions (SMS, Webhooks, API calls) while ensuring sensitive user data remains protected."

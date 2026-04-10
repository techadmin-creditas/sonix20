# Implementation Plan - Low-Latency Conversational Infrastructure

This plan integrates the **Extended Grace Window** architectural fix to resolve the barge-in race condition and adds high-performance pre-warming for Groq and Gemini.

## 1. The Extended Grace Window (Barge-in Fix)
**File**: `voicebot/core/orchestrator/brain.py`
- **Instant Mute**: Mute the bot instantly upon any `speech_started` signal.
- **Grace Period**: If the transcript is empty, do NOT resume playback immediately after the debounce. Instead, wait for an extra 300ms while remaining muted.
- **Hard Interrupt**: Only stop all tasks and trigger `handle_interruption` if valid text arrives during the window. Otherwise, resume playback cleanly.

## 2. Speculative Provider Warming
**File**: `voicebot/main.py`, `groq_provider.py`, `gemini_provider.py`
- **Groq "Ping"**: Fire a minimal completion request during the WebSocket handshake to pre-establish the TLS connection.
- **Phase Shift**: Instantiate all providers immediately after the bot config is retrieved from SQLite.

## 3. Gemini TTS Delivery Audit
**File**: `voicebot/services/tts/gemini_provider.py`
- Add telemetry logging for `First Byte Arrival`.
- Audit `audioop.ratecv` for chunking efficiency.

## 4. Codebase Sanitization
- Replace all occurrences of `\xa0` (non-breaking space) with standard spaces.

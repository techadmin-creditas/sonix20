# Advanced Technical Guide: Voice AI Architecture

This document provides a deep dive into the engineering principles and implementation details that power the VoiceBot's low-latency, resilient, and intelligent conversational experience.

---

## 1. Zero-Latency Barge-In (Interruption Handling)

Handling interruptions is one of the most complex aspects of voice AI. Our system achieves "human-level" responsiveness through a coordinated three-tier strategy:

### A. The Signal (Immediate Feedback)
As soon as the STT provider detects a `speech_started` event, the brain fires an immediate `on_audio_interrupt()` callback. 
- **WebSocket Response**: An `audio_interrupt` JSON message is sent to the client.
- **Frontend Action**: The browser's `AudioWorklet` or `MediaSource` is instructed to **flush its output buffer instantly**, stopping bot audio mid-sentence before the server even processes the full transcript.

### B. The "Kill Switch" (`_interrupt_event`)
The backend uses an `asyncio.Event` as a global cancellation signal. All streaming loops (LLM token generation and TTS audio synthesis) check `if self._interrupt_event.is_set(): break` in every iteration. This ensures that a "Stop" command from the user kills all downstream processing within milliseconds.

### C. The Barge-In Buffer (Context Recovery)
To prevent the bot from "forgetting" the beginning of the user's interruption (due to network jitter or debounce processing), we implemented a dual-buffer system:
- **`_barge_in_buffer`**: Captures finalized transcripts that arrive *while* the bot is still being canceled.
- **Buffer Merge**: Once the bot transitions to `LISTENING`, it moves the `_barge_in_buffer` to the `_utterance_buffer`. This ensures the bot responds to "Wait, I have a question" instead of just hearing "question."

---

## 2. Semantic Turn Detection (Linguistic VAD)

Standard "silence-based" VAD (Voice Activity Detection) often cuts people off when they pause to think. Our `TurnDetector` uses a **Semantic Scoring Algorithm**:

### A. Confidence Scoring (0.0 to 1.0)
The system calculates a "Completion Confidence" score based on:
- **Linguistic Signals**: Does the sentence end with a question word (*what, kya, kab*) or a conjunction (*and, because, aur*)? Conjunctions **penalize** the score, keeping the bot listening for longer.
- **Punctuation**: STT-provided punctuation ( `. ? !` ) provides a high weight for completion.
- **Silence Duration**: Silence is used as a linear multiplier for the base linguistic score.

### B. Dynamic Windowing
The brain maps this confidence score to a **Dynamic Silence Threshold**:
- **High Confidence** (Short command/Question): **600ms** (Snap response).
- **Low Confidence** (Mid-sentence pause): **2000ms** (Patient listening).

---

## 3. Latency Engineering: The "Sub-Second" Stack

To achieve sub-800ms total turnaround time (TAT), we optimized every layer of the stack:

### A. Predictive LLM Pre-Warming
The system doesn't wait for a "Final" transcript to start thinking. It screens **STT Partials** for `key_intents` (e.g., "book", "pay", "search"). If an intent is spotted, the system eagerly initializes the LLM client in the background, shaving **300-500ms** off the first turn's cold-start penalty.

### B. Persistent WebSocket TTS
While traditional TTS uses HTTP POST (which incurs a 200-400ms handshake/connection cost per sentence), we use a **Persistent WebSocket connection** to Deepgram.
- **TTFS (Time to First Sound)**: Reduced from **400ms** to **~50ms**.
- **The "Flush" Protocol**: We stream text segments and send a `Flush` command to the provider to force-emit audio frames without waiting for a full paragraph.

### C. 10ms Audio Normalization
Browsers require a steady cadence of audio. Our `AudioFrameNormalizer` chunks variable-sized TTS packets into uniform **10ms windows (320 bytes @ 16kHz)**. This prevents the "Initial Pop" or "Stutter" that occurs when the player waits to fill a 100ms buffer before starting playback.

---

## 4. Asynchronous Intelligence & Guardrails

To maintain low latency, all non-critical intelligence layers run as **Background Coroutines** (`asyncio.create_task`):

- **Real-time Sentiment**: Every user response is classified (Positive/Neutral/Negative) in the background. If 3 consecutive "Negative" turns are detected, the system triggers `request_voice_session_end("escalated_sentiment")`.
- **Entity Auto-Extraction**: A background regex/LLM task extracts names, loan IDs, and amounts into the session metadata without blocking the bot's verbal response.
- **PII & Injection Shielding**:
  - **Level 1 (Pre-LLM)**: Masks SSN/Emails to protect privacy and prevent prompt injection "jailbreaks."
  - **Level 2 (Post-LLM)**: The `OutputGuard` masks sensitive keys or forbidden words if the LLM accidentally leaks technical data.

---

## 5. Memory & Context
- **Cross-Session Vector RAG**: Uses **ChromaDB** to index past conversation summaries. When a user returns, the bot "remembers" the outcome of the last call by injecting a compressed summary into the system prompt.
- **Redis Turn Cache**: Stores high-frequency responses (GMB greetings, common FAQs) to bypass the LLM entirely for a **<100ms** response.

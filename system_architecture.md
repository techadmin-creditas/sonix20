# Agentic Voice Platform: System Architecture & Flow

This document outlines the final system architecture and data flow for the Agentic Voice Laboratory, confirming that the end-to-end pipeline is fully operational.

## 🚀 1. End-to-End Voice Flow

The following diagram illustrates the high-speed data flow between the User and the Neural Engine.

```mermaid
graph TD
    User[/User Audio/] ---|WebSockets| Gateway(Unified FastAPI Server)
    Gateway --- STT(Deepgram STT)
    STT ---|Text| Brain(Agentic Brain)
    
    subgraph Brain Engine
        Brain --> RedisCache{Semantic Cache?}
        RedisCache -- Hit --> TTS(TTS Provider)
        RedisCache -- Miss --> LLM(OpenAI / Gemini)
        LLM ---|Streaming| TTS
    end
    
    TTS ---|Binary Audio| Gateway
    Gateway ---|Audio Stream| User
    
    subgraph Persistence Layer
        Brain <---> Redis(Session Persistence)
    end
```

### 🧠 2. Orchestrator State Machine

The `AgenticBrain` manages the conversation lifecycle using a robust state machine in `brain.py`:

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> LISTENING : Start Session
    LISTENING --> PROCESSING : User Finished Speaking
    PROCESSING --> SPEAKING : LLM/Cache Start
    SPEAKING --> LISTENING : End of Turn
    
    SPEAKING --> INTERRUPTED : User Interrupts
    INTERRUPTED --> LISTENING : Flush Buffers
    
    LISTENING --> [*] : End Session
```

## 🛠️ 3. Core Component Review

| Component | Provider(s) | Role | Optimization |
| :--- | :--- | :--- | :--- |
| **STT** | Deepgram | Streaming Transcriptions | Low-latency binary buffer pipelining. |
| **LLM** | OpenAI / Gemini | Intelligence & Reasoning | **Semantic Caching**: Redis-backed hash lookup. |
| **TTS** | ElevenLabs / Deepgram | Speech Synthesis | **Stream-through**: Bypassing disk for direct audio SSE. |
| **Memory** | Redis | Session Persistence | **History Hydration**: Multi-turn context survives restarts. |
| **Guardrail** | PII Detector | Security | Input/Output sanitization in real-time. |

## 🧪 4. Laboratory Simulator Mode

The **Laboratory UI** enables testing the pipeline via direct text input:
1.  **Simulator Input**: Bypasses the STT layer but triggers the full `LLM -> TTS` logic.
2.  **Infrastructure Test**: REST endpoints (`/api/v1/llm/test`) allow isolated verification of AI providers.
3.  **Config Hotswapping**: Providers and specific models (e.g., Gemini 2.0 Flash) are updated in the `AgenticBrain` instance during active WebSocket sessions.

---
> [!NOTE]
> **Status**: **STABLE**. End-to-end flow verified via WebSocket simulator and REST test suite.

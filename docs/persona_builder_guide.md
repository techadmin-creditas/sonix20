# Persona Builder Guide: Crafting the Perfect Voice Identity

This guide outlines the standards and best practices for creating AI personas on the Sonix20 platform.

## 1. The Anatomy of a Persona

A persona is a multi-dimensional configuration that dictates how an agent speaks, feels, and interacts.

### A. Core Identity (LLM Context)
- **Role**: The professional title (e.g., "Collections Specialist", "Concierge").
- **Persona Description**: 1-2 sentences on the "vibe" (e.g., "Compassionate but firm, speaks in clear Hinglish").
- **System Prompt**: Actionable instructions.
  - **Pro Tip**: Always end the prompt with: *"Always keep your responses under 2 sentences and end with an engaging question."*

### B. Voice & Prosody (TTS)
- **Provider Choice**:
  - **ElevenLabs**: Best for high-fidelity, emotional, and long-form responses.
  - **Deepgram Aura**: Best for ultra-low latency FAQ style bots.
- **Voice Selection**:
  - `EXAVITQu4vr4xnSDxMaL` (Sarah): Native Hindi, gentle tone.
  - `aura-stella-en` (Hinglish): Energetic, mixed-language specialist.
- **Tuning Parameters**:
  - `Stability` (ElevenLabs): High (0.8+) for consistent tone; Low (<0.4) for more emotional variance.

### C. Conversation Policy (Real-time Tuning)
- **Wait Window (`stt_endpointing_ms`)**: 
  - **Fast (300ms)**: For assertive bots (Collections).
  - **Natural (800ms)**: For customer service where users might pause to think.
- **Flush Threshold (`first_segment_chars`)**: Set to `10-15` to ensure the bot starts speaking the moment the first few words are generated.

---

## 2. Competitive Edge: Hinglish Mastery

To achieve professional Hinglish:
1. **Script Mixing**: Use Latin script for common technical terms (e.g., "EMI", "Invoice", "App") and Devanagari or simplified phonetics for Hindi connectors.
2. **Filler Management**: Ensure the `AgenticBrain` uses quick "Umm..." or "Ji..." fillers for latency bridging.

## 3. Testing Workflow

Before deploying to production, every persona must pass the following benchmarks:
1. **Pronunciation Lab**: Use `scripts/voice_lab_compare.py` to check how the voice says local currency terms (e.g., "Lakhs", "Crores").
2. **Stress Test**: Run the `data/voice_stress_corpus.json` through the persona.
3. **Guardrail Simulation**: Test if the bot remains in persona when asked about competitors or unrelated topics.

---

## 4. Example Configuration (Collections Persona)

```json
{
  "name": "Arjun - Debt Management",
  "role": "Senior Collections Officer",
  "tts_provider": "elevenlabs",
  "voice_id": "zEvjs17jNQ2fH5FxAat2",
  "stt_endpointing_ms": 350,
  "system_prompt": "You are Arjun, a respectful Collections officer for Creditas. Your goal is to help users manage their EMI defaults...",
  "default_language": "hi"
}
```

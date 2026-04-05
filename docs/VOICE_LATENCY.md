# Voice pipeline latency

## Measuring

- **LLM**: Logs include `LLM request profile: system_prompt_chars=… context_chars=…` on each main turn and `LLM TTFT` when the first token arrives. Large `system_prompt_chars` often correlates with slower time-to-first-token.
- **STT**: `STT Latency: … [Final Received]` measures time from the last non-final partial to the final for the same utterance (avoids inflated numbers from late duplicate finals).

## Faster first reply (typical order)

1. **LLM provider**: Prefer a low-latency direct API for real-time voice (for example Groq with a small/fast model). OpenRouter adds routing overhead; use it as fallback when configured via `voice_llm_factory` fallbacks.
2. **Prompt size**: Trim DB `system_prompt`, RAG snippets, and tool safety blocks where safe. Watch `system_prompt_chars` in logs after changes.
3. **Latency watchdog filler**: `conversation_policy.llm_latency_watchdog_sec` (default `0.5`) controls when a filler line is injected if the LLM is slow. Set to `0` to disable fillers; raise to `1.5`–`2.0` if a slow primary model often causes double speech (filler + real reply).
4. **TTS**: Tune `max_tts_buffer_chars` and `tts_flush_mode` in `conversation_policy` for earlier first audio chunk.

## `conversation_policy` keys (this workstream)

| Key | Purpose |
|-----|---------|
| `proactive_silence_sec` | Seconds of silence before “still there?” (default 10). |
| `proactive_grace_after_bot_sec` | Extra seconds after bot speech before that countdown starts. |
| `proactive_after_user_turns` | Minimum completed user turns before proactive prompts run (e.g. `1` skips until after first user reply). |
| `llm_latency_watchdog_sec` | Filler injection threshold; `0` disables. |
| `stt_language_mode` | `hinglish` / `multilingual` / `detect` / `auto` → Deepgram streaming `language=multi` (code-switching). |
| `stt_endpointing_ms` | Deepgram endpointing 100–500 (default 150). |
| `stt_rms_vad_threshold` | Local RMS gate (int16 units) before sending PCM to Deepgram; default ~280. Lower (e.g. 200) if the UI mic is quiet and you see `speech_started` but no transcripts. |
| `language_style` | `hinglish` → system prompt and default proactive wording favor code-mixed Hindi–English. |

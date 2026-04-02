"""
OpenRouter Streaming LLM Provider.

OpenRouter exposes a unified OpenAI-compatible endpoint that routes to 300+
models (Claude, GPT-4o, Llama, Gemini, Mistral, …) across 60+ providers.

Base URL : https://openrouter.ai/api/v1
Auth     : Bearer OPENROUTER_API_KEY
Models   : use the "provider/model" slug, e.g.
             anthropic/claude-3.5-sonnet
             openai/gpt-4o
             meta-llama/llama-3.1-70b-instruct
             google/gemini-2.0-flash-001
             mistralai/mistral-large

The wire protocol is identical to OpenAI Chat Completions, so the standard
openai Python SDK works out-of-the-box with a custom base_url.
"""

from __future__ import annotations

import json
import logging
import re as _re
import time
from typing import Any, AsyncIterator, List, Optional

from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.models.tools import LLMResponse, ToolCall, ToolDefinition

logger = setup_logger("llm-openrouter", level="INFO")
settings = get_settings()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
# Sent in HTTP-Referer so OpenRouter can attribute usage in their dashboard.
APP_SITE_URL = "https://sonix.creditas.ai"
APP_NAME = "Sonix VoiceBot"


class OpenRouterStreamingProvider:
    """
    Async streaming LLM provider backed by OpenRouter.

    Drop-in replacement for GroqStreamingProvider / OpenAIStreamingProvider.
    Supports all models available on https://openrouter.ai/models.

    Usage (bot config):
        llm_provider = "openrouter"
        llm_model    = "anthropic/claude-3.5-sonnet"   # any OpenRouter slug

    Or auto-detected when llm_model contains a forward slash:
        llm_model = "meta-llama/llama-3.1-70b-instruct"
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ):
        self.api_key = api_key or settings.openrouter_api_key
        if self.api_key:
            logger.info(
                "OpenRouter provider initialised  key=%s...%s  model=%s",
                self.api_key[:8],
                self.api_key[-4:],
                model,
            )
        else:
            logger.error("OpenRouter initialised with MISSING key — set OPENROUTER_API_KEY in .env")

        self.model = model or settings.openrouter_default_model or "meta-llama/llama-3.3-70b-instruct"
        self.max_tokens = max_tokens or 1024
        self.temperature = temperature if temperature is not None else 0.7
        self.provider = "openrouter"
        self._client = None

    # ------------------------------------------------------------------ #
    #  Internal                                                            #
    # ------------------------------------------------------------------ #

    async def _get_client(self):
        """Lazy-initialise the AsyncOpenAI client pointed at OpenRouter."""
        if self._client is None:
            from openai import AsyncOpenAI

            if not self.api_key:
                raise ValueError("OPENROUTER_API_KEY is required — add it to your .env file.")

            extra_headers: dict[str, str] = {
                "HTTP-Referer": APP_SITE_URL,
                "X-Title": APP_NAME,
            }
            # Anthropic prompt caching — passes through OpenRouter when the
            # model slug starts with "anthropic/".  Cached system-prompt tokens
            # cost 10% of normal input price (90% discount), refreshed every 5 min.
            if self.model.startswith("anthropic/"):
                extra_headers["anthropic-beta"] = "prompt-caching-2024-07-31"

            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=OPENROUTER_BASE_URL,
                default_headers=extra_headers,
            )
        return self._client

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncIterator[LLMResponse]:
        """
        Stream tokens from OpenRouter.

        Yields LLMResponse objects — identical contract to every other
        LLM provider in this codebase so the Brain can use it transparently.
        """
        client = await self._get_client()

        # For Anthropic models: wrap the system message in the content-array format
        # with cache_control so Anthropic caches it for 5 minutes.
        # OpenRouter passes this through transparently.
        # Non-Anthropic models receive a plain string — no change in behaviour.
        if self.model.startswith("anthropic/") and system_prompt:
            system_msg: dict[str, Any] = {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        else:
            system_msg = {"role": "system", "content": system_prompt}

        full_messages = [system_msg]
        full_messages.extend(messages)

        # Convert ToolDefinition → OpenAI function-calling schema
        openai_tools = []
        if tools:
            for t in tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                })

        start_time = time.time()
        first_token = True
        active_tool_calls: dict[int, dict[str, Any]] = {}

        try:
            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": full_messages,
                "temperature": temperature or self.temperature,
                "max_tokens": max_tokens or self.max_tokens,
                "stream": True,
                "stream_options": {"include_usage": True},
            }
            if openai_tools:
                kwargs["tools"] = openai_tools
                kwargs["tool_choice"] = "auto"

            stream = await client.chat.completions.create(**kwargs)

            async for chunk in stream:
                # Usage block (usually in final chunk with no choices)
                if hasattr(chunk, "usage") and chunk.usage:
                    yield LLMResponse(usage={
                        "prompt_tokens":      chunk.usage.prompt_tokens,
                        "completion_tokens":  chunk.usage.completion_tokens,
                        "total_tokens":       chunk.usage.total_tokens,
                    })

                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # 1. Text content
                if delta and delta.content:
                    if first_token:
                        ttft = (time.time() - start_time) * 1000
                        logger.info("OpenRouter TTFT: %.0fms  model=%s", ttft, self.model)
                        first_token = False
                    yield LLMResponse(content=delta.content)

                # 2. Tool call deltas
                if delta and delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in active_tool_calls:
                            active_tool_calls[idx] = {
                                "id":   tc_delta.id,
                                "name": tc_delta.function.name,
                                "args": "",
                            }
                        if tc_delta.function.arguments:
                            active_tool_calls[idx]["args"] += tc_delta.function.arguments

                # 3. Finish reason
                finish = chunk.choices[0].finish_reason
                if finish:
                    if finish == "tool_calls":
                        results: list[ToolCall] = []
                        for tc in active_tool_calls.values():
                            try:
                                args = json.loads(tc["args"]) if tc["args"] else {}
                                results.append(ToolCall(id=tc["id"], name=tc["name"], arguments=args))
                            except Exception as parse_err:
                                logger.warning("OpenRouter tool arg parse error: %s", parse_err)
                        if results:
                            yield LLMResponse(tool_calls=results)

                    total_ms = (time.time() - start_time) * 1000
                    logger.debug("OpenRouter completion: %.0fms  reason=%s  model=%s", total_ms, finish, self.model)
                    break

        except Exception as e:
            from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError
            err_str = str(e)

            # ── 401 Authentication Failure ──────────────────────────────────────
            if "401" in err_str or "unauthorized" in err_str.lower():
                raise AuthError(f"OpenRouter authentication failed: {err_str}")

            # ── 402 Insufficient credits ───────────────────────────────────────
            # Case 1: OpenRouter error "You requested up to N tokens, but can only afford M."
            # We now bail instead of retrying to ensure the user knows their session is expired.
            if "402" in err_str or "can only afford" in err_str:
                raise ServiceExhaustedError("OpenRouter usage limit or credit quota reached.")

            # ── 429 Rate Limit / Global Usage Limit ──────────────────────────────
            if "429" in err_str or "rate limit" in err_str.lower():
                raise ServiceExhaustedError("OpenRouter rate limit or usage quota exceeded.")

            logger.error("OpenRouter streaming error: %s", e, exc_info=True)
            # Forward generic errors as VoiceBotError to trigger UI closure
            raise VoiceBotError(f"OpenRouter reported an error: {err_str[:100]}")

    async def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> str:
        """Non-streaming completion (used by summariser, intent tagger, etc.)."""
        client = await self._get_client()
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages)
        response = await client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )
        return response.choices[0].message.content or ""

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
        logger.info("OpenRouter provider disconnected")

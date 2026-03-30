"""
OpenAI Streaming LLM Provider.

Provides async streaming token generation using OpenAI's chat completions API.
Optimized for ultra-low latency with:
  - Streaming response (SSE)
  - Token-by-token output for immediate TTS piping
  - Prompt caching via system prompt reuse
  - Configurable temperature and max tokens

Typical TTFT (Time to First Token): ~300-500ms.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncIterator, Optional, List
from voicebot.shared.models.tools import ToolCall, ToolDefinition, LLMResponse

from voicebot.shared.config import get_settings

logger = logging.getLogger("llm-openai")
settings = get_settings()


class OpenAIStreamingProvider:
    """
    Async streaming interface to OpenAI's Chat Completions API.

    Usage:
        provider = OpenAIStreamingProvider()
        async for token in provider.stream_completion(
            system_prompt="You are a helpful assistant.",
            messages=[{"role": "user", "content": "Hello"}],
        ):
            print(token, end="", flush=True)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ):
        self.api_key = api_key or settings.openai_api_key
        self.model = model or settings.openai_model or "gpt-4o"
        self.max_tokens = max_tokens or 1024
        self.temperature = temperature if temperature is not None else 0.7
        self._client = None

    async def _get_client(self):
        """Lazy-initialize the async OpenAI client."""
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.api_key)
        return self._client

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncIterator[LLMResponse]:
        """
        Stream tokens from OpenAI's Chat Completions API.

        Args:
            system_prompt: System-level instruction for the model
            messages: Conversation history (list of {role, content})
            temperature: Model temperature (overrides default)
            max_tokens: Max output tokens (overrides default)

        Yields:
            str: Individual tokens/chunks from the model
        """
        client = await self._get_client()

        # Construct the full message list
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages)

        start_time = time.time()
        first_token = True

        # Convert tools to OpenAI format
        openai_tools = []
        if tools:
            for t in tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    }
                })

        try:
            stream = await client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                tools=openai_tools or None,
                tool_choice="auto" if tools else None,
                temperature=temperature or self.temperature,
                max_tokens=max_tokens or self.max_tokens,
                stream=True,
                presence_penalty=0.1,
                frequency_penalty=0.1,
            )

            # Keep track of multiple tool calls in progress
            # OpenAI streams tool calls by index
            active_tool_calls: dict[int, dict[str, Any]] = {}

            async for chunk in stream:
                if not chunk.choices: continue
                delta = chunk.choices[0].delta
                
                # 1. Handle Text
                if delta and delta.content:
                    if first_token:
                        ttft = (time.time() - start_time) * 1000
                        logger.debug("LLM TTFT: %.0fms (model=%s)", ttft, self.model)
                        first_token = False
                    yield LLMResponse(content=delta.content)

                # 2. Handle Tool Calls delta
                if delta and delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in active_tool_calls:
                            active_tool_calls[idx] = {"id": tc_delta.id, "name": tc_delta.function.name, "args": ""}
                        
                        if tc_delta.function.arguments:
                            active_tool_calls[idx]["args"] += tc_delta.function.arguments

                # Check for stop signal or completion of tool calls
                if chunk.choices[0].finish_reason:
                    # If we finished because of tool calls, yield them all at once
                    if chunk.choices[0].finish_reason == "tool_calls":
                        results = []
                        import json
                        for tc in active_tool_calls.values():
                            try:
                                args = json.loads(tc["args"]) if tc["args"] else {}
                                results.append(ToolCall(id=tc["id"], name=tc["name"], arguments=args))
                            except Exception as e:
                                logger.warning("Failed to parse OpenAI tool call args: %s", e)
                        
                        if results:
                            yield LLMResponse(tool_calls=results)

                    total_time = (time.time() - start_time) * 1000
                    logger.debug("LLM completed: %.0fms, reason=%s", total_time, chunk.choices[0].finish_reason)
                    break

        except Exception as e:
            logger.error("OpenAI streaming error: %s", e, exc_info=True)
            yield LLMResponse(content="I'm sorry, I encountered an error. Could you repeat that?")

    async def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> str:
        """
        Non-streaming completion (for use cases where full response is needed).
        """
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
        """Clean up the client."""
        if self._client:
            await self._client.close()
            self._client = None
        logger.info("OpenAI provider disconnected")

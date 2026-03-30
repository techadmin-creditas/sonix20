"""
Groq Streaming LLM Provider.

Provides ultra-fast async streaming token generation using Groq's API.
Compatible with OpenAI's Chat Completions format but uses the 'groq' SDK.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncIterator, Optional, List
from voicebot.shared.models.tools import ToolCall, ToolDefinition, LLMResponse

from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("llm-groq", level="INFO")
settings = get_settings()


class GroqStreamingProvider:
    """
    Async streaming interface to Groq's Chat Completions API.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ):
        self.api_key = api_key or settings.groq_api_key
        # Debug: confirm load
        if self.api_key:
            logger.info("Groq Provider initialized with key: %s...%s", self.api_key[:5], self.api_key[-4:])
        else:
            logger.error("Groq Provider initialized with MISSING key!")
        self.model = model or settings.groq_model or "llama3-70b-8192"
        self.max_tokens = max_tokens or 1024
        self.temperature = temperature if temperature is not None else 0.7
        self._client = None

    async def _get_client(self):
        """Lazy-initialize the async Groq client."""
        if self._client is None:
            from groq import AsyncGroq
            if not self.api_key:
                logger.error("Groq API Key missing. Please set GROQ_API_KEY in .env")
                raise ValueError("GROQ_API_KEY is required")
            self._client = AsyncGroq(api_key=self.api_key)
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
        Stream tokens from Groq's Chat Completions API.
        """
        client = await self._get_client()

        # Construct message list (merge system prompt)
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages)

        start_time = time.time()
        first_token = True

        # Convert tool definitions to Groq (OpenAI) format
        groq_tools = []
        if tools:
            for t in tools:
                groq_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    }
                })

        try:
            kwargs = {
                "model": self.model,
                "messages": full_messages,
                "temperature": temperature or self.temperature,
                "max_tokens": max_tokens or self.max_tokens,
                "stream": True,
            }
            if groq_tools:
                kwargs["tools"] = groq_tools
                kwargs["tool_choice"] = "auto"

            stream = await client.chat.completions.create(**kwargs)

            active_tool_calls: dict[int, dict[str, Any]] = {}

            async for chunk in stream:
                if not chunk.choices: continue
                delta = chunk.choices[0].delta
                
                # 1. Handle Text Content
                if delta and delta.content:
                    if first_token:
                        ttft = (time.time() - start_time) * 1000
                        logger.info("Groq TTFT: %.0fms (model=%s)", ttft, self.model)
                        first_token = False
                    yield LLMResponse(content=delta.content)

                # 2. Handle Tool Call Delta
                if delta and delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in active_tool_calls:
                            active_tool_calls[idx] = {
                                "id": tc_delta.id,
                                "name": tc_delta.function.name,
                                "args": ""
                            }
                        if tc_delta.function.arguments:
                            active_tool_calls[idx]["args"] += tc_delta.function.arguments

                # Finalize turn
                if chunk.choices[0].finish_reason:
                    if chunk.choices[0].finish_reason == "tool_calls":
                        results = []
                        import json
                        for tc in active_tool_calls.values():
                            try:
                                args = json.loads(tc["args"]) if tc["args"] else {}
                                results.append(ToolCall(id=tc["id"], name=tc["name"], arguments=args))
                            except Exception as e:
                                logger.warning("Groq tool arg parse error: %s", e)
                        
                        if results:
                            yield LLMResponse(tool_calls=results)

                    total_time = (time.time() - start_time) * 1000
                    logger.debug("Groq completion: %.0fms, reason=%s", total_time, chunk.choices[0].finish_reason)
                    break

        except Exception as e:
            logger.error("Groq streaming error: %s", e, exc_info=True)
            # Explicit print to catch in uvicorn logs regardless of logger config
            print(f"\033[91m[GROQ ERROR]\033[0m {e}")
            yield LLMResponse(content="Error reaching Groq. Check your API key and limits.")

    async def disconnect(self) -> None:
        """Clean up the client strictly."""
        if self._client:
            await self._client.close()
            self._client = None
        logger.info("Groq provider disconnected")

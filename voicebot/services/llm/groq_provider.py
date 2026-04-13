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
from voicebot.shared.utils.validation import is_valid_api_key
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError

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
        # 🛡️ Robustness: Strip trailing comments/whitespace if accidentally loaded from .env
        if self.api_key:
            self.api_key = self.api_key.split('#')[0].split(' ')[0].strip()
            
        # Debug: confirm load
        if self.api_key:
            logger.info("Groq Provider initialized with key: %s...%s (len=%d)", 
                        self.api_key[:5], self.api_key[-4:], len(self.api_key))
        else:
            logger.error("Groq Provider initialized with MISSING key!")
        self.model = model or settings.groq_model or "llama3-70b-8192"
        self.max_tokens = max_tokens or 1024
        self.temperature = temperature if temperature is not None else 0.7
        self._client = None
        self.provider = "groq"

    async def _get_client(self):
        """Lazy-initialize the async Groq client."""
        if self._client is None:
            from groq import AsyncGroq
            if not is_valid_api_key(self.api_key):
                logger.error("🚫 Groq API Key is invalid or a placeholder.")
                raise AuthError(f"Groq API Key is a placeholder or invalid.")
            self._client = AsyncGroq(api_key=self.api_key)
        return self._client

    async def warm(self) -> None:
        """
        Pre-establish TLS connection and warm up the client.
        Fires a tiny zero-token request to prime the provider's connection pool.
        """
        try:
            client = await self._get_client()
            # Minimal "ping" completion to establish a warm TCP/TLS pool
            # We use a very low temperature and max_tokens=1 for speed.
            await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "."}],
                max_tokens=1,
                temperature=0.0
            )
            logger.info("🚀 Groq client pre-warmed (Connection Pool active)")
        except Exception as e:
            logger.debug("Groq pre-warm failed (non-critical): %s", e)

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
        
        # 🛡️ Message Transformation: Ensure OpenAI/Groq compatibility for tool calls in history
        import json
        transformed_messages = []
        for m in messages:
            new_msg = m.copy()
            # 1. Format Assistant Tool Calls
            if new_msg.get("role") == "assistant" and new_msg.get("tool_calls"):
                legacy_calls = new_msg.pop("tool_calls")
                new_calls = []
                for tc in legacy_calls:
                    # Map from internal flat model to OpenAI structured model
                    new_calls.append({
                        "id": tc.get("id"),
                        "type": "function",
                        "function": {
                            "name": tc.get("name"),
                            "arguments": json.dumps(tc.get("arguments")) if isinstance(tc.get("arguments"), dict) else (tc.get("arguments") or "{}")
                        }
                    })
                new_msg["tool_calls"] = new_calls
            
            # 2. Ensure Tool Results have correct fields
            if new_msg.get("role") == "tool":
                # OpenAI/Groq expects 'tool_call_id'
                if "tool_call_id" not in new_msg and "id" in new_msg:
                    new_msg["tool_call_id"] = new_msg.pop("id")
            
            transformed_messages.append(new_msg)

        full_messages.extend(transformed_messages)

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
                # Handle usage data (usually in final chunk with null choices)
                if hasattr(chunk, "usage") and chunk.usage:
                    yield LLMResponse(usage={
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens
                    })

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
            # 🛡️ Groq-Specific Fail-Safe: Detail tool-calling errors (Phase 2)
            # If the model hallucinations a tool call but messes up the format, Groq
            # throws an APIError with a 'failed_generation' body.
            error_details = str(e)
            
            # Groq SDK errors often store the response body in .body or .response.json()
            try:
                if hasattr(e, "body") and isinstance(e.body, dict):
                    failed_gen = e.body.get("failed_generation")
                    if failed_gen:
                        error_details = f"{e} | FAILED GENERATION: {failed_gen}"
                elif hasattr(e, "response") and hasattr(e.response, "json"):
                    data = e.response.json()
                    if isinstance(data, dict) and data.get("error", {}).get("failed_generation"):
                        error_details = f"{e} | FAILED GENERATION: {data['error']['failed_generation']}"
            except Exception:
                pass
            
            logger.error("Groq streaming error: %s", error_details, exc_info=True)
            
            if "404" in error_details or "not exist" in error_details or "not found" in error_details:
                raise VoiceBotError(f"Groq Model NotFound: The model '{self.model}' is not available on Groq.")
            if "401" in error_details or "unauthorized" in error_details:
                raise AuthError(f"Groq API Key invalid: {e}")
            if "429" in error_details or "rate limit" in error_details or "quota" in error_details:
                raise ServiceExhaustedError("Groq rate limit reached or quota exhausted.")
                
            raise VoiceBotError(f"Groq report: {error_details[:200]}")


    async def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> str:
        """Non-streaming completion for reflection and analysis."""
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
        """Clean up the client strictly."""
        if self._client:
            await self._client.close()
            self._client = None
        logger.info("Groq provider disconnected")

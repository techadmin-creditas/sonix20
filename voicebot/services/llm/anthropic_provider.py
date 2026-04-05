"""
Anthropic Claude Streaming LLM Provider.

Implements the same stream_completion interface as OpenAI/Groq/Gemini providers
so it can be hot-swapped at runtime via the dynamic `config` WebSocket message.

Recommended model for low-latency voice turns: claude-haiku-4-20250514
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator, List, Optional

from voicebot.shared.config import get_settings
from voicebot.shared.utils.validation import is_valid_api_key
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError
from voicebot.shared.models.tools import LLMResponse, ToolCall, ToolDefinition

logger = setup_logger("llm-anthropic", level="INFO")
settings = get_settings()


class AnthropicStreamingProvider:
    """
    Anthropic Claude provider with streaming support.

    Supports:
    - Streaming text responses (stream_completion)
    - Tool/function calling (OpenAI-compatible tool definitions are translated)
    - Non-streaming single-call complete()
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 1024,
    ):
        self.api_key = api_key or settings.anthropic_api_key
        self.max_tokens = max_tokens
        self._client = None
        self.provider = "anthropic"
        self.model = model or settings.anthropic_model or "claude-haiku-4-20250514"

    async def _get_client(self):
        """Lazily initialize the Anthropic async client."""
        if self._client is None:
            try:
                if not is_valid_api_key(self.api_key):
                    logger.error("🚫 Anthropic API Key is invalid or a placeholder.")
                    raise AuthError(f"Anthropic API Key is a placeholder or invalid.")
                    
                from anthropic import AsyncAnthropic
                self._client = AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                raise RuntimeError(
                    "anthropic package not installed. Run: pip install anthropic"
                )
        return self._client

    def _translate_tools(
        self, tools: Optional[List[ToolDefinition]]
    ) -> Optional[list]:
        """Translate OpenAI-style ToolDefinition list to Anthropic tool format."""
        if not tools:
            return None
        result = []
        for tool in tools:
            params = tool.parameters or {}
            result.append({
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": {
                    "type": "object",
                    "properties": params.get("properties", {}),
                    "required": params.get("required", []),
                },
            })
        return result or None

    async def stream_completion(
        self,
        system_prompt: str = "",
        messages: Optional[List[dict]] = None,
        tools: Optional[List[ToolDefinition]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncIterator[LLMResponse]:
        """
        Stream completion from Claude. Yields LLMResponse objects compatible
        with the existing brain.py streaming loop.
        """
        client = await self._get_client()
        # 🛡️ Message Transformation: Ensure Anthropic compatibility for tool calls in history
        import json
        transformed_messages = []
        for m in messages or []:
            new_msg = m.copy()
            role = new_msg.get("role")
            
            # 1. Format Assistant Tool Calls (Anthropic uses content-block list)
            if role == "assistant" and new_msg.get("tool_calls"):
                legacy_calls = new_msg.pop("tool_calls")
                content = []
                if new_msg.get("content"):
                    content.append({"type": "text", "text": new_msg.pop("content")})
                
                for tc in legacy_calls:
                    content.append({
                        "type": "tool_use",
                        "id": tc.get("id"),
                        "name": tc.get("name"),
                        "input": tc.get("arguments") if isinstance(tc.get("arguments"), dict) else json.loads(tc.get("arguments") or "{}")
                    })
                new_msg["content"] = content
            
            # 2. Format Tool Results (Anthropic uses content-block list with role='user')
            elif role == "tool":
                # Anthropic doesn't have a 'tool' role; it uses 'user' role with 'tool_result' block
                new_msg["role"] = "user"
                new_msg["content"] = [{
                    "type": "tool_result",
                    "tool_use_id": new_msg.pop("tool_call_id") or new_msg.pop("id", ""),
                    "content": new_msg.pop("content", "")
                }]
            
            transformed_messages.append(new_msg)

        _messages = transformed_messages
        _max_tokens = max_tokens or self.max_tokens
        _temperature = temperature if temperature is not None else 0.7

        anthropic_tools = self._translate_tools(tools)

        try:
            kwargs_extra: dict = {}
            if anthropic_tools:
                kwargs_extra["tools"] = anthropic_tools

            async with client.messages.stream(
                model=self.model,
                system=system_prompt or "",
                messages=_messages,
                max_tokens=_max_tokens,
                temperature=_temperature,
                **kwargs_extra,
            ) as stream:
                pending_tool_calls: list[dict] = []
                current_tool: dict = {}
                usage_stats = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

                async for event in stream:
                    event_type = type(event).__name__

                    # Capture usage from message start or delta
                    if hasattr(event, "message") and hasattr(event.message, "usage"):
                        usage_stats["prompt_tokens"] = event.message.usage.input_tokens
                        usage_stats["completion_tokens"] = event.message.usage.output_tokens
                    elif hasattr(event, "usage"):
                        # In delta events, output_tokens are provided
                        usage_stats["completion_tokens"] = event.usage.output_tokens

                    # Text delta
                    if event_type == "RawContentBlockDeltaEvent":
                        delta = getattr(event, "delta", None)
                        if delta and getattr(delta, "type", "") == "text_delta":
                            yield LLMResponse(content=delta.text, tool_calls=[])

                    # Tool use block start
                    elif event_type == "RawContentBlockStartEvent":
                        block = getattr(event, "content_block", None)
                        if block and getattr(block, "type", "") == "tool_use":
                            current_tool = {
                                "id": block.id,
                                "name": block.name,
                                "input_json": "",
                            }

                    # Tool input delta (JSON streaming)
                    elif event_type == "RawContentBlockDeltaEvent":
                        delta = getattr(event, "delta", None)
                        if delta and getattr(delta, "type", "") == "input_json_delta":
                            current_tool["input_json"] = (
                                current_tool.get("input_json", "") + delta.partial_json
                            )

                    # Tool block stop
                    elif event_type == "RawContentBlockStopEvent":
                        if current_tool.get("name"):
                            import json as _json
                            try:
                                args = _json.loads(current_tool.get("input_json", "{}"))
                            except Exception:
                                args = {}
                            pending_tool_calls.append(
                                ToolCall(
                                    id=current_tool.get("id", ""),
                                    name=current_tool["name"],
                                    arguments=args,
                                )
                            )
                            current_tool = {}

                # Emit cumulative usage
                usage_stats["total_tokens"] = usage_stats["prompt_tokens"] + usage_stats["completion_tokens"]
                yield LLMResponse(usage=usage_stats)

                # Emit accumulated tool calls at end of stream
                if pending_tool_calls:
                    yield LLMResponse(content="", tool_calls=pending_tool_calls)

        except Exception as e:
            err_str = str(e).lower()
            logger.error("Anthropic streaming error: %s", e)
            
            if "401" in err_str or "unauthorized" in err_str:
                raise AuthError(f"Anthropic API key invalid: {e}")
            if "429" in err_str or "rate limit" in err_str or "overloaded" in err_str:
                raise ServiceExhaustedError("Anthropic rate limit or quota exceeded.")
                
            raise VoiceBotError(f"Anthropic error: {str(e)[:100]}")

    async def complete(
        self,
        system_prompt: str = "",
        messages: Optional[List[dict]] = None,
        max_tokens: int = 256,
        **kwargs: Any,
    ) -> str:
        """Non-streaming single-turn completion (for classifiers, summarizers)."""
        client = await self._get_client()
        try:
            response = await client.messages.create(
                model=self.model,
                system=system_prompt,
                messages=messages or [],
                max_tokens=max_tokens,
            )
            return response.content[0].text if response.content else ""
        except Exception as e:
            logger.error("Anthropic complete() error: %s", e)
            return ""

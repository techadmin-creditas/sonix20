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
from voicebot.shared.models.tools import LLMResponse, ToolCall, ToolDefinition

logger = logging.getLogger("llm-anthropic")
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
        self.model = model or settings.anthropic_model or "claude-haiku-4-20250514"
        self.max_tokens = max_tokens
        self._client = None

    async def _get_client(self):
        """Lazily initialize the Anthropic async client."""
        if self._client is None:
            try:
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
        _messages = messages or []
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

                async for event in stream:
                    event_type = type(event).__name__

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

                # Emit accumulated tool calls at end of stream
                if pending_tool_calls:
                    yield LLMResponse(content="", tool_calls=pending_tool_calls)

        except Exception as e:
            logger.error("Anthropic streaming error: %s", e)
            yield LLMResponse(
                content="I'm sorry, I encountered an error. Please try again.",
                tool_calls=[],
            )

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

"""
Gemini Streaming LLM Provider (Modern).

Uses the NEW Google genai SDK (google-genai) for low-latency streaming completions,
with support for Gemini 2.0 Flash features (realtime, tool calls, and usage).
"""

from __future__ import annotations

import logging
import time
import uuid
import json
from typing import AsyncIterator, Optional, List, Dict, Any

from google import genai
from google.genai import types

from voicebot.shared.config import get_settings
from voicebot.shared.models.tools import ToolCall, ToolDefinition, LLMResponse
from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError

logger = logging.getLogger("llm-gemini")
settings = get_settings()


class GeminiStreamingProvider:
    """
    Modern Async streaming interface to Google Gemini models using the google-genai SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ):
        self.api_key = api_key or settings.gemini_api_key
        # Use a reliable default
        self.model_name = model or "gemini-2.5-flash"
        self.temperature = temperature if temperature is not None else 0.7
        self.max_output_tokens = max_tokens if max_tokens is not None else 1024
        
        # Lazy client initialization
        self._client: Optional[genai.Client] = None
        self.provider = "gemini"

    def _get_client(self) -> genai.Client:
        """Initialize the genai client if needed."""
        if self._client is None:
            if not self.api_key:
                raise AuthError("GEMINI_API_KEY is missing in settings.")
            
            self._client = genai.Client(
                api_key=self.api_key,
                http_options={'api_version': 'v1beta'} # Needed for some 2.0 features
            )
        return self._client

    async def stream_completion(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **_: Any,
    ) -> AsyncIterator[LLMResponse]:
        """
        Stream a completion from Gemini using the modern google-genai SDK.
        """
        client = self._get_client()
        
        # 1. Construct Contents (History + Latest)
        # Gemini expects the full history including the "latest" user message
        contents = []
        
        # Add system prompt as a user message if it's the beginning? 
        # Actually Google recommends using 'system_instruction' in config.
        # But we'll follow our pipeline's pattern:
        
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
            
        # 2. Build Config (System Prompt + Tools + Params)
        gemini_tools = []
        if tools:
            # New SDK tool format
            function_declarations = []
            for t in tools:
                function_declarations.append(types.FunctionDeclaration(
                    name=t.name,
                    description=t.description,
                    parameters=t.parameters
                ))
            gemini_tools = [types.Tool(function_declarations=function_declarations)]

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=gemini_tools or None,
            temperature=temperature if temperature is not None else self.temperature,
            max_output_tokens=max_tokens if max_tokens is not None else self.max_output_tokens,
            # Streaming options like including usage
        )

        start_time = time.time()
        first_token = True

        try:
            # 3. Call Streaming API (Async)
            # aio.models.generate_content_stream
            async for chunk in await client.aio.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=config
            ):
                # 4. Handle Content Chunks
                # A chunk can have text or tool calls
                if not chunk.candidates:
                    continue
                
                candidate = chunk.candidates[0]
                if not candidate.content or not candidate.content.parts:
                    continue

                for part in candidate.content.parts:
                    # Case A: Text
                    if part.text:
                        if first_token:
                            ttft = (time.time() - start_time) * 1000
                            logger.info("Gemini TTFT: %.0fms (model=%s)", ttft, self.model_name)
                            first_token = False
                        yield LLMResponse(content=part.text)
                    
                    # Case B: Tool Call
                    if part.function_call:
                        call = part.function_call
                        tool_call = ToolCall(
                            id=str(uuid.uuid4())[:8],
                            name=call.name,
                            arguments=call.args
                        )
                        logger.info("⚡ Gemini emitted tool call: %s(%s)", tool_call.name, tool_call.arguments)
                        yield LLMResponse(tool_calls=[tool_call])

            # 5. Handle Final Usage (Metadata)
            # Usage is typically on the final chunk of the response iterator
            # but we can also extract it from the response object if available.
            # Most modern SDK chunks include metadata.
            if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                yield LLMResponse(usage={
                    "prompt_tokens": chunk.usage_metadata.prompt_token_count,
                    "completion_tokens": chunk.usage_metadata.candidates_token_count,
                    "total_tokens": chunk.usage_metadata.total_token_count
                })

        except Exception as e:
            err_str = str(e).lower()
            logger.error("Gemini (Modern) streaming error: %s", e)
            
            if "401" in err_str or "unauthorized" in err_str:
                raise AuthError(f"Gemini API key invalid: {e}")
            if "429" in err_str or "quota" in err_str or "exhausted" in err_str:
                raise ServiceExhaustedError("Gemini quota or rate limit exceeded.")
                
            raise VoiceBotError(f"Gemini reported an error: {str(e)[:100]}")

    async def complete(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
    ) -> str:
        """
        Non-streaming completion (Synchronous API style but async).
        """
        client = self._get_client()
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
            
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=self.temperature,
            max_output_tokens=self.max_output_tokens,
        )
        
        response = await client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config
        )
        
        return response.text or ""

    async def disconnect(self) -> None:
        """Cleanup. Nothing specific needed for current SDK."""
        self._client = None
        logger.info("Gemini provider disconnected")

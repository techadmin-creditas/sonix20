"""
Gemini Streaming LLM Provider.

Uses Google's generative AI SDK for low-latency streaming completions.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Optional, List, Dict, Any
from voicebot.shared.models.tools import ToolCall, ToolDefinition, LLMResponse

from voicebot.shared.config import get_settings

logger = logging.getLogger("llm-gemini")
settings = get_settings()


class GeminiStreamingProvider:
    """
    Async streaming interface to Google Gemini models.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-flash-latest",
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ):
        self.api_key = api_key or (settings.gemini_api_key if settings.gemini_api_key else settings.openai_api_key)
        self.model_name = model or "gemini-flash-latest"
        self.temperature = temperature
        self.max_output_tokens = max_tokens
        self._gen_model = None
        self.provider = "gemini"

    async def _get_model(self, tools: Optional[List[ToolDefinition]] = None):
        # Hash tools to check for changes
        import hashlib
        import json
        
        tool_json = ""
        if tools:
            tool_json = json.dumps([{"name": t.name, "description": t.description, "params": t.parameters} for t in tools], sort_keys=True)
        tool_hash = hashlib.md5(tool_json.encode()).hexdigest()

        if self._gen_model is None or getattr(self, "_last_tool_hash", None) != tool_hash:
            import google.generativeai as genai
            
            # Map ToolDefinitions to Gemini format
            gemini_tools = []
            if tools:
                # Gemini expects a tool object with function_declarations
                # Note: We wrap it in a list of Tool objects
                gemini_tools = [{"function_declarations": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    } for t in tools
                ]}]

            # Only configure once
            if not getattr(self, "_configured", False):
                logger.info("Configuring Gemini with key %s...", self.api_key[:8] if self.api_key else "NONE")
                genai.configure(api_key=self.api_key)
                self._configured = True
            
            logger.info("Initializing/Updating Gemini [%s] (tools: %d)", 
                        self.model_name, len(tools) if tools else 0)
            
            self._gen_model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config={
                    "temperature": self.temperature,
                    "max_output_tokens": self.max_output_tokens,
                },
                tools=gemini_tools or None
            )
            self._last_tool_hash = tool_hash
            
        return self._gen_model

    async def stream_completion(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
    ) -> AsyncIterator[LLMResponse]:
        """
        Stream a completion from Gemini.
        Note: Maps standard OpenAI-style messages to Gemini format.
        """
        try:
            model = await self._get_model(tools=tools)
            
            # Convert messages to Gemini format
            history = []
            for msg in messages[:-1]:
                role = "user" if msg["role"] == "user" else "model"
                history.append({"role": role, "parts": [msg["content"]]})
            
            chat = model.start_chat(history=history)
            
            last_msg = messages[-1]["content"] if messages else system_prompt
            if not last_msg.strip():
                last_msg = "Hello!" # Fallback
            
            response = await chat.send_message_async(last_msg, stream=True)
            
            async for chunk in response:
                try:
                    if not chunk.candidates:
                        continue
                    candidate = chunk.candidates[0]
                    if not candidate.content or not hasattr(candidate.content, 'parts') or candidate.content.parts is None:
                        continue
                    
                    for part in candidate.content.parts:
                        # 1. Check for Text Tokens
                        if hasattr(part, 'text') and part.text:
                            yield LLMResponse(content=part.text)
                        
                        # 2. Check for Tool/Function Calls
                        if hasattr(part, 'function_call') and part.function_call:
                            call = part.function_call
                            import uuid
                            tool_call = ToolCall(
                                id=str(uuid.uuid4())[:8],
                                name=call.name,
                                arguments=dict(call.args)
                            )
                            logger.info("⚡ Gemini emitted tool call: %s(%s)", tool_call.name, tool_call.arguments)
                            yield LLMResponse(tool_calls=[tool_call])

                except Exception as e:
                    logger.warning("Error parsing Gemini chunk: %s", e)
                    continue

            # Emit Final Usage Metadata
            try:
                # Usage metadata is typically available on the response object after the stream is fully consumed
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    yield LLMResponse(usage={
                        "prompt_tokens": response.usage_metadata.prompt_token_count,
                        "completion_tokens": response.usage_metadata.candidates_token_count,
                        "total_tokens": response.usage_metadata.total_token_count
                    })
            except Exception as e:
                logger.warning("Failed to extract Gemini usage: %s", e)

        except Exception as e:
            from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError
            err_str = str(e).lower()
            
            logger.error("Gemini streaming error: %s", e)
            
            if "401" in err_str or "unauthorized" in err_str:
                raise AuthError(f"Gemini API key invalid: {e}")
            if "429" in err_str or "quota" in err_str or "exhausted" in err_str:
                raise ServiceExhaustedError("Gemini quota or rate limit exceeded.")
                
            raise VoiceBotError(f"Gemini error: {str(e)[:100]}")

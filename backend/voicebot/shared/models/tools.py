"""
AI Tool and Function Calling Models.

Standardized schemas for defining tools and handling tool calls/results
across different LLM providers (OpenAI, Gemini, Anthropic).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ToolDefinition(BaseModel):
    """A tool available for the LLM to call."""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema for parameters


class ToolCall(BaseModel):
    """A call to a tool by the LLM."""
    id: str
    name: str
    arguments: Dict[str, Any]


class ToolResult(BaseModel):
    """The result of executing a tool."""
    tool_call_id: str
    name: str
    content: str
    is_error: bool = False


class LLMResponse(BaseModel):
    """Combined response chunk from an LLM."""
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, int]] = Field(default=None)  # {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}

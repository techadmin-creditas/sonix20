"""
Rule schemas and metadata for the Guardrail system.
Provides self-documenting models for the Frontend and API.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Optional, Union
from pydantic import BaseModel, Field

class RuleScope(str, Enum):
    INPUT = "input"      # User → LLM
    OUTPUT = "output"    # LLM → User
    BOTH = "both"        # Both input and output
    TOOL = "tool"        # Tool call arguments

class RuleTrigger(str, Enum):
    EXACT_MATCH = "exact_match"     # Simple string match (Non-Coder friendly)
    KEYWORD = "keyword"              # Case-insensitive word match
    REGEX = "regex"                  # Regular expression (Advanced)
    SEMANTIC = "semantic"            # LLM-based natural language rule
    ALWAYS = "always"                # Always apply (e.g. general styling)

class RuleAction(str, Enum):
    MASK = "mask"            # Replace matching text with replacement
    BLOCK = "block"          # Abort turn and return error message
    REWRITE = "rewrite"      # Use AI to rewrite the text based on instruction
    FLAG = "flag"            # Log the trigger but don't modify text
    TERMINATE = "terminate"  # Hang up the call

class GuardrailRule(BaseModel):
    id: str = Field(..., description="Unique ID of the rule")
    name: str = Field(..., description="Human-readable name of the rule")
    description: Optional[str] = Field(None, description="Detailed explanation of what the rule does")
    scope: RuleScope = Field(RuleScope.BOTH, description="When to apply the rule")
    trigger: RuleTrigger = Field(RuleTrigger.KEYWORD, description="The detection logic")
    pattern: str = Field(..., description="The matching pattern (Regex, keywords, or natural language)")
    action: RuleAction = Field(RuleAction.BLOCK, description="What to do when triggered")
    params: dict[str, Any] = Field(default_factory=dict, description="Configuration (replacement, message, etc.)")
    is_active: bool = Field(True, description="Whether the rule is enabled")
    priority: int = Field(0, description="Order of application (Higher = earlier)")

class RuleMetadata(BaseModel):
    """Metadata describing available options for UI builders."""
    triggers: list[dict[str, str]]
    actions: list[dict[str, str]]
    scopes: list[dict[str, str]]

def get_rule_metadata() -> RuleMetadata:
    return RuleMetadata(
        triggers=[
            {"id": RuleTrigger.EXACT_MATCH, "label": "Exact Match", "description": "Match specific phrases exactly as typed (Easiest)."},
            {"id": RuleTrigger.KEYWORD, "label": "Keywords", "description": "Match one or more words separated by commas."},
            {"id": RuleTrigger.REGEX, "label": "Regex (Advanced)", "description": "Match complex patterns like account numbers or IDs."},
            {"id": RuleTrigger.SEMANTIC, "label": "AI Semantic", "description": "Analyze text using AI (e.g., 'Is this off-topic?')."},
        ],
        actions=[
            {"id": RuleAction.MASK, "label": "Mask", "description": "Hide sensitive info (e.g., replace with ****).", "requires": "replacement_text"},
            {"id": RuleAction.BLOCK, "label": "Block", "description": "Stop the bot from answering and show a message.", "requires": "message"},
            {"id": RuleAction.REWRITE, "label": "Rewrite", "description": "Sanitize the response while keeping the same meaning.", "requires": "instruction"},
            {"id": RuleAction.FLAG, "label": "Flag", "description": "Just log the violation for review (Doesn't change text)."},
        ],
        scopes=[
            {"id": RuleScope.INPUT, "label": "Incoming Only", "description": "Check what the user says."},
            {"id": RuleScope.OUTPUT, "label": "Outgoing Only", "description": "Check what the bot says."},
            {"id": RuleScope.BOTH, "label": "Both Ways", "description": "Apply to everything."},
        ]
    )

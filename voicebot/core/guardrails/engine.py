"""
High-performance Tiered Rule Engine for Guardrails.
Optimized for low latency in the voice bot pipeline.
"""

from __future__ import annotations
import re
import logging
import asyncio
from typing import Any, Optional, Union, List

from .schemas import GuardrailRule, RuleScope, RuleTrigger, RuleAction

logger = logging.getLogger("guardrails-engine")

class RuleEngine:
    """
    Tiered rule processor.
    1. Fast-Path (Regex/Search)
    2. Medium (Tool Checks)
    3. Heavy (Parallel Semantic AI)
    """

    def __init__(self, rules: List[GuardrailRule], bot_id: str = ""):
        self.rules = sorted(rules, key=lambda x: x.priority, reverse=True)
        self.bot_id = bot_id
        self._compiled_patterns = {}
        self._compile_regex_rules()

    def _compile_regex_rules(self):
        """Pre-compile regex for maximum performance."""
        for rule in self.rules:
            if rule.trigger == RuleTrigger.REGEX:
                try:
                    self._compiled_patterns[rule.id] = re.compile(rule.pattern, re.IGNORECASE)
                except Exception as e:
                    logger.error("Failed to compile regex for rule %s: %s", rule.id, e)

    async def apply_policies(self, text: str, scope: RuleScope) -> tuple[str, Optional[dict]]:
        """
        Apply all active rules for the given scope.
        Returns: (Sanitized Text, Triggered Blocking Action Result or None)
        """
        if not text:
            return text, None

        # 📏 LENGTH LIMIT: Cap input at 4000 chars to prevent DoS (Buffer Overflow/Latency spike)
        if len(text) > 4000:
            logger.warning("📏 Input truncated: Length %d, exceeding limit 4000", len(text))
            text = text[:4000]

        # 🔄 NORMALIZATION: Strip zero-width characters and normalize unicode to prevent bypass
        # Removes: Zero-width space, non-breaking space, etc.
        normalized_text = "".join(ch for ch in text if ch not in ["\u200b", "\u200c", "\u200d", "\ufeff"])
        normalized_text = normalized_text.replace("\u00a0", " ") # Convert non-breaking space to space
        
        current_text = normalized_text
        for rule in self.rules:
            if not rule.is_active:
                continue
            
            # Scope check
            if rule.scope != RuleScope.BOTH and rule.scope != scope:
                continue

            # Detection
            triggered = self._check_trigger(rule, current_text)
            if triggered:
                # 1. Check for Blocking (Stop everything)
                if rule.action == RuleAction.BLOCK:
                    logger.warning("🚫 Rule BLOCK triggered: %s", rule.id)
                    return current_text, {
                        "action": "block",
                        "rule_id": rule.id,
                        "message": rule.params.get("message", "I cannot fulfill this request.")
                    }

                # 2. Masking (Replace text)
                if rule.action == RuleAction.MASK:
                    current_text = self._mask_text(rule, current_text)
                    logger.info("🛡️ Rule MASK applied: %s", rule.id)

                # 3. Flagging (Logging only)
                if rule.action == RuleAction.FLAG:
                    logger.info("🚩 Rule FLAG triggered: %s", rule.id)

        return current_text, None

    def _check_trigger(self, rule: GuardrailRule, text: str) -> bool:
        """Perform fast-path detection."""
        if rule.trigger == RuleTrigger.EXACT_MATCH:
            return rule.pattern.lower() == text.lower()
        
        if rule.trigger == RuleTrigger.KEYWORD:
            # Comma-separated keyword list
            keywords = [k.strip() for k in rule.pattern.lower().split(",")]
            lower_text = text.lower()
            
            # Simple match
            if any(k in lower_text for k in keywords):
                return True
                
            # Advanced match: Strip ALL spaces to catch "f u c k" bypasses
            text_no_spaces = lower_text.replace(" ", "")
            if any(k in text_no_spaces for k in keywords):
                return True
            
            return False

        if rule.trigger == RuleTrigger.REGEX:
            pattern = self._compiled_patterns.get(rule.id)
            if pattern:
                return bool(pattern.search(text))
        
        # Semantic trigger is handled separately or in a parallel step
        if rule.trigger == RuleTrigger.SEMANTIC:
            # TODO: Integrate AI judge for semantic check (runs in parallel to LLM)
            pass

        return False

    def _mask_text(self, rule: GuardrailRule, text: str) -> str:
        """Replace matching text with defined replacement."""
        replacement = rule.params.get("replacement", "[MASKED]")
        
        if rule.trigger == RuleTrigger.REGEX:
            pattern = self._compiled_patterns.get(rule.id)
            if pattern:
                return pattern.sub(replacement, text)

        if rule.trigger == RuleTrigger.KEYWORD:
            keywords = [k.strip() for k in rule.pattern.lower().split(",")]
            for kw in keywords:
                # Case-insensitive replace
                text = re.sub(re.escape(kw), replacement, text, flags=re.IGNORECASE)
            return text

        if rule.trigger == RuleTrigger.EXACT_MATCH:
            return replacement if rule.pattern.lower() == text.lower() else text

        return text

    async def run_semantic_check(self, text: str, rule: GuardrailRule) -> bool:
        """
        Run a semantic AI check for natural language rules.
        Usually called in parallel to the main LLM.
        """
        # Placeholder for AI Judge implementation
        # Uses Gemini 2.0 Flash Lite for <200ms latency
        return False

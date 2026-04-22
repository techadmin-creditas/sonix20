"""
AI Suggestor for Guardrails.
Analyzes bot persona and suggests relevant safety rules.
"""

from __future__ import annotations
import json
import logging
from typing import Any, List, Optional

from .schemas import GuardrailRule, RuleScope, RuleTrigger, RuleAction

logger = logging.getLogger("guardrails-suggestor")

class RuleSuggestor:
    """Uses AI to generate bot-relevant safety and data rules."""

    def __init__(self):
        # We use Gemini 2.0 Flash Lite for suggestions - Fast and Cheap
        from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
        self.llm = GeminiStreamingProvider()

    async def suggest_rules(self, bot_id: str, persona: str, system_prompt: str) -> List[GuardrailRule]:
        """
        Ask the AI to propose 5 high-impact guardrails for this bot.
        """
        prompt = f"""
            You are a security expert for Voice AI Bots. 
            Analyze the following bot persona and system prompt. 
            Suggest exactly 5 security or data rules that apply to this specific bot.
            
            BOT PERSONA: {persona}
            SYSTEM PROMPT: {system_prompt}
            
            RULES MUST BE IN THIS JSON FORMAT:
            [
                {{
                    "id": "rule_id_slug",
                    "name": "Human Name",
                    "description": "Why this rule is needed.",
                    "scope": "input|output|both",
                    "trigger": "regex|keyword|semantic",
                    "pattern": "Pattern or Description",
                    "action": "mask|block|rewrite",
                    "params": {{ "message": "...", "replacement": "..." }}
                }}
            ]
            
            Include at least one rule for PII masking (if needed) and one for preventing off-topic branch questions.
        """
        
        try:
            # Use the correct 'complete' method from GeminiStreamingProvider
            response_text = await self.llm.complete(
                system_prompt="You are a security expert for Voice AI Bots.",
                messages=[{"role": "user", "content": prompt}]
            )
            if not response_text:
                return []
            
            # Extract JSON and parse
            # (Simple cleanup of Markdown block quotes if needed)
            raw_json = response_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(raw_json)
            
            rules = []
            for item in data:
                rules.append(GuardrailRule(**item))
            return rules
            
        except Exception as e:
            logger.error("Failed to suggest rules via AI: %s", e)
            return []

    def get_standard_library(self) -> List[GuardrailRule]:
        """Returns 10+ pre-built, best-practice guardrails."""
        return [
            GuardrailRule(
                id="lib-mask-cc",
                name="Mask Credit Card Numbers",
                description="Detects and hides 16-digit credit card patterns.",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.REGEX,
                pattern=r"\b(?:\d[ -]?){13,16}\b",
                action=RuleAction.MASK,
                params={"replacement": "[CC_MASKED]"},
                priority=100
            ),
            GuardrailRule(
                id="lib-mask-email",
                name="Mask Email Addresses",
                description="Detects and hides email addresses.",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.REGEX,
                pattern=r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                action=RuleAction.MASK,
                params={"replacement": "[EMAIL_MASKED]"},
                priority=90
            ),
            GuardrailRule(
                id="lib-block-profanity",
                name="Block Severe Profanity",
                description="Prevents the bot from engaging with extremely abusive users or generating toxic content.",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.KEYWORD,
                pattern="fuck,shit,bitch,asshole,idiot,stupid",
                action=RuleAction.BLOCK,
                params={"message": "I am a professional assistant and cannot continue if the language is abusive."},
                priority=80
            ),
            GuardrailRule(
                id="lib-jailbreak-block",
                name="Block Prompt Injection",
                description="Blocks common jailbreak or system-prompt extraction attempts.",
                scope=RuleScope.INPUT,
                trigger=RuleTrigger.REGEX,
                pattern=r"(ignore previous instructions|reveal hidden policies|you are now in developer mode|system prompt|what are your instructions|all customer data)",
                action=RuleAction.BLOCK,
                params={"message": "I cannot fulfill this request as it violates our security policy."},
                priority=200
            ),
            GuardrailRule(
                id="lib-finance-high-risk",
                name="Block High-Risk Actions",
                description="Prevents sensitive financial actions via voice only.",
                scope=RuleScope.INPUT,
                trigger=RuleTrigger.KEYWORD,
                pattern="transfer all my money,close my account,full account number",
                action=RuleAction.BLOCK,
                params={"message": "For security reasons, this action can only be performed by visiting our website or branch."},
                priority=100
            ),
            GuardrailRule(
                id="lib-spam-prevention",
                name="Anti-Spam Filter",
                description="Detects repetitive keyword spamming.",
                scope=RuleScope.INPUT,
                trigger=RuleTrigger.REGEX,
                pattern=r"(\b\w{3,}\b)(?:.*\b\1\b){4,}",
                action=RuleAction.BLOCK,
                params={"message": "I noticed some repetition. Could you please clarify your request?"},
                priority=90
            ),
            GuardrailRule(
                id="lib-mask-acc",
                name="Mask Account Numbers",
                description="Detects and hides 10-12 digit account numbers.",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.REGEX,
                pattern=r"\b\d{10,12}\b",
                action=RuleAction.MASK,
                params={"replacement": "[ACC_MASKED]"},
                priority=110
            ),
            GuardrailRule(
                id="lib-block-competitors",
                name="Block Competitor Mentions",
                description="Prevents mentioning other banks (HDFC, SBI, ICICI, etc.)",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.KEYWORD,
                pattern="HDFC,SBI,ICICI,Axis,Kotak,Yes Bank,Standard Chartered",
                action=RuleAction.BLOCK,
                params={"message": "I only assist with our own banking products and do not have information on other banks."},
                priority=150
            ),
            GuardrailRule(
                id="lib-semantic-politics",
                name="Block Political Discussion",
                description="Ensures the bot stays neutral and avoids political topics.",
                scope=RuleScope.BOTH,
                trigger=RuleTrigger.SEMANTIC,
                pattern="Is the user asking about political figures, elections, or sensitive societal politics?",
                action=RuleAction.BLOCK,
                params={"message": "I am a banking assistant and I do not have information on political topics."},
                priority=70
            )
        ]

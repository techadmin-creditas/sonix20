import json
import logging
import re
import asyncio
from typing import Optional, List

logger = logging.getLogger("intent-learner")

class IntentLearner:
    """
    Agentic service that learns new intent patterns from successful LLM classifications.
    Ensures PII (Personal Identifiable Information) is stripped before persisting patterns.
    """

    def __init__(self, brain):
        self.brain = brain
        self.db = brain.db
        self.llm = brain.llm

    async def learn_from_utterance(self, text: str, intent: str):
        """
        Takes raw user input and a confirmed intent, 
        generalizes it into a safe pattern, and saves to DB.
        """
        # 1. Basic Heuristics: Just ensure text isn't empty.
        if not text.strip():
            return

        # 2. Generalization & Sanitization via LLM
        pattern = await self._generalize_pattern(text, intent)
        if not pattern:
            return

        # 3. Save to DB
        try:
            await self.db.save_learned_affinity(intent=intent, pattern=pattern)
            logger.info("🧠 Learned new pattern for intent '%s': %s", intent, pattern)
        except Exception as e:
            logger.error("Failed to save learned affinity: %s", e)

    async def _generalize_pattern(self, text: str, intent: str) -> Optional[str]:
        """
        Uses the LLM to strip PII and create a generic Hinglish/English pattern.
        """
        system_prompt = (
            "You are a Computational Linguist and Regex Architect.\n"
            "RULES:\n"
            "1. SCORCHED EARTH PII: NEVER include literal names, numbers, or specific details from the input in the regex.\n"
            "   - FORBIDDEN: (?:vaibhav|rahul|sanjeev)\n"
            "   - REQUIRED: Use [NAME] or [NUMBER] instead.\n"
            "2. NO GHOSTS: At least ONE core semantic group MUST be mandatory (not optional).\n"
            "3. NO PADDING: Do NOT add '.*' at the start or end (the system handles it).\n"
            "4. NO ANCHORS: Do NOT use ^ or $.\n"
            "5. CLEAN: Output ONLY the raw regex string."
        )

        user_prompt = f"Sanitize and generalize this for the intent '{intent}':\n\"{text}\""

        for attempt in range(3):
            try:
                chunks = []
                async for chunk in self.llm.stream_completion(
                    system_prompt=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                ):
                    chunks.append(chunk.content or "")
                
                raw_pattern = "".join(chunks).strip()
                # 🛡️ DE-MARKDOWN & CLEANUP 🛡️
                # Remove backticks, markdown code blocks, and quotes
                raw_pattern = raw_pattern.replace("```regex", "").replace("```", "")
                raw_pattern = raw_pattern.strip().strip("`").strip("'").strip('"').strip()
                
                if raw_pattern:
                    break
            except Exception as e:
                if ("rate_limit" in str(e).lower() or "quota" in str(e).lower()) and attempt < 2:
                    wait_time = (attempt + 1) * 2
                    logger.warning("Quota hit. Retrying in %ds...", wait_time)
                    await asyncio.sleep(wait_time)
                    continue
                logger.error("Error in pattern generalization: %s", e)
                return None
        
        if not raw_pattern:
            return None
            
        # 🛡️ SAFETY CHECK: Prevent universal matching patterns (e.g. contains |.* or .*)
        if "|.*" in raw_pattern or ".*|" in raw_pattern or raw_pattern.strip() == ".*" or "(.*)" in raw_pattern:
            logger.warning("🛡️ Rejecting universal matching pattern from LLM: %s", raw_pattern)
            return None

        # Post-process: Convert ANY bracketed placeholders (e.g., [ANYTHING]) into universal wildcards
        # This achieves ZERO hardcoding of entity types (Name/Number/etc).
        pattern = re.sub(r"\[[A-Z_]+\]", r".*", raw_pattern)
        
        # 🛡️ ANCHOR CLEANUP: Strip ^ and $ to prevent conflicts with the .* padding
        pattern = pattern.replace("^", "").replace("$", "")
        
        pattern = pattern.replace("\\ ", " ").strip() # Clean up escaped spaces and strip
        
        # Ensure it starts and ends with wildcard to handle fillers
        if not pattern.startswith(".*"): 
            pattern = ".*" + pattern
        if not pattern.endswith(".*"): 
            pattern = pattern + ".*"
            
        # 🧪 VALIDATION: Compile test to ensure it's a valid regex
        try:
            re.compile(pattern)
        except re.error as e:
            logger.error("Generated invalid regex: %s | Error: %s", pattern, e)
            return None

        # Final safety check: if the LLM produced a nearly identical string to the input (failed to generalize), reject it.
        if len(pattern) > 5 and pattern.replace(".*", "").lower() == text.lower():
             logger.warning("LLM failed to generalize pattern for: %s", text)
             return None

        return pattern

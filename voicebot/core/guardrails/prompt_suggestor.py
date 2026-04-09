"""
AI Suggestor for System Prompts.
"""

from __future__ import annotations
import json
import logging
import re
from typing import Optional

logger = logging.getLogger("prompt-suggestor")

class SystemPromptSuggestor:
    def __init__(self):
        # Primary: Gemini 2.0 Flash Lite (Reliable, high-quality)
        from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
        # Increase max_tokens for long prompts (revisions can be large)
        self.llm = GeminiStreamingProvider(max_tokens=4096)
        
    async def _safe_complete(self, system_prompt: str, prompt: str) -> tuple[str, str]:
        """Execute completion with automatic fallback and return (content, provider)."""
        provider_name = "Gemini 2.0 Flash"
        try:
            # 1. Try Gemini
            text = await self.llm.complete(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            return text, provider_name
        except Exception as e:
            err_str = str(e).lower()
            if "503" in err_str or "429" in err_str or "unavailable" in err_str or "quota" in err_str:
                logger.warning("🕒 Gemini is busy, falling back to Groq Llama-3...")
                provider_name = "Groq Llama-3"
                try:
                    from voicebot.services.llm.groq_provider import GroqStreamingProvider
                    groq = GroqStreamingProvider(max_tokens=4096)
                    content = ""
                    async for chunk in groq.stream_completion(
                        system_prompt=system_prompt,
                        messages=[{"role": "user", "content": prompt}]
                    ):
                        if chunk.content:
                            content += chunk.content
                    return content, provider_name
                except Exception as groq_err:
                    logger.error("❌ Fallback to Groq also failed: %s", groq_err)
                    raise e
            raise e

    def _extract_json(self, text: str) -> Optional[dict]:
        """Robustly extract JSON from LLM response."""
        try:
            # Try finding the first { and last } to avoid any preamble/postamble
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                json_str = text[start:end+1]
                
                # LLMs often put raw newlines in JSON strings which is invalid JSON.
                # We try to fix this by allowing control characters.
                data = json.loads(json_str, strict=False)
                
                # Normalize Analysis: convert list of strings/bullets to a single string for the UI
                if "analysis" in data and isinstance(data["analysis"], list):
                    data["analysis"] = "\n".join([f"• {str(item)}" if not str(item).startswith("•") else str(item) for item in data["analysis"]])
                
                return data
            
            # Fallback: try stripping markdown fences
            cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
            if cleaned:
                data = json.loads(cleaned, strict=False)
                if "analysis" in data and isinstance(data["analysis"], list):
                    data["analysis"] = "\n".join([f"• {str(item)}" if not str(item).startswith("•") else str(item) for item in data["analysis"]])
                return data
        except Exception as e:
            logger.warning("JSON extraction failed: %s", e)
            return None

    async def suggest_prompt(self, name: str, role: str, persona: Optional[str] = None, current_prompt: Optional[str] = None) -> dict:
        """
        Ask the AI to generate or refine a system prompt.
        """
        if not current_prompt or not current_prompt.strip():
            # GENERATION MODE
            prompt = f"""
                You are an expert Prompt Engineer for Voice AI Bots. 
                Create a high-quality, professional, and effective System Prompt for a Voice AI Bot with the following identity:
                
                BOT NAME: {name}
                BOT ROLE: {role}
                BOT PERSONA/TONE: {persona or 'professional and helpful'}
                
                Requirements for the System Prompt:
                1. Identity: Explicitly state "You are {name}, {role}."
                2. Voice Excellence: Keep responses short, clear, and conversationally natural (optimized for Text-to-Speech).
                3. Accuracy: Never hallucinate facts, policies, or account details.
                4. Structure: Use clear section headers like # IDENTITY, # GUIDELINES, # TONE.
                
                RETURN ONLY THE PROMPT TEXT AS A STRING.
            """
            try:
                # Use the safe complete method with fallback
                text, provider = await self._safe_complete(
                    system_prompt="You are an expert Prompt Engineer for Voice AI Bots.",
                    prompt=prompt
                )
                text = text.replace("```text", "").replace("```markdown", "").replace("```", "").strip()
                return {
                    "suggested_prompt": text or f"You are {name}, a {role}.",
                    "provider": provider
                }
            except Exception as e:
                logger.error("Generation failed: %s", e)
                return {"suggested_prompt": f"You are {name}, a {role}.", "provider": "Error"}
        
        else:
            # REFINEMENT MODE
            prompt = f"""
                You are an expert Prompt Engineer specializing in Voice/VAPI interactions.
                Analyze and improve the following System Prompt for a Voice AI Bot.
                
                BOT IDENTITY: {name} ({role})
                CURRENT PROMPT:
                {current_prompt}
                
                GOALS:
                1. Analyze: Point out 2-3 specific areas for improvement (e.g., too wordy, missing constraints, poor formatting).
                2. Refine: Provide a new, superior version that maintains the same intent but is more professional and optimized for voice.
                3. Language: YOU MUST USE THE SAME LANGUAGE AS THE CURRENT PROMPT.
                
                RESPONSE FORMAT (MANDATORY JSON):
                {{
                    "analysis": "Short 2-3 bullet point analysis.",
                    "revised_prompt": "The complete improved text."
                }}
                
                IMPORTANT: RETURN ONLY THE JSON OBJECT. NO PREAMBLE. NO POSTAMBLE.
            """
            try:
                raw, provider = await self._safe_complete(
                    system_prompt="You are an expert Prompt Engineer specializing in Voice/VAPI interactions. You always respond in valid JSON.",
                    prompt=prompt
                )
                
                data = self._extract_json(raw)
                if data and "revised_prompt" in data:
                    data["provider"] = provider
                    return data
                
                # If it's not JSON but long and has no error keywords, maybe it's just the prompt?
                if len(raw) > len(current_prompt) * 0.5 and "analysis" not in raw.lower():
                    return {
                        "analysis": "AI provided a revision directly.", 
                        "revised_prompt": raw.strip(),
                        "provider": provider
                    }
                
                return {
                    "analysis": "Could not parse analysis. Showing raw revision if available.", 
                    "revised_prompt": raw or current_prompt,
                    "provider": provider
                }
            except Exception as e:
                logger.error("Refinement failed: %s", e)
                return {
                    "analysis": f"AI was unable to analyze at this time: {str(e)}", 
                    "revised_prompt": current_prompt,
                    "provider": "Error"
                }

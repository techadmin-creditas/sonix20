"""
Construct the voice-session LLM stack (primary + optional fallbacks) from bot config and settings.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from voicebot.shared.config import AppSettings
from voicebot.shared.utils.validation import is_valid_api_key

logger = logging.getLogger("llm-factory")


def _instantiate_voice_llm(provider: str, model: str, settings: AppSettings) -> Optional[Any]:
    provider = (provider or "").lower()
    if provider == "groq" and is_valid_api_key(settings.groq_api_key):
        from voicebot.services.llm.groq_provider import GroqStreamingProvider

        return GroqStreamingProvider(model=model or settings.groq_model)
    if provider == "openai" and is_valid_api_key(settings.openai_api_key):
        from voicebot.services.llm.openai_provider import OpenAIStreamingProvider

        return OpenAIStreamingProvider(model=model or settings.openai_model)
    if provider == "openrouter" and is_valid_api_key(settings.openrouter_api_key):
        from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider

        return OpenRouterStreamingProvider(
            model=model or settings.openrouter_default_model or "meta-llama/llama-3.3-70b-instruct"
        )
    if provider == "anthropic" and is_valid_api_key(settings.anthropic_api_key):
        from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider

        return AnthropicStreamingProvider(model=model or settings.anthropic_model)
    if provider == "gemini" and is_valid_api_key(settings.gemini_api_key):
        from voicebot.services.llm.gemini_provider import GeminiStreamingProvider

        return GeminiStreamingProvider(model=model or "gemini-2.0-flash-001")
    return None


def wrap_llm_with_fallbacks(primary: Any, bot_config: dict, settings: AppSettings) -> Any:
    """
    Wrap primary in FallbackStreamingProvider when extra backends are available.

    Per-bot ``llm_fallback_enabled: false`` disables. Optional ``llm_fallback_chain``:
    list of {"provider": "openrouter", "model": "..."}.
    """
    if bot_config.get("llm_fallback_enabled") is False:
        return primary

    chain: list[Any] = [primary]
    labels: list[str] = [str(bot_config.get("llm_provider") or "primary").lower() or "primary"]
    seen_types: set[str] = {type(primary).__name__}

    def add(p: Optional[Any], label: str) -> None:
        if p is None:
            return
        t = type(p).__name__
        if t in seen_types:
            return
        seen_types.add(t)
        chain.append(p)
        labels.append(label)

    explicit = bot_config.get("llm_fallback_chain")
    if isinstance(explicit, list) and len(explicit) > 0:
        for item in explicit:
            if not isinstance(item, dict):
                continue
            prov = str(item.get("provider", "")).strip()
            model = str(item.get("model", "")).strip()
            add(_instantiate_voice_llm(prov, model, settings), prov or "fallback")
    else:
        prim = str(bot_config.get("llm_provider") or "").lower()
        if prim == "groq":
            add(
                _instantiate_voice_llm(
                    "openrouter",
                    settings.openrouter_default_model or "",
                    settings,
                ),
                "openrouter",
            )
            add(_instantiate_voice_llm("openai", settings.openai_model or "", settings), "openai")
        elif prim == "openrouter":
            add(_instantiate_voice_llm("openai", settings.openai_model or "", settings), "openai")
            add(
                _instantiate_voice_llm("groq", settings.groq_model or "", settings),
                "groq",
            )
        elif prim == "openai":
            add(
                _instantiate_voice_llm(
                    "openrouter",
                    settings.openrouter_default_model or "",
                    settings,
                ),
                "openrouter",
            )
            add(_instantiate_voice_llm("groq", settings.groq_model or "", settings), "groq")
        elif prim == "anthropic":
            add(
                _instantiate_voice_llm(
                    "openrouter",
                    settings.openrouter_default_model or "",
                    settings,
                ),
                "openrouter",
            )
            add(_instantiate_voice_llm("openai", settings.openai_model or "", settings), "openai")
        elif prim == "gemini":
            # For Gemini bots: add Groq as #1 fallback (Groq is faster for voice turns),
            # then OpenAI as #2. This gives us a reliable response even if Gemini rate-limits.
            add(_instantiate_voice_llm("groq", settings.groq_model or "", settings), "groq")
            add(_instantiate_voice_llm("openai", settings.openai_model or "", settings), "openai")
            add(_instantiate_voice_llm("openrouter", settings.openrouter_default_model or "", settings), "openrouter")
        else:
            add(
                _instantiate_voice_llm(
                    "openrouter",
                    settings.openrouter_default_model or "",
                    settings,
                ),
                "openrouter",
            )
            add(_instantiate_voice_llm("openai", settings.openai_model or "", settings), "openai")

    if len(chain) == 1:
        # 🛡️ RESILIENCE: If we only have ONE provider and it's OpenRouter or Gemini,
        # we MUST add a reliable fallback (Groq) to prevent quota-based hangs.
        prim_provider = labels[0]
        if prim_provider in ("openrouter", "gemini", "anthropic"):
            add(_instantiate_voice_llm("groq", settings.groq_model or "llama-3.3-70b-versatile", settings), "groq")
            add(_instantiate_voice_llm("openai", settings.openai_model or "gpt-4o-mini", settings), "openai")
            
        if len(chain) == 1:
            return primary


    from voicebot.services.llm.fallback_provider import FallbackStreamingProvider

    return FallbackStreamingProvider(chain, labels)


def create_voice_llm(bot_config: dict, settings: AppSettings) -> Any:
    """
    High-level entry point to create a fully configured LLM stack.
    Includes high-performance overrides (e.g. forcing Groq for certain bots).
    """
    provider_name = str(bot_config.get("llm_provider") or "").lower()
    model = bot_config.get("llm_model")
    bot_name_lower = str(bot_config.get("name", "")).lower()

    if not model:
        raise ValueError(f"Bot '{bot_config.get('name', 'Unknown')}' has no LLM Model configured.")

    # 🚀 PRODUCTION OPTIMIZATION: Force Groq for high-performance Hindi banking bots.
    is_high_perf = ("hindi" in bot_name_lower or "banking" in bot_name_lower)
    if is_high_perf and (provider_name == "openrouter" or "openai/gpt-4o-mini" in str(model)):
        provider_name = "groq"
        model = "llama-3.3-70b-versatile"
        logger.warning("🚀 OVERRIDING slow model with high-perf Groq (%s) for low-latency session.", model)

    # 1. Instantiate primary
    primary = None
    if provider_name == "openrouter" or ("/" in str(model) and provider_name not in ("gemini", "openai", "groq", "anthropic")):
        primary = _instantiate_voice_llm("openrouter", model, settings)
    elif provider_name in ("openai", "gemini", "anthropic", "groq"):
        primary = _instantiate_voice_llm(provider_name, model, settings)
    
    if not primary:
        # Default fallback for instantiation
        model = model or "llama3-70b-8192"
        primary = _instantiate_voice_llm("groq", model, settings)

    # 2. Wrap with fallbacks
    return wrap_llm_with_fallbacks(primary, bot_config, settings)

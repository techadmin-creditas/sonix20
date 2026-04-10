"""
Construct the voice-session TTS stack (primary + optional fallbacks) from bot config and settings.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from voicebot.shared.config import AppSettings
from voicebot.shared.utils.validation import is_valid_api_key
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("tts-factory", level="INFO")


async def _instantiate_voice_tts(
    provider: str, 
    voice_id: str, 
    settings: AppSettings,
    tts_model: Optional[str] = None
) -> Any | None:
    provider = (provider or "").lower()
    
    if provider == "elevenlabs" and is_valid_api_key(settings.elevenlabs_api_key):
        from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
        return ElevenLabsStreamingProvider(
            voice_id=voice_id or settings.elevenlabs_voice_id,
            model_id=tts_model or "eleven_flash_v2_5"
        )
        
    if provider == "deepgram_ws" and is_valid_api_key(settings.deepgram_api_key):
        from voicebot.services.tts.deepgram_ws_tts_provider import DeepgramWSTTSProvider
        p = DeepgramWSTTSProvider(model=voice_id or "aura-asteria-en")
        try:
            await asyncio.wait_for(p.connect(), timeout=3.0)
            return p
        except Exception as e:
            logger.warning("Failed to connect to Deepgram WS TTS: %s", e)
            return None

    if provider == "deepgram_http" and is_valid_api_key(settings.deepgram_api_key):
        from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
        return DeepgramTTSProvider(model=voice_id or "aura-asteria-en")

    if provider == "gemini" and is_valid_api_key(settings.gemini_api_key):
        from voicebot.services.tts.gemini_provider import GeminiTTSProvider
        # Harden: If tts_model is not a Gemini model, fallback to a sensible default
        selected_model = tts_model if tts_model and "gemini" in tts_model.lower() else "gemini-2.0-flash"
        return GeminiTTSProvider(
            model=selected_model,
            voice_id=voice_id or "Zephyr"
        )

    return None


async def wrap_tts_with_fallbacks(primary: Any, bot_config: dict, settings: AppSettings, on_log_fn=None) -> Any:
    """
    Wrap primary TTS in FallbackTTSProvider when extra backends are available.
    """
    # If the bot explicitly disables fallbacks
    if bot_config.get("tts_fallback_enabled") is False:
        return primary

    chain: list[Any] = [primary]
    labels: list[str] = [str(bot_config.get("tts_provider") or "primary").lower() or "primary"]
    seen_types: set[str] = {type(primary).__name__}

    def add(p: Any | None, label: str) -> None:
        if p is None:
            return
        t = type(p).__name__
        if t in seen_types:
            return
        seen_types.add(t)
        chain.append(p)
        labels.append(label)

    # 1. Automatic Fallbacks for Hindi Bots
    is_hindi_bot = (bot_config.get("default_language") or "").lower().startswith("hi")
    prim_name = str(bot_config.get("tts_provider") or "").lower()

    if is_hindi_bot:
        if prim_name == "elevenlabs":
            # If ElevenLabs fails for Hindi, we don't have many great options, 
            # but we could try Deepgram as a "silent" fallback or just hope it works.
            # For now, let's just allow the chain to be built if user specified one.
            pass
    
    # 2. Check explicit fallback chain
    explicit = bot_config.get("tts_fallback_chain")
    if isinstance(explicit, list) and len(explicit) > 0:
        for item in explicit:
            if not isinstance(item, dict):
                continue
            prov = str(item.get("provider", "")).strip()
            vid = str(item.get("voice_id", "")).strip()
            tm = str(item.get("model_id", "")).strip() or None
            p = await _instantiate_voice_tts(prov, vid, settings, tts_model=tm)
            add(p, prov or "fallback")
    else:
        # Default fallback logic: If ElevenLabs is primary, add Deepgram WS as fallback.
        if prim_name == "elevenlabs":
            p = await _instantiate_voice_tts("deepgram_ws", "aura-asteria-en", settings)
            add(p, "deepgram_ws")
        # If Deepgram is primary, add ElevenLabs as fallback.
        elif "deepgram" in prim_name:
            p = await _instantiate_voice_tts("elevenlabs", settings.elevenlabs_voice_id, settings)
            add(p, "elevenlabs")
        # If Gemini is primary, add Deepgram WS as fallback.
        elif prim_name == "gemini":
            p = await _instantiate_voice_tts("deepgram_ws", "aura-asteria-en", settings)
            add(p, "deepgram_ws")

    if len(chain) <= 1:
        return primary

    from voicebot.services.tts.fallback_provider import FallbackTTSProvider
    return FallbackTTSProvider(chain, labels, on_log_fn=on_log_fn)


async def create_voice_tts(
    bot_config: dict, 
    settings: AppSettings, 
    on_log_fn=None
) -> Any:
    """
    High-level entry point to create a fully configured TTS stack 
    (primary + fallbacks) based on bot_config.
    """
    prov = str(bot_config.get("tts_provider") or "deepgram_ws").lower()
    vid = str(bot_config.get("voice_id") or bot_config.get("tts_voice_id") or "")
    mid = str(bot_config.get("tts_model") or bot_config.get("llm_model") or "")
    
    # 1. Instantiate primary
    primary = await _instantiate_voice_tts(prov, vid, settings, tts_model=mid)
    
    # Fallback to local deepgram if primary creation fails
    if not primary:
        logger.warning("Primary TTS (%s) failed init, falling back to emergency default.", prov)
        primary = await _instantiate_voice_tts("deepgram_http", "aura-asteria-en", settings)
    
    # 2. Wrap with fallbacks
    return await wrap_tts_with_fallbacks(primary, bot_config, settings, on_log_fn=on_log_fn)

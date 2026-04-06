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


async def _instantiate_voice_tts(provider: str, voice_id: str, settings: AppSettings) -> Any | None:
    provider = (provider or "").lower()
    
    if provider == "elevenlabs" and is_valid_api_key(settings.elevenlabs_api_key):
        from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider
        return ElevenLabsStreamingProvider(
            voice_id=voice_id or settings.elevenlabs_voice_id,
            model_id="eleven_flash_v2_5"
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
            p = await _instantiate_voice_tts(prov, vid, settings)
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

    if len(chain) <= 1:
        return primary

    from voicebot.services.tts.fallback_provider import FallbackTTSProvider
    return FallbackTTSProvider(chain, labels, on_log_fn=on_log_fn)

"""
STT Provider Factory — Encapsulates Deepgram/Multilingual selection logic.
"""

from typing import Any, Optional
from voicebot.shared.config import AppSettings
from voicebot.shared.policy import parse_json_dict
from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider, resolve_stt_language_for_session

def create_voice_stt(
    bot_config: dict,
    session_language: str,
    settings: AppSettings
) -> Any:
    """
    Initialize STT with language detection and endpointing policies.
    """
    conversation_policy = parse_json_dict(bot_config.get("conversation_policy") or {})
    
    stt_lang = resolve_stt_language_for_session(session_language, conversation_policy)
    
    # Extract endpointing and VAD thresholds
    stt_ep = conversation_policy.get("stt_endpointing_ms")
    try:
        stt_ep_ms = int(stt_ep) if stt_ep is not None else None
    except (TypeError, ValueError):
        stt_ep_ms = None
        
    stt_vad = conversation_policy.get("stt_rms_vad_threshold")
    try:
        stt_vad_rms = float(stt_vad) if stt_vad is not None else None
    except (TypeError, ValueError):
        stt_vad_rms = None
        
    return DeepgramStreamingProvider(
        language=stt_lang,
        endpointing_ms=stt_ep_ms,
        vad_rms_threshold=stt_vad_rms,
    )

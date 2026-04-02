"""
Fallback TTS Provider.
Transparently wraps multiple TTS providers and falls back to subsequent ones if the primary fails.
"""

from __future__ import annotations
import logging
from typing import AsyncIterator, List, Any
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("tts-fallback", level="INFO")

class FallbackTTSProvider:
    """
    Wraps a list of TTS providers. Tries them in order.
    If one fails (raises an exception or yields 0 bytes), moves to the next.
    """

    def __init__(self, providers: List[Any], on_log_fn=None):
        self.providers = [p for p in providers if p is not None]
        self.on_log_fn = on_log_fn
        self._current_index = 0
        self._stopped = False

    @property
    def model(self):
        if not self.providers:
            return "none"
        p = self.providers[self._current_index]
        return getattr(p, "model", getattr(p, "voice_id", "unknown"))

    async def stream_speech(self, text: str, **kwargs) -> AsyncIterator[bytes]:
        if not self.providers:
            return

        self._stopped = False
        
        for i in range(self._current_index, len(self.providers)):
            provider = self.providers[i]
            p_name = type(provider).__name__
            chunk_count = 0
            
            try:
                async for chunk in provider.stream_speech(text, **kwargs):
                    if self._stopped:
                        return
                    chunk_count += 1
                    yield chunk
                
                if chunk_count > 0:
                    self._current_index = i
                    return
                else:
                    logger.warning("TTS Provider %s yielded 0 chunks. Trying next...", p_name)
                    if self.on_log_fn:
                        await self.on_log_fn("[TTS]", f"Provider {p_name} returned 0 chunks. Trying fallback...", "text-yellow-400")
            
            except Exception as e:
                from voicebot.shared.exceptions import ServiceExhaustedError, AuthError
                
                err_str = str(e).lower()
                # Categorize errors to decide whether to fallback or fail hard (per user rules)
                is_terminal = any(x in err_str for x in ["quota", "exhausted", "credit", "balance", "429", "401", "unauthorized"])
                
                if is_terminal:
                    # Bailing immediately - User wants clear UI error and disconnection, not slow fallbacks
                    logger.critical("Terminal TTS error in %s: %s", p_name, e)
                    if "unauthorized" in err_str or "401" in err_str:
                         raise AuthError(f"{p_name} authentication failed or key expired.")
                    raise ServiceExhaustedError(f"{p_name} quota or usage limits reached.")

                logger.error("TTS Provider %s failed: %s. Trying next...", p_name, e)
                if self.on_log_fn:
                    await self.on_log_fn("[TTS]", f"Provider {p_name} error: {str(e)[:50]}. Trying fallback...", "text-yellow-400")
                
        logger.error("All TTS Providers failed for text: %s", text[:50])

    async def stop(self) -> None:
        self._stopped = True
        for p in self.providers:
            if hasattr(p, "stop"):
                await p.stop()

    async def reset(self) -> None:
        """Reset all child providers and stop the fallback loop."""
        self._stopped = True
        for p in self.providers:
            if hasattr(p, "reset"):
                await p.reset()
            elif hasattr(p, "stop"):
                # Forward reset to stop if the child only supports stop (e.g. ElevenLabs)
                await p.stop()

    async def disconnect(self) -> None:
        for p in self.providers:
            if hasattr(p, "disconnect"):
                await p.disconnect()

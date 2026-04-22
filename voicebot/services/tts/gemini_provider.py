"""
Gemini TTS Provider.

Converts text to speech using Google's Gemini multimodal models.
Supports high-fidelity streaming and dynamic downsampling.
"""

from __future__ import annotations

import logging
import time
import asyncio
import audioop  # Built-in module for fast PCM manipulation
from typing import AsyncIterator, Optional

from google import genai
from google.genai import types

from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger

settings = get_settings()
logger = setup_logger("tts-gemini", level=settings.log_level)

class GeminiTTSProvider:
    """
    Async streaming interface to Gemini's native TTS capabilities.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash-preview-tts", # Use standard flash model
        voice_id: str = "Zephyr",        # Default voice (Puck, Charon, Kore, Fenrir, Aoede, Zephyr)
        target_sample_rate: int = 16000, # Assuming your pipeline wants 16kHz
    ):
        self.api_key = api_key or settings.gemini_api_key
        if not self.api_key:
            logger.warning("Gemini TTS initialized WITHOUT an API Key.")
        
        self.model = model
        self.voice_id = voice_id
        
        # Gemini natively outputs 24kHz. We track the target to resample if needed.
        self.native_sample_rate = 24000
        self.target_sample_rate = target_sample_rate
        
        self._stopped = False
        
        # 🛡️ Quota Guard: Track cooldown globally for this instance
        self._quota_exhausted_until = 0.0
        
        try:
            # Initialize the standard client; we will use client.aio for async calls
            self.client = genai.Client(api_key=self.api_key)
            logger.info("Gemini TTS initialized: model=%s, voice=%s", self.model, self.voice_id)
        except Exception as e:
            logger.error("Failed to initialize Gemini Client: %s", e)
            self.client = None

    async def warm(self) -> None:
        """
        Pre-initialize the Gemini client.
        """
        if self.client:
           logger.info("🚀 Gemini TTS client pre-warmed")

    async def stream_speech(
        self,
        text: str,
        **kwargs,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio chunks for the given text using Gemini.
        """
        if not text.strip() or not self.client:
            return

        # 🛡️ Quota Guard check
        now = time.time()
        if now < self._quota_exhausted_until:
            wait_left = self._quota_exhausted_until - now
            logger.warning("Gemini TTS in penalty box (Quota 429). Skipping for %.1fs", wait_left)
            return

        self._stopped = False
        
        # Standard configuration for single-speaker TTS
        config = types.GenerateContentConfig(
            response_modalities=["AUDIO"], # Force audio output
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=self.voice_id
                    )
                )
            )
        )

        try:
            start_time = time.time()
            logger.info("Gemini TTS starting: voice=%s, text='%s'", self.voice_id, text[:40])
            chunk_count = 0
            
            # Use the native async client (client.aio) so we don't block the event loop
            generator = await self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=text, # Pass raw text to prevent conversational preamble
                config=config,
            )
            
            async for chunk in generator:
                if self._stopped:
                    break
                
                # Log usage metadata if present
                if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                    u = chunk.usage_metadata
                    logger.debug("Gemini TTS Usage: prompt=%d tokens", u.prompt_token_count)
                
                if not chunk.parts:
                    continue
                
                part = chunk.parts[0]
                if part.inline_data and part.inline_data.data:
                    audio_data = part.inline_data.data
                    if len(audio_data) > 0:
                        chunk_count += 1
                        if chunk_count == 1:
                            ttfa = (time.time() - start_time) * 1000
                            logger.info("⚡ Gemini TTS First Chunk Return: %.0fms", ttfa)

                        # Fast Resampling: Downsample 24kHz to 16kHz
                        if self.native_sample_rate != self.target_sample_rate:
                            audio_data, _ = audioop.ratecv(
                                audio_data, 2, 1, self.native_sample_rate, self.target_sample_rate, None
                            )
                        yield audio_data

            if chunk_count > 0:
                logger.debug("Gemini TTS streaming complete (%d chunks)", chunk_count)

        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                # 🛡️ Mark as exhausted for 60s
                self._quota_exhausted_until = time.time() + 60.0
                logger.error("Gemini TTS Quota Exceeded (429). Penalty box active for 60s.")
            else:
                logger.error("Gemini TTS streaming error: %s", e)
            raise e

    async def stop(self) -> None:
        """Stop current TTS playback."""
        self._stopped = True

    async def disconnect(self) -> None:
        """Cleanup resources."""
        self._stopped = True
        self.client = None
        logger.info("Gemini TTS provider disconnected")

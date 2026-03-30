
import asyncio
import os
import sys
import hashlib
from typing import Optional

# Mock settings and logger before importing the provider
class MockSettings:
    elevenlabs_api_key = "sk_4181b3545e6e60388c3cc9abd3ab45ea48703a336617be8f"
    elevenlabs_voice_id = "EXAVITQu4vr4xnSDxMaL"
    log_level = "INFO"
    redis_url = "redis://localhost:6379/0"

import logging
logging.basicConfig(level=logging.INFO)
sys.modules["voicebot.shared.config"] = type("obj", (object,), {"get_settings": lambda: MockSettings()})
sys.modules["voicebot.shared.logging.logger"] = type("obj", (object,), {"setup_logger": lambda n, level="INFO": logging.getLogger(n)})

from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider

async def test_provider_flow():
    print("Testing ElevenLabsStreamingProvider class flow...")
    # Use Sarah, multilingual_v2, pcm_16000
    provider = ElevenLabsStreamingProvider(
        voice_id="EXAVITQu4vr4xnSDxMaL",
        model_id="eleven_multilingual_v2"
    )
    
    text = "नमस्ते, मैं आपकी कैसे मदद कर सकता हूँ?"
    print(f"Synthesizing: \"{text}\"")
    
    chunk_count = 0
    total_bytes = 0
    
    try:
        async for chunk in provider.stream_speech(text):
            chunk_count += 1
            total_bytes += len(chunk)
            if chunk_count == 1:
                print(f"✅ Received first chunk: {len(chunk)} bytes")
        
        print(f"Finished. Total chunks: {chunk_count}, Total bytes: {total_bytes}")
        if total_bytes == 0:
            print("❌ FAILURE: No audio data received at all!")
        elif total_bytes < 1000:
            print("⚠️ WARNING: Received very little data. Might be an error message instead of audio.")
        else:
            print("🎉 SUCCESS: Provider is functioning correctly.")
            
    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_provider_flow())

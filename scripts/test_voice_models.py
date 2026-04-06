#!/usr/bin/env python3
"""
TTS Provider Diagnostic Script.

Tests all configured TTS voices across Different providers by generating 
a small audio snippet and measuring Time-to-First-Byte (TTFB).
"""

import asyncio
import time
import os
import sys

# Ensure the root directory is in the path so we can import 'voicebot'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voicebot.shared.config import get_settings
from voicebot.services.tts.deepgram_tts_provider import DeepgramTTSProvider
from voicebot.services.tts.elevenlabs_provider import ElevenLabsStreamingProvider

settings = get_settings()

def is_valid_key(key: str) -> bool:
    """Check if API key is valid (not empty or placeholder)."""
    if not key:
        return False
    invalid_patterns = ["your_", "test_", "demo_", "xxxx", "1234"]
    key_lower = key.lower()
    return not any(p in key_lower for p in invalid_patterns)

async def test_voice(voice_id: str, name: str, provider_class: type, provider_name: str):
    """Test a specific voice and return results."""
    print(f"Testing {provider_name} | {name} ({voice_id})...", end=" ", flush=True)
    
    start_time = time.time()
    ttfb = None
    total_bytes = 0
    
    try:
        # Initialize provider with specific voice
        # deepgram uses 'model', elevenlabs uses 'voice_id' in __init__? 
        # Actually ElevenLabs uses 'voice_id' in its init.
        if provider_name == "Deepgram":
            provider = provider_class(model=voice_id)
        else:
            provider = provider_class(voice_id=voice_id)
        
        # Test synthesis
        async for chunk in provider.stream_speech("READY"):
            if chunk:
                if ttfb is None:
                    ttfb = (time.time() - start_time) * 1000
                total_bytes += len(chunk)
                # Break after first few chunks to save quota
                if total_bytes > 16000:
                    break
        
        total_latency = (time.time() - start_time) * 1000
        
        ttfb_str = f"{ttfb:.0f}ms" if ttfb is not None else "ERROR"
        print(f"✅ Success! [TTFB: {ttfb_str} | Bytes: {total_bytes}]")
        return {
            "voice": name,
            "id": voice_id,
            "provider": provider_name,
            "status": "PASS",
            "ttfb": ttfb,
            "total": total_latency
        }
        
    except Exception as e:
        print(f"❌ Failed: {str(e)[:100]}")
        return {
            "voice": name,
            "id": voice_id,
            "provider": provider_name,
            "status": "FAIL",
            "error": str(e)
        }

async def main():
    print("=" * 80)
    print("🚀 VOICE BOT TTS DIAGNOSTIC SCRIPT")
    print("=" * 80)
    
    tasks = []
    
    # ✅ DEEPGRAM
    if is_valid_key(settings.deepgram_api_key):
        voices = [
            ("aura-asteria-en", "Asteria"),
            ("aura-luna-en", "Luna"),
        ]
        for vid, vname in voices:
            tasks.append(test_voice(vid, vname, DeepgramTTSProvider, "Deepgram"))
            
    # ✅ ELEVENLABS (Dynamic Fetch)
    if is_valid_key(settings.elevenlabs_api_key):
        try:
            placeholder_provider = ElevenLabsStreamingProvider()
            all_el_voices = await placeholder_provider.get_voices()
            
            # Filter out known failing ones
            blacklist = ["RnauXKDOkyVg9FjwISwR", "FGY2WhTYpPnrIDTdsKH5"]
            all_el_voices = [v for v in all_el_voices if v["id"] not in blacklist]
            
            # Select top voices + prioritize Hindi ones if they exist
            hindi_keywords = ["hindi", "natural", "gentle", "roopa", "sarah"]
            selected_voices = []
            for v in all_el_voices:
                if any(kw in v["name"].lower() for kw in hindi_keywords):
                    selected_voices.append(v)
            
            # Fill remaining with first ones
            for v in all_el_voices:
                if v not in selected_voices:
                    selected_voices.append(v)
            
            # Test top 6 (to keep it concise)
            for v in selected_voices[:6]:
                tasks.append(test_voice(v["id"], v["name"], ElevenLabsStreamingProvider, "ElevenLabs"))
        except Exception as e:
            print(f"❌ Failed to fetch dynamic ElevenLabs voices: {e}")

    if not tasks:
        print("❌ No valid TTS API keys found in .env! Testing aborted.")
        return

    print(f"Found {len(tasks)} valid configurations. Running tests...\n")
    results = await asyncio.gather(*tasks)
    
    # Final Reporting
    print("\n" + "=" * 90)
    print(f"{'PROVIDER':<12} | {'VOICE':<15} | {'ID':<25} | {'STATUS':<6} | {'TTFB':<8}")
    print("-" * 90)
    
    for r in results:
        status = r["status"]
        # Safe extraction of TTFB with fallback to "N/A"
        ttfb_val = r.get("ttfb")
        ttfb_str = f"{ttfb_val:.0f}ms" if ttfb_val is not None else "FAIL"
        
        print(f"{r['provider']:<12} | {r['voice']:<15} | {r['id']:<25} | {status:<6} | {ttfb_str:<8}")
        
    print("=" * 90)
    
    pass_count = len([r for r in results if r["status"] == "PASS"])
    print(f"\nFinal Result: {pass_count}/{len(results)} voices operational.")

if __name__ == "__main__":
    asyncio.run(main())

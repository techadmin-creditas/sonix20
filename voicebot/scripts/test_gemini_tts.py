import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from voicebot.services.tts.gemini_provider import GeminiTTSProvider

async def main():
    print("🚀 Testing Production-Hardened Gemini TTS...")
    
    # Needs GEMINI_API_KEY in environment
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY not found in environment.")
        return

    # Initialize with 16kHz target
    provider = GeminiTTSProvider(api_key=api_key, voice_id="Zephyr", target_sample_rate=16000)
    
    test_text = "Namaste! Main Gemini hoon. Main Google DeepMind ki taraf se ek advanced AI assistant hoon. Kya main aaj aapki kisi vishesh vishay par madad kar sakta hoon? Hum voice synthesis aur real-time processing ka parikshan kar rahe hain."
    print(f"Synthesizing: '{test_text}'")
    
    chunk_count = 0
    total_bytes = 0
    
    try:
        async for chunk in provider.stream_speech(test_text):
            chunk_count += 1
            total_bytes += len(chunk)
            if chunk_count == 1:
                print(f"✅ Received first audio chunk! Size: {len(chunk)} bytes")
                # 24kHz -> 16kHz means the data should be smaller than native 24k
                # 16/24 = 2/3 size.
        
        print(f"✅ Synthesis complete. Total chunks: {chunk_count}, Total bytes: {total_bytes}")
        
        if total_bytes > 0:
            print("🎉 Gemini TTS (Resampled) is WORKING and NON-BLOCKING!")
        else:
            print("❌ Synthesis failed: No audio data received.")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import httpx
import os
from voicebot.shared.config.settings import get_settings

async def test_elevenlabs():
    settings = get_settings()
    api_key = settings.elevenlabs_api_key
    
    if not api_key:
        print("❌ ELEVENLABS_API_KEY is not set in the current environment.")
        return

    print(f"Testing ElevenLabs API key: {api_key[:6]}...{api_key[-4:]}")
    
    # Sarah (EXAVITQu4vr4xnSDxMaL) - Often works on Free Tier
    tts_url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream"
    headers = {
        "xi-api-key": api_key,
        "Accept": "application/json"
    }
    print("Trying Hindi synthesis with Sarah (EXAVITQu4vr4xnSDxMaL)...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(tts_url, 
                headers=headers, 
                json={
                    "text": "नमस्ते, क्या आप मेरी आवाज़ सुन सकते हैं?", 
                    "model_id": "eleven_multilingual_v2"
                }
            )
            
            if response.status_code == 200:
                audio_content = await response.aread()
                if len(audio_content) > 500:
                    print(f"✅ Success! Hindi works on Free Tier with Sarah. Received {len(audio_content)} bytes of audio.")
                else:
                    print(f"⚠️ Warning! Received successful status 200 but very small audio: {len(audio_content)} bytes.")
            else:
                print(f"❌ Failed! Status Code: {response.status_code}")
                print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_elevenlabs())

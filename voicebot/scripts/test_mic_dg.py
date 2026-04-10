import asyncio
import sys
import os
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent.parent))

import pyaudio
from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider
from voicebot.shared.config import get_settings

async def test_mic_stt():
    settings = get_settings()
    
    async def on_transcript(text, is_final, lang, conf, msg_type=None, **kwargs):
        if msg_type == "speech_started":
            print("\n[VAD] Speech Detected! Opening Gate...")
        elif msg_type == "utterance_end":
            print("[VAD] Silence. Closing Gate.")
        elif text:
            color = "\033[92m" if is_final else "\033[90m"
            print(f"{color}Transcript: {text} (conf={conf:.2f})\033[0m")

    # Initialize STT
    stt = DeepgramStreamingProvider(
        api_key=settings.deepgram_api_key,
        language="en"
    )
    # Manual assignment since __init__ doesn't take it
    stt._on_transcript = on_transcript
    
    await stt.connect()
    
    # PyAudio setup
    CHUNK = 160  # 10ms at 16kHz
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 16000
    
    p = pyaudio.PyAudio()
    stream = p.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK
    )
    
    print("\n--- Deepgram Mic Test ---")
    print("Listening... Speak now. Press Ctrl+C to stop.")
    
    try:
        while True:
            data = stream.read(CHUNK, exception_on_overflow=False)
            await stt.send_audio(data)
            await asyncio.sleep(0.001)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
        await stt.disconnect()

if __name__ == "__main__":
    asyncio.run(test_mic_stt())

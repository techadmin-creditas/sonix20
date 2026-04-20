import asyncio
import os
import time
import json
from pathlib import Path
from typing import List

# Import platform components
from voicebot.shared.config import get_settings
from voicebot.services.tts.voice_tts_factory import create_voice_tts

async def run_voice_experiment(text: str, configurations: List[dict]):
    """
    Run a side-by-side comparison of different voice configurations.
    
    configurations: List of dicts with { 'name', 'provider', 'voice_id', 'tts_model' }
    """
    settings = get_settings()
    output_dir = Path("data/experiments") / f"exp_{int(time.time())}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    
    print(f"\n🧪 Starting Voice Experiment")
    print(f"📝 Text: \"{text}\"")
    print(f"📂 Output Directory: {output_dir}\n")
    
    for config in configurations:
        name = config['name']
        provider_type = config.get('provider', 'elevenlabs')
        voice_id = config.get('voice_id')
        tts_model = config.get('tts_model')
        
        print(f"🔊 Testing: {name} ({provider_type} | {voice_id})")
        
        try:
            # Create a mock bot config
            bot_config = {
                "tts_provider": provider_type,
                "voice_id": voice_id,
                "tts_model": tts_model
            }

            # Create the TTS provider via factory
            start_init = time.perf_counter()
            tts = await create_voice_tts(
                bot_config=bot_config,
                settings=settings
            )
            init_time = (time.perf_counter() - start_init) * 1000
            
            # Generate Audio
            start_gen = time.perf_counter()
            audio_buffer = bytearray()
            
            # We use the streaming interface but collect it all for the experiment
            async for chunk in tts.stream_speech(text):
                audio_buffer.extend(chunk)
            
            gen_time = (time.perf_counter() - start_gen) * 1000
            
            # Save to file
            filename = f"{name.replace(' ', '_').lower()}.wav"
            filepath = output_dir / filename
            with open(filepath, "wb") as f:
                f.write(audio_buffer)
            
            results.append({
                "name": name,
                "provider": provider_type,
                "voice_id": voice_id,
                "init_ms": round(init_time, 2),
                "generation_ms": round(gen_time, 2),
                "size_bytes": len(audio_buffer),
                "file": str(filepath)
            })
            print(f"✅ Success: {round(gen_time, 2)}ms")
            
        except Exception as e:
            print(f"❌ Failed {name}: {str(e)}")
            results.append({
                "name": name,
                "error": str(e)
            })

    # Write summary report
    report_path = output_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump({
            "text": text,
            "timestamp": time.ctime(),
            "results": results
        }, f, indent=2)
    
    print(f"\n📊 Experiment Complete. Report saved to {report_path}")
    return results

if __name__ == "__main__":
    # Example Experiment Set
    test_text = "Namaste! Main Creditas se bol raha hoon. Kya aap mujhe sun sakte hain?"
    
    configs = [
        {
            "name": "Sarah Hindi",
            "provider": "elevenlabs",
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "tts_model": "eleven_multilingual_v2"
        },
        {
            "name": "Deepgram Hinglish",
            "provider": "deepgram_ws",
            "voice_id": "aura-stella-en"
        }
    ]
    
    asyncio.run(run_voice_experiment(test_text, configs))

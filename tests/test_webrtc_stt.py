import asyncio
import os
import sys
import numpy as np
try:
    import webrtc_audio_processing as wap
except ImportError:
    wap = None

# Force path for local modules
sys.path.append(os.getcwd())

from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider

async def test_webrtc_integration():
    print("🚀 Starting WebRTC Integration Test...")
    
    # 1. Test WebRTC Module Directly
    if not wap:
        print("⚠️ webrtc_audio_processing NOT installed. Skipping basic module test.")
    else:
        try:
            ap = wap.AudioProcessingModule(enable_ns=True, enable_vad=False)
            ap.set_ns_level(2)
            print("✅ WebRTC AudioProcessingModule initialized successfully.")

            
            # Create 10ms of "noise" (random int16)
            # 16000 Hz * 0.01s = 160 samples
            noise_samples = np.random.randint(-100, 100, 160, dtype=np.int16)
            audio_bytes = noise_samples.tobytes()
            
            clean_audio = ap.process_stream(audio_bytes)
            print(f"✅ WebRTC process_stream worked. Input size: {len(audio_bytes)}, Output size: {len(clean_audio)}")
        except Exception as e:
            print(f"❌ WebRTC Basic Test Failed: {e}")
            return

    # 2. Test Provider Logic (Mocking WebSocket)
    try:
        provider = DeepgramStreamingProvider(api_key="test-key")
        print("✅ DeepgramStreamingProvider initialized.")
        
        # Test adaptive floor update
        for _ in range(10):
            # Send quiet noise
            silent_frame = np.random.randint(-5, 5, 160, dtype=np.int16).tobytes()
            await provider.send_audio(silent_frame)
            
        print(f"📈 Noise Floor after silence: {provider._noise_floor:.2f}")
        
        # Test speech detection
        loud_frame = np.random.randint(-5000, 5000, 160, dtype=np.int16).tobytes()
        
        # We need to mock _connected because send_audio checks it
        provider._connected = True
        # Mock websocket to avoid connection error
        class MockWS:
            state = None
            async def send(self, data): pass
        
        provider._websocket = MockWS()
        from websockets import State
        provider._websocket.state = State.OPEN
        
        await provider.send_audio(loud_frame)
        print(f"🔊 Is Streaming after loud frame? {provider._is_streaming}")
        
        if provider._is_streaming:
            print("✅ VAD Gating logic working as expected.")
        else:
            print("⚠️ VAD Gating did not trigger. Check threshold logic.")
            
    except Exception as e:
        print(f"❌ Provider Logic Test Failed: {e}")

    # 3. Test Irregular Chunk Sizes (The Critical Edge Case)
    try:
        print("\n🧪 Testing Critical Edge Case: Irregular Chunk Sizes...")
        provider.reset_buffer()
        provider._connected = True # Ensure we don't return early

        
        # Send 500 bytes (1 full 320-byte frame + 180 bytes remainder)
        irregular_chunk = np.random.randint(-100, 100, 250, dtype=np.int16).tobytes() # 500 bytes
        print(f"📡 Sending 500-byte chunk...")
        await provider.send_audio(irregular_chunk)
        print(f"📦 Sync Buffer size after 500 bytes: {len(provider._audio_chunk_buffer)} (Expected 180)")
        
        if len(provider._audio_chunk_buffer) != 180:
            print(f"❌ Buffer size mismatch! Expected 180, got {len(provider._audio_chunk_buffer)}")
        else:
            print("✅ 500-byte chunk handled correctly (1 frame processed, 180 bytes buffered).")

        # Send 140 bytes (Completes the second 320-byte frame: 180 + 140 = 320)
        remaining_chunk = np.random.randint(-100, 100, 70, dtype=np.int16).tobytes() # 140 bytes
        print(f"📡 Sending 140-byte chunk...")
        await provider.send_audio(remaining_chunk)
        print(f"📦 Sync Buffer size after 140 bytes: {len(provider._audio_chunk_buffer)} (Expected 0)")

        if len(provider._audio_chunk_buffer) != 0:
            print(f"❌ Buffer size mismatch! Expected 0, got {len(provider._audio_chunk_buffer)}")
        else:
            print("✅ 140-byte chunk handled correctly (Second frame processed).")
            print("🔥 WebRTC survived the irregular bursts!")

    except Exception as e:
        print(f"❌ Irregular Chunk Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_webrtc_integration())


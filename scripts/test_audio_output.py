import pyaudio
import math
import struct

def test_audio_output():
    p = pyaudio.PyAudio()
    
    # Parameters
    rate = 44100
    duration = 3.0  # seconds
    frequency = 440.0  # Hz (A4 note)
    
    print(f"--- Audio Output Test (No-Numpy version) ---")
    print(f"Target: Generate a {frequency}Hz tone for {duration}s")
    
    # Generate a sine wave using math and struct
    audio_data = b''
    total_frames = int(rate * duration)
    
    for i in range(total_frames):
        # Sine wave formula: amplitude * sin(2 * pi * frequency * time)
        # time = frame_index / sample_rate
        value = math.sin(2.0 * math.pi * frequency * (i / rate))
        # Convert to signed 16-bit integer
        int_value = int(value * 32767)
        audio_data += struct.pack('<h', int_value)
    
    try:
        # Open stream
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=rate,
            output=True
        )
        
        print("Playing tone... You should hear a beep.")
        stream.write(audio_data)
        
        stream.stop_stream()
        stream.close()
        print("Test complete.")
        
    except Exception as e:
        print(f"Error playing audio: {e}")
    finally:
        p.terminate()

if __name__ == "__main__":
    test_audio_output()

import pyaudio
import wave
import time

def test_mic_capture():
    p = pyaudio.PyAudio()
    
    # Parameters
    rate = 16000
    duration = 5.0  # seconds
    output_file = "mic_test.wav"
    
    print(f"--- Microphone Capture Test ---")
    print(f"Recording from DEFAULT input for {duration}s...")
    print("Please Speak Now!")
    
    try:
        # Open input stream
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=rate,
            input=True,
            frames_per_buffer=1024
        )
        
        frames = []
        for i in range(0, int(rate / 1024 * duration)):
            data = stream.read(1024, exception_on_overflow=False)
            frames.append(data)
            
        print("Recording complete.")
        stream.stop_stream()
        stream.close()
        
        # Save to file
        wf = wave.open(output_file, 'wb')
        wf.setnchannels(1)
        wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
        wf.setframerate(rate)
        wf.writeframes(b''.join(frames))
        wf.close()
        
        print(f"File saved as {output_file}")
        
        # Playback test
        print("Playing back the recording...")
        stream_out = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=rate,
            output=True
        )
        
        stream_out.write(b''.join(frames))
        stream_out.stop_stream()
        stream_out.close()
        print("Playback complete.")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        p.terminate()

if __name__ == "__main__":
    test_mic_capture()

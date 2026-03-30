import pyaudio

def list_audio_devices():
    p = pyaudio.PyAudio()
    
    print("\n--- Audio Input Devices ---")
    info = p.get_host_api_info_by_index(0)
    num_devices = info.get('deviceCount')
    
    for i in range(num_devices):
        device = p.get_device_info_by_host_api_device_index(0, i)
        if device.get('maxInputChannels') > 0:
            print(f"Device ID {i}: {device.get('name')}")
    
    print("\n--- Audio Output Devices ---")
    for i in range(num_devices):
        device = p.get_device_info_by_host_api_device_index(0, i)
        if device.get('maxOutputChannels') > 0:
            print(f"Device ID {i}: {device.get('name')}")
    
    p.terminate()

if __name__ == "__main__":
    list_audio_devices()

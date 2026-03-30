import pyaudio

p = pyaudio.PyAudio()

stream = p.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=44100,
    input=True,
    input_device_index=0
)

print("Recording...")
data = stream.read(4000)
print("Got audio:", len(data))
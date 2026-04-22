"""
End-to-end STT test: Mic → VAD Gate → Deepgram → Transcripts

Tests the full pipeline used in production:
  1. Captures audio from mic via pyaudio
  2. Passes each chunk through the RMS VAD gate (same as DeepgramStreamingProvider)
  3. Sends gated audio to Deepgram over WebSocket
  4. Prints transcripts (partial and final) in real time

Run:
  python test_stt.py              # 15 seconds, English
  python test_stt.py --lang hi    # Hindi/Hinglish
  python test_stt.py --duration 30

Dependencies:
  pip install pyaudio websockets
"""

import asyncio
import sys
import os
import time
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)

sys.path.insert(0, os.path.dirname(__file__))

from voicebot.services.vad.silero_gate import SileroVADGate
from voicebot.services.stt.deepgram_provider import DeepgramStreamingProvider

SAMPLE_RATE  = 16000
CHUNK_SAMPLES = 512          # 32 ms @ 16 kHz
CHUNK_BYTES   = CHUNK_SAMPLES * 2


# ─── transcript callback ─────────────────────────────────────────────────────

transcript_count = 0

async def on_transcript(text, is_final, language, confidence, msg_type=None):
    global transcript_count
    if msg_type == "speech_started":
        print("\n  [DEEPGRAM] SpeechStarted ↑")
        return
    if msg_type == "utterance_end":
        print("\n  [DEEPGRAM] UtteranceEnd ↓")
        return
    if not text:
        return
    label = "FINAL  " if is_final else "partial"
    transcript_count += 1
    print(f"\n  [{label}] ({language}, conf={confidence:.2f}) \"{text}\"")


# ─── main test ───────────────────────────────────────────────────────────────

async def run(duration: int, language: str):
    try:
        import pyaudio
    except ImportError:
        print("ERROR: pyaudio not installed. Run: pip install pyaudio")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  STT Pipeline Test")
    print(f"  Duration : {duration}s")
    print(f"  Language : {language}")
    print(f"  VAD      : RMS threshold=500")
    print(f"  STT      : Deepgram nova-2")
    print(f"{'='*60}")

    # Init VAD (same params as DeepgramStreamingProvider)
    vad = SileroVADGate(threshold=500.0)
    is_talking = False
    silence_frames = 0
    grace_frames = 50   # 1 s unconditional at start
    MAX_SILENCE = 25    # 500 ms trailing window
    KEEPALIVE_INTERVAL = 250
    silent_since_keepalive = 0

    # Init Deepgram
    stt = DeepgramStreamingProvider(language=language, model="nova-2")
    await stt.connect(on_transcript=on_transcript)
    stt.reset_vad()
    print("\n  Connected to Deepgram. Speak now...\n")

    # Open mic
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SAMPLES,
    )

    start = time.time()
    total_chunks = 0
    sent_chunks = 0
    speech_chunks = 0

    try:
        while time.time() - start < duration:
            audio_bytes = stream.read(CHUNK_SAMPLES, exception_on_overflow=False)
            total_chunks += 1

            speech = vad.is_speech(audio_bytes)
            in_grace = grace_frames > 0
            if in_grace:
                grace_frames -= 1

            if speech:
                is_talking = True
                silence_frames = MAX_SILENCE
            else:
                if silence_frames > 0:
                    silence_frames -= 1
                else:
                    is_talking = False

            if is_talking or in_grace:
                await stt.send_audio(audio_bytes)
                sent_chunks += 1
                silent_since_keepalive = 0
                if speech:
                    speech_chunks += 1
            else:
                silent_since_keepalive += 1
                if silent_since_keepalive >= KEEPALIVE_INTERVAL:
                    silent_since_keepalive = 0
                    # keepalive sent inside stt.send_audio when silence, skip manual here

            elapsed = time.time() - start
            pct_sent = 100 * sent_chunks / max(total_chunks, 1)
            sys.stdout.write(
                f"\r  {elapsed:4.1f}s / {duration}s  "
                f"chunks: total={total_chunks} sent={sent_chunks} ({pct_sent:.0f}%)  "
                f"speech={'YES' if (is_talking or in_grace) else 'no '}"
            )
            sys.stdout.flush()

            await asyncio.sleep(0)   # yield to receive loop

    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()
        await stt.disconnect()

    print(f"\n\n{'='*60}")
    print(f"  RESULTS")
    print(f"  Total chunks  : {total_chunks}")
    print(f"  Sent to STT   : {sent_chunks} ({100*sent_chunks//max(total_chunks,1)}%)")
    print(f"  Speech chunks : {speech_chunks}")
    print(f"  Transcripts   : {transcript_count}")
    print(f"{'='*60}")

    if transcript_count == 0:
        print("\n  ⚠  No transcripts received.")
        print("     - Is your mic picking up audio? (run: python test_vad.py --mic)")
        print("     - Is DEEPGRAM_API_KEY set in your .env?")
        print("     - Try speaking louder or adjusting VAD threshold")
    else:
        print(f"\n  ✓  Pipeline working — {transcript_count} transcript(s) received")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=15)
    parser.add_argument("--lang", type=str, default="hi")
    args = parser.parse_args()

    asyncio.run(run(args.duration, args.lang))

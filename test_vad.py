"""
VAD Test Script — tests SileroVADGate in three modes:

  1. UNIT TEST   — synthetic sine wave (speech-like) vs silence
  2. MODEL INFO  — prints ONNX model input/output names and shapes
  3. MIC TEST    — records 5 seconds from mic and prints per-chunk VAD decisions

Run:
  python test_vad.py              # unit + model info only
  python test_vad.py --mic        # unit + model info + live mic test
"""

import sys
import os
import math
import struct
import logging

logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(name)s: %(message)s")

# Make sure the voicebot package is importable
sys.path.insert(0, os.path.dirname(__file__))

from voicebot.services.vad.silero_gate import SileroVADGate

SAMPLE_RATE = 16000
CHUNK_SAMPLES = 512          # 32 ms @ 16 kHz — Silero V5 required chunk size
CHUNK_BYTES = CHUNK_SAMPLES * 2  # PCM16 = 2 bytes per sample


# ─── helpers ────────────────────────────────────────────────────────────────

def make_sine_chunk(freq=440, amplitude=0.5) -> bytes:
    """Generate one 512-sample chunk of a sine wave as PCM16 bytes."""
    samples = [
        int(amplitude * 32767 * math.sin(2 * math.pi * freq * i / SAMPLE_RATE))
        for i in range(CHUNK_SAMPLES)
    ]
    return struct.pack(f"<{CHUNK_SAMPLES}h", *samples)

def make_silence_chunk() -> bytes:
    return b"\x00" * CHUNK_BYTES

def make_small_chunk(n=192) -> bytes:
    """Sub-frame chunk (the size that caused the original crash)."""
    return b"\x10\x00" * n   # small non-silent value


# ─── test 1: model info ─────────────────────────────────────────────────────

def test_model_info(vad: SileroVADGate):
    print("\n=== VAD Info ===")
    if hasattr(vad, 'session'):
        for inp in vad.session.get_inputs():
            print(f"  INPUT  {inp.name!r:20s}  shape={inp.shape}  dtype={inp.type}")
        for out in vad.session.get_outputs():
            print(f"  OUTPUT {out.name!r:20s}  shape={out.shape}  dtype={out.type}")
    else:
        print("  Mode    : RMS Energy Gate (no ONNX model)")
        print(f"  Threshold: {vad.threshold} RMS units  (speech typically 1000–8000)")


# ─── test 2: unit tests ─────────────────────────────────────────────────────

def test_unit(vad: SileroVADGate):
    print("\n=== Unit Tests ===")
    passed = 0
    failed = 0

    # 2a. Empty bytes → must not crash, must return False
    vad.reset_states()
    result = vad.is_speech(b"")
    ok = result is False
    print(f"  [{'PASS' if ok else 'FAIL'}] Empty bytes → False  (got {result})")
    passed += ok; failed += (not ok)

    # 2b. Sub-frame chunk — must buffer without crashing
    vad.reset_states()
    try:
        result = vad.is_speech(make_small_chunk(192))
        print(f"  [PASS] Sub-frame 192-sample chunk buffered OK  (result={result})")
        passed += 1
    except Exception as e:
        print(f"  [FAIL] Sub-frame chunk crashed: {e}")
        failed += 1

    import numpy as np

    # 2c. Silence → RMS should be near 0, is_speech must return False
    vad.reset_states()
    silence_results = [vad.is_speech(make_silence_chunk()) for _ in range(10)]
    ok = not any(silence_results)
    print(f"  [{'PASS' if ok else 'FAIL'}] Silence chunks → all False  (got {silence_results.count(True)} True)")
    passed += ok; failed += (not ok)

    # 2d. Loud sine wave → RMS ~amplitude*32767 ≈ 11585, well above threshold=500
    vad.reset_states()
    sine_results = [vad.is_speech(make_sine_chunk(freq=440, amplitude=0.5)) for _ in range(10)]
    ok = any(sine_results)
    print(f"  [{'PASS' if ok else 'FAIL'}] Loud sine chunks → speech detected  ({sine_results.count(True)}/10 True)")
    passed += ok; failed += (not ok)

    # 2e. White noise at amplitude ~0.3 → RMS ~9800, well above threshold
    vad.reset_states()
    rng = np.random.default_rng(42)
    noise_results = []
    for _ in range(10):
        chunk = (rng.uniform(-0.3, 0.3, CHUNK_SAMPLES) * 32767).astype(np.int16).tobytes()
        noise_results.append(vad.is_speech(chunk))
    ok = any(noise_results)
    print(f"  [{'PASS' if ok else 'FAIL'}] White noise chunks → speech detected  ({noise_results.count(True)}/10 True)")
    passed += ok; failed += (not ok)

    # 2f. reset_states() must not crash
    try:
        vad.reset_states()
        print(f"  [PASS] reset_states() OK")
        passed += 1
    except Exception as e:
        print(f"  [FAIL] reset_states() crashed: {e}")
        failed += 1

    print(f"\n  Result: {passed} passed, {failed} failed")
    return failed == 0


# ─── test 3: live mic ───────────────────────────────────────────────────────

def test_mic(vad: SileroVADGate, duration_sec=5):
    try:
        import pyaudio
    except ImportError:
        print("\n[SKIP] Mic test: pyaudio not installed. Run: pip install pyaudio")
        return

    print(f"\n=== Mic Test ({duration_sec}s) — speak now! ===")
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SAMPLES,
    )

    vad.reset_states()
    total_chunks = int(SAMPLE_RATE / CHUNK_SAMPLES * duration_sec)
    speech_chunks = 0

    all_probs = []
    for i in range(total_chunks):
        audio_bytes = stream.read(CHUNK_SAMPLES, exception_on_overflow=False)

        # Get raw probability directly for display
        import numpy as np
        pcm = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        rms = float(np.sqrt(np.mean(pcm ** 2))) if len(pcm) > 0 else 0.0
        all_probs.append(rms)

        detected = vad.is_speech(audio_bytes)
        if detected:
            speech_chunks += 1
        bar_len = min(20, int(rms / 500))
        bar = "█" * bar_len
        print(f"\r  chunk {i+1:3d}/{total_chunks}  rms={rms:6.0f}  {bar:<20s}", end="", flush=True)

    if all_probs:
        print(f"\n\n  Peak rms={max(all_probs):.0f}  avg={sum(all_probs)/len(all_probs):.0f}  threshold={vad.threshold}")

    print(f"\n  Speech detected in {speech_chunks}/{total_chunks} chunks "
          f"({100*speech_chunks/total_chunks:.0f}%)")
    if speech_chunks == 0:
        print("  ⚠  No speech detected — mic may not be capturing audio or threshold too high")
        print(f"     Try lowering threshold: SileroVADGate(threshold=100)")
    elif speech_chunks / total_chunks < 0.1:
        print(f"  ⚠  Very little speech — lower threshold below {vad.threshold:.0f}")
    else:
        print("  ✓  VAD is working correctly")

    stream.stop_stream()
    stream.close()
    pa.terminate()


# ─── main ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mic = "--mic" in sys.argv

    print("Initialising SileroVADGate...")
    vad = SileroVADGate(threshold=0.2, sample_rate=SAMPLE_RATE)
    print(f"  threshold: {vad.threshold} (RMS energy; normal speech = 1000–8000)")

    test_model_info(vad)
    ok = test_unit(vad)

    if mic:
        test_mic(vad)
    else:
        print("\nTip: run with --mic to test live microphone input")
        print("     pip install pyaudio  (if not installed)")

    sys.exit(0 if ok else 1)

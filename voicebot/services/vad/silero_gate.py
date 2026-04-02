"""
Energy-based Voice Activity Detector (VAD Gate).

Replaces Silero ONNX (which produced near-zero probabilities regardless of input).
Uses RMS amplitude of PCM16 audio — zero extra dependencies, sub-millisecond latency.

Typical RMS values for 16-bit PCM at 16kHz:
  - True silence / background hum : 50–200
  - Quiet room noise               : 200–500
  - Normal speech                  : 1000–8000
  - Loud speech                    : 8000–20000

Default threshold = 500 catches all normal speech while ignoring ambient noise.
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


class SileroVADGate:
    """
    Drop-in replacement for the Silero VAD gate.
    Detects speech via RMS energy — no model file, no ONNX, no network.
    Keeps the same public interface: is_speech(), reset_states().
    """

    def __init__(self, threshold: float = 500.0, sample_rate: int = 16000):
        # threshold is RMS amplitude in raw int16 units (0–32767)
        self.threshold = threshold
        self.sample_rate = sample_rate
        logger.info(
            "EnergyVADGate initialized (threshold=%s, sample_rate=%s)",
            threshold, sample_rate,
        )

    def reset_states(self) -> None:
        """No-op — kept for API compatibility with the Silero version."""
        pass

    def is_speech(self, audio_bytes: bytes) -> bool:
        """
        Returns True if the RMS energy of the audio chunk exceeds the threshold.
        """
        if not audio_bytes:
            return False

        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        if len(audio) == 0:
            return False

        rms = float(np.sqrt(np.mean(audio ** 2)))
        detected = rms > self.threshold
        logger.debug("VAD rms=%.1f threshold=%.1f speech=%s", rms, self.threshold, detected)
        return detected

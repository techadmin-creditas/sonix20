import math
import struct
import logging

logger = logging.getLogger("voicebot-energy-gate")

class EnergyGate:
    """
    Simple RMS-based energy gate to discard silent audio chunks before processing.
    Helps reduce STT costs by avoiding sending silence to API providers.
    
    Threshold of -45dB is generally safe for typical microphone noise floors.
    """
    def __init__(self, threshold_db: float = -45.0):
        # Convert dB to linear RMS threshold scaled to Int16 (0 - 32768)
        self.threshold_linear = (10 ** (threshold_db / 20)) * 32768.0
        self._silent_chunks = 0
        self._active_chunks = 0

    def is_silent(self, chunk: bytes) -> bool:
        """
        Check if a PCM16 mono chunk is silent.
        """
        if not chunk:
            return True
            
        count = len(chunk) // 2
        if count == 0:
            return True
            
        # Unpack as signed short (Int16)
        try:
            shorts = struct.unpack(f"{count}h", chunk[:count*2])
            # Rapid RMS calculation
            sum_sq = sum(s*s for s in shorts)
            rms = math.sqrt(sum_sq / count)
            
            is_silence = rms < self.threshold_linear
            
            if is_silence:
                self._silent_chunks += 1
            else:
                self._active_chunks += 1
                
            # Periodic logging of savings (every 500 chunks ~10s of audio)
            total = self._silent_chunks + self._active_chunks
            if total % 500 == 0 and total > 0:
                saving = (self._silent_chunks / total) * 100
                logger.info(f"📊 [VAD] Silence Ratio: {saving:.1f}% ({self._silent_chunks} silent / {total} total)")
                
            return is_silence
            
        except Exception as e:
            logger.error(f"EnergyGate unpack error: {e}")
            return False

    def reset_stats(self) -> None:
        self._silent_chunks = 0
        self._active_chunks = 0

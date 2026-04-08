from __future__ import annotations

from pathlib import Path
import wave

try:
    import audioop_lts as audioop
except Exception:  # pragma: no cover - Python versions with stdlib audioop
    import audioop  # type: ignore


class SessionRecorder:
    """Collect user/bot PCM16 streams and export a mixed mono WAV."""

    def __init__(self, sample_rate: int = 16000) -> None:
        self.sample_rate = sample_rate
        self._user_pcm = bytearray()
        self._bot_pcm = bytearray()

    def add_user_pcm(self, pcm16: bytes) -> None:
        if pcm16:
            self._user_pcm.extend(pcm16)

    def add_bot_pcm(self, pcm16: bytes) -> None:
        if pcm16:
            self._bot_pcm.extend(pcm16)

    def finalize(self, session_id: str, output_dir: Path) -> dict | None:
        """Write mixed WAV and return metadata patch for session metadata."""
        if not self._user_pcm and not self._bot_pcm:
            return None

        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{session_id}.wav"

        user = bytes(self._user_pcm)
        bot = bytes(self._bot_pcm)
        max_len = max(len(user), len(bot))
        if max_len == 0:
            return None

        if len(user) < max_len:
            user = user + (b"\x00" * (max_len - len(user)))
        if len(bot) < max_len:
            bot = bot + (b"\x00" * (max_len - len(bot)))

        # Equal-gain sum with clipping handled by audioop.add.
        mixed = audioop.add(audioop.mul(user, 2, 0.5), audioop.mul(bot, 2, 0.5), 2)

        with wave.open(str(out_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self.sample_rate)
            wav.writeframes(mixed)

        return {
            "recording_path": str(out_path),
            "recording_url": f"/assets/recordings/{session_id}.wav",
        }

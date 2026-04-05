"""Deepgram session language resolution from conversation_policy."""

import io
import wave

from voicebot.services.stt.deepgram_provider import (
    deepgram_listen_language_params,
    extract_linear16_pcm_16k_mono,
    resolve_stt_language_for_session,
)


def test_resolve_stt_language_default_hi() -> None:
    assert resolve_stt_language_for_session("hi", {}) == "hi"


def test_resolve_stt_language_hinglish_uses_multilingual() -> None:
    assert resolve_stt_language_for_session("hi", {"stt_language_mode": "hinglish"}) == "multilingual"


def test_resolve_stt_language_multilingual_aliases() -> None:
    for m in ("multilingual", "detect", "auto"):
        assert resolve_stt_language_for_session("en", {"stt_language_mode": m}) == "multilingual"


def test_deepgram_listen_language_params_matches_streaming_rules() -> None:
    assert deepgram_listen_language_params("multilingual") == {"language": "multi"}
    assert deepgram_listen_language_params("hi") == {"language": "hi"}
    assert deepgram_listen_language_params("en") == {"language": "hi"}
    assert deepgram_listen_language_params("hi-en") == {"language": "hi-en"}


def test_extract_linear16_raw_and_wav() -> None:
    pcm = b"\x00\x01" * 160
    assert extract_linear16_pcm_16k_mono(pcm, raw_pcm=True) == pcm
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm)
    wav_bytes = buf.getvalue()
    assert extract_linear16_pcm_16k_mono(wav_bytes, raw_pcm=False) == pcm

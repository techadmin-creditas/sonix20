"""LiveKit URL normalization for browser clients."""

from voicebot.shared.livekit_util import normalize_livekit_client_url


def test_normalize_preserves_ws_localhost() -> None:
    assert normalize_livekit_client_url("ws://localhost:7880") == "ws://localhost:7880"


def test_normalize_preserves_wss() -> None:
    assert normalize_livekit_client_url("wss://voice.example.com") == "wss://voice.example.com"


def test_normalize_http_to_ws() -> None:
    assert normalize_livekit_client_url("http://127.0.0.1:7880") == "ws://127.0.0.1:7880"


def test_normalize_https_to_wss() -> None:
    assert normalize_livekit_client_url("https://voice.example.com") == "wss://voice.example.com"


def test_normalize_empty_defaults() -> None:
    assert normalize_livekit_client_url("") == "ws://127.0.0.1:7880"

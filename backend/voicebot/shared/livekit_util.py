"""LiveKit WebSocket URL normalization for browser clients (livekit-client)."""


def normalize_livekit_client_url(raw: str) -> str:
    """
    Build the WebSocket URL passed to livekit-client Room.connect.

    Local `livekit-server --dev` serves plain ws://; forcing ws→wss breaks localhost.
    """
    # Prefer 127.0.0.1 over localhost: browsers may use IPv6 ::1 while Docker often binds IPv4 only.
    base = (raw or "ws://127.0.0.1:7880").strip()
    if base.startswith("https://"):
        return "wss://" + base[8:]
    if base.startswith("http://"):
        return "ws://" + base[7:]
    if base.startswith(("ws://", "wss://")):
        return base
    return "ws://" + base

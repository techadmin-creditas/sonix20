"""
Transport boundary for voice sessions (WebSocket today; WebRTC/LiveKit can implement the same interface).
"""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable


@runtime_checkable
class VoiceSessionTransport(Protocol):
    async def send_json(self, payload: dict) -> None: ...
    async def send_bytes(self, data: bytes) -> None: ...
    @property
    def connected(self) -> bool: ...


class WebSocketVoiceTransport:
    """Thin adapter around Starlette/FastAPI WebSocket."""

    def __init__(self, websocket: Any):
        self._ws = websocket

    @property
    def connected(self) -> bool:
        try:
            # Check for WebSocketState.CONNECTED (1) for both client and app
            c_state = getattr(self._ws, "client_state", None)
            a_state = getattr(self._ws, "application_state", None)
            
            c_val = getattr(c_state, "value", c_state)
            a_val = getattr(a_state, "value", a_state)
            
            return c_val == 1 and a_val == 1
        except Exception:
            return False

    async def send_json(self, payload: dict) -> None:
        if self.connected:
            try:
                await self._ws.send_json(payload)
            except Exception:
                pass

    async def send_bytes(self, data: bytes) -> None:
        if self.connected and data:
            try:
                await self._ws.send_bytes(data)
            except Exception:
                pass

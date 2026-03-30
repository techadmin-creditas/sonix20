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
            return self._ws.client_state.value == 1
        except Exception:
            return False

    async def send_json(self, payload: dict) -> None:
        if self.connected:
            await self._ws.send_json(payload)

    async def send_bytes(self, data: bytes) -> None:
        if self.connected:
            await self._ws.send_bytes(data)

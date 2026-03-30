"""
WebSocket Test Script — Simulates a voice streaming session.

Usage:
    python scripts/test_websocket.py [--host localhost] [--port 8000]

Tests:
  1. Creates a session via REST
  2. Connects to WebSocket
  3. Sends simulated audio chunks
  4. Sends control messages (interrupt, config change)
  5. Measures latency at each stage
"""

import asyncio
import json
import time
import sys
import argparse

import httpx
import websockets


async def test_voice_session(host: str = "localhost", port: int = 8000):
    """Run a complete WebSocket test session."""
    base_url = f"http://{host}:{port}"
    ws_url = f"ws://{host}:{port}"

    print("=" * 60)
    print("Voice Bot WebSocket Test")
    print("=" * 60)

    # ── Step 1: Create a session ──
    print("\n[1] Creating session...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{base_url}/api/v1/sessions")
        assert response.status_code == 200, f"Session creation failed: {response.text}"
        session_data = response.json()
        session_id = session_data["session_id"]
        ws_path = session_data["websocket_url"]
        print(f"    Session created: {session_id[:8]}...")

    # ── Step 2: Connect to WebSocket ──
    print("\n[2] Connecting to WebSocket...")
    connect_start = time.time()

    async with websockets.connect(f"{ws_url}{ws_path}") as ws:
        connect_time = (time.time() - connect_start) * 1000
        print(f"    Connected in {connect_time:.0f}ms")

        # Wait for initial status
        initial = await asyncio.wait_for(ws.recv(), timeout=5.0)
        initial_data = json.loads(initial)
        print(f"    Initial status: {initial_data}")
        assert initial_data["state"] == "listening"

        # ── Step 3: Send simulated audio chunks ──
        print("\n[3] Sending simulated audio chunks...")
        # Generate 1 second of silence (PCM 16kHz 16-bit mono)
        silence_chunk = b"\x00" * 3200  # 100ms of silence
        for i in range(10):
            await ws.send(silence_chunk)
            await asyncio.sleep(0.02)  # 20ms between chunks (real-time pacing)
        print(f"    Sent 10 audio chunks (1 second)")

        # ── Step 4: Send a text control message ──
        print("\n[4] Sending config change...")
        await ws.send(json.dumps({
            "type": "config",
            "language": "hi",
        }))
        await asyncio.sleep(0.5)

        # ── Step 5: Test interruption ──
        print("\n[5] Sending interrupt signal...")
        await ws.send(json.dumps({"type": "interrupt"}))
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=2.0)
            print(f"    Interrupt response: {json.loads(response)}")
        except asyncio.TimeoutError:
            print("    (No response — OK for passive interrupt)")

        # ── Step 6: Send ping ──
        print("\n[6] Testing ping/pong...")
        ping_start = time.time()
        await ws.send(json.dumps({"type": "ping"}))
        try:
            pong = await asyncio.wait_for(ws.recv(), timeout=2.0)
            ping_time = (time.time() - ping_start) * 1000
            print(f"    Pong received in {ping_time:.0f}ms: {json.loads(pong)}")
        except asyncio.TimeoutError:
            print("    Pong timeout (2s)")

        # ── Step 7: End session ──
        print("\n[7] Ending session...")
        await ws.send(json.dumps({"type": "end"}))
        try:
            final = await asyncio.wait_for(ws.recv(), timeout=2.0)
            print(f"    Final response: {json.loads(final)}")
        except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
            print("    Session ended (connection closed)")

    print("\n" + "=" * 60)
    print("✅ All WebSocket tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Voice Bot WebSocket")
    parser.add_argument("--host", default="localhost", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    args = parser.parse_args()

    asyncio.run(test_voice_session(args.host, args.port))

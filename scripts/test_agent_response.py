"""
Test Agent Agentic Response — Verify tool calling and orchestration.

Usage:
    python scripts/test_agent_response.py
"""

import asyncio
import json
import time
import httpx
import websockets
from websockets.exceptions import ConnectionClosed
import argparse
import sys

async def test_agent_response(host: str, port: int, query: str):
    base_url = f"http://{host}:{port}"
    ws_url = f"ws://{host}:{port}"

    print("\n[INIT] Requesting session...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{base_url}/api/v1/sessions")
        session_data = response.json()
        session_id = session_data["session_id"]
        ws_path = session_data["websocket_url"]
        print(f"       Session ID: {session_id[:8]}...")

    print("\n[WS] Connecting...")
    async with websockets.connect(f"{ws_url}{ws_path}") as ws:
        # 1. Receiver Loop
        async def receive_transcripts():
            print("\n[BOT] Listening for responses...")
            while True:
                msg = await ws.recv()
                if isinstance(msg, bytes):
                    # Skip audio data in this test
                    continue
                    
                data = json.loads(msg)
                if data["type"] == "bot_transcript":
                    print(f"\r[BOT TRANSCRIPT] {data['text']}", end="", flush=True)
                    if data["is_final"]:
                        print("\n[BOT FINAL] Bot is done.")
                        break
                elif data["type"] == "status":
                    print(f"\n[STATUS] {data.get('message', 'No message')}")

        # 3. Send text query (to simulate STT result)
        print(f"\n[USER QUERY] {query}")
        
        await ws.send(json.dumps({
            "type": "text_query",
            "text": query
        }))

        # 3. Wait for the response
        try:
            await asyncio.wait_for(receive_transcripts(), timeout=30.0)
        except asyncio.TimeoutError:
            print("\n❌ TEST FAILED: Response timeout (30s)")
        except ConnectionClosed:
            print("\n❌ WS Connection Closed prematurely.")

    print("\n" + "="*40)
    print("Test Complete. Check log outputs for tool calling verification.")
    print("="*40)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Agent Response")
    parser.add_argument("--host", default="localhost", help="Host of the voice bot server")
    parser.add_argument("--port", type=int, default=8000, help="Port of the voice bot server")
    parser.add_argument("--query", default="Can you book a dental appointment for me tomorrow morning at 10 AM?", help="Test query to send to the bot")
    args = parser.parse_args()

    asyncio.run(test_agent_response(args.host, args.port, args.query))

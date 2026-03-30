
import asyncio
import json
import httpx
import websockets
import sys

BASE_URL = "http://localhost:8000/api/v1"
WS_URL = "ws://localhost:8000"

async def test_session(bot_name="Nova"):
    async with httpx.AsyncClient() as client:
        # 1. Get available bots
        print(f"--- Fetching bots ---")
        res = await client.get(f"{BASE_URL}/bots")
        bots = res.json().get("bots", [])
        
        selected_bot = next((b for b in bots if b["name"] == bot_name), None)
        if not selected_bot:
            print(f"Bot '{bot_name}' not found. Using the first one.")
            selected_bot = bots[0] if bots else None
            
        if not selected_bot:
            print("No bots available!")
            return

        print(f"Selected Bot: {selected_bot['name']} (ID: {selected_bot['id']})")

        # 2. Create session
        print(f"\n--- Creating session for {selected_bot['name']} ---")
        res = await client.post(f"{BASE_URL}/sessions?bot_id={selected_bot['id']}")
        session_data = res.json()
        session_id = session_data["session_id"]
        websocket_url = session_data["websocket_url"]
        print(f"Session Created: {session_id}")
        print(f"WS Path: {websocket_url}")

        # 3. Connect to WebSocket
        full_ws_url = f"{WS_URL}{websocket_url}"
        print(f"\n--- Connecting to WebSocket ---")
        try:
            async with websockets.connect(full_ws_url) as ws:
                print("Connected!")
                
                # Listen for messages
                async def listen():
                    while True:
                        try:
                            msg_data = await ws.recv()
                            
                            # Handle Binary Audio Chunks
                            if isinstance(msg_data, bytes):
                                print(f"  \033[1;36m[AUDIO]\033[0m Received {len(msg_data)} bytes of speech audio", end="\r", flush=True)
                                continue

                            # Handle JSON Text Messages
                            msg_str = msg_data
                            print(f"\n[RECV] {msg_str}", flush=True)
                            msg = json.loads(msg_str)
                            m_type = msg.get("type")
                            
                            if m_type == "status":
                                print(f"  \033[1;32m[STATUS]\033[0m {msg.get('state') or msg.get('message')}", flush=True)
                            elif m_type == "bot_transcript":
                                print(f"  \033[1;34m[BOT]\033[0m {msg.get('text')}", flush=True)
                                # Send response if greeting found
                                if any(x in msg.get("text") for x in ["How can I help", "Hello", "Welcome", "purpose", "Nova", "Max"]):
                                    await asyncio.sleep(1)
                                    print("\n  \033[1;33m[USER]\033[0m Sending query: 'Are you ready?'", flush=True)
                                    await ws.send(json.dumps({"type": "text_query", "text": "Are you ready?"}))
                            elif m_type == "log":
                                print(f"  \033[90m[LOG] {msg.get('tag')} {msg.get('message')}\033[0m", flush=True)
                            elif m_type == "infra_status":
                                print(f"  \033[90m[INFRA] {msg}\033[0m", flush=True)
                        except Exception as loop_err:
                            print(f"\nLoop Error: {loop_err}", flush=True)
                            break

                # Run listener with a timeout
                try:
                    await asyncio.wait_for(listen(), timeout=15.0)
                except asyncio.TimeoutError:
                    print("\nTest finished (timeout).")
        except Exception as e:
            print(f"Connection Failed: {e}")

if __name__ == "__main__":
    bot_to_test = sys.argv[1] if len(sys.argv) > 1 else "Nova"
    asyncio.run(test_session(bot_to_test))


import asyncio
import json
import websockets
import sys

async def test_ws(url):
    print(f"--- Connecting to WebSocket: {url} ---")
    try:
        async with websockets.connect(url) as ws:
            print("\033[1;32m[SUCCESS]\033[0m Connected to bot session!")
            
            async def listen():
                while True:
                    try:
                        msg_data = await ws.recv()
                        
                        # Handle Binary Audio Chunks
                        if isinstance(msg_data, bytes):
                            print(f"  \033[1;36m[AUDIO]\033[0m Received {len(msg_data)} bytes", end="\r", flush=True)
                            continue

                        # Handle JSON Text Messages
                        msg_str = msg_data
                        msg = json.loads(msg_str)
                        m_type = msg.get("type")
                        
                        if m_type == "status":
                            print(f"  \033[1;32m[STATUS]\033[0m {msg.get('state') or msg.get('message')}", flush=True)
                        elif m_type == "bot_transcript":
                            print(f"\n  \033[1;34m[BOT]\033[0m {msg.get('text')}", flush=True)
                        elif m_type == "transcript":
                            print(f"  \033[1;33m[USER TRANSCRIPT]\033[0m {msg.get('text')}", flush=True)
                        elif m_type == "log":
                            print(f"  \033[90m[LOG] {msg.get('tag')} {msg.get('message')}\033[0m", flush=True)
                        elif m_type == "infra_status":
                            print(f"  \033[90m[INFRA] {msg.get('id')}\033[0m", flush=True)
                        else:
                            print(f"\n[RECV] {msg_str}", flush=True)
                            
                    except Exception as loop_err:
                        print(f"\n[ERROR] Loop Error: {loop_err}", flush=True)
                        break

            # Send a trigger query after connection to start conversation if needed
            # (Bot should greet automatically but this ensures activity)
            await asyncio.sleep(1)
            print("\n--- Sending initial query: 'Hello, identify yourself.' ---")
            await ws.send(json.dumps({"type": "text_query", "text": "Hello, identify yourself."}))

            # Run listener with a timeout
            try:
                await asyncio.wait_for(listen(), timeout=10.0)
            except asyncio.TimeoutError:
                print("\n--- Test finished (timeout). ---")
                
    except Exception as e:
        print(f"\033[1;31m[FAILED]\033[0m Connection error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/test_ws.py <websocket_url>")
        sys.exit(1)
        
    ws_url = sys.argv[1]
    asyncio.run(test_ws(ws_url))

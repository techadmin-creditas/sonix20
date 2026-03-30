"""
Agent Terminal — Interactive REPL for the Voice Bot.

This script allows you to chat with the agent directly from your terminal
using text queries. It connects via WebSocket and displays transcripts,
status updates, and tool execution logs.

Usage:
    python scripts/agent_terminal.py --port 8000
"""

import asyncio
import json
import logging
import sys
import argparse
import httpx
import websockets
from websockets.exceptions import ConnectionClosed

# Configure minimal logging for the terminal UI
logging.basicConfig(level=logging.ERROR)

async def agent_terminal(host: str, port: int):
    base_url = f"http://{host}:{port}"
    ws_url = f"ws://{host}:{port}"

    print("\033[95m" + "="*60)
    print("      🚀 AGENTIC VOICE BOT — TERMINAL REPL 🚀")
    print("="*60 + "\033[0m")
    print("Type your message and press Enter. Type 'exit' or 'quit' to stop.\n")

    # 1. Create Session
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{base_url}/api/v1/sessions")
            session_data = response.json()
            session_id = session_data["session_id"]
            ws_path = session_data["websocket_url"]
            print(f"\033[90m[SESSION] {session_id}\033[0m")
    except Exception as e:
        print(f"\033[91m[ERROR] Failed to connect to server: {e}\033[0m")
        return

    # 2. Connect and Start REPL
    try:
        async with websockets.connect(f"{ws_url}{ws_path}") as ws:
            
            async def receive_messages():
                """Background task to handle incoming WebSocket messages."""
                try:
                    while True:
                        msg = await ws.recv()
                        if isinstance(msg, bytes):
                            continue # Ignore audio data in terminal REPL
                            
                        data = json.loads(msg)
                        msg_type = data.get("type")
                        
                        if msg_type == "bot_transcript":
                            text = data.get("text", "")
                            if data.get("is_final"):
                                # Final transcript: Clear line and print with a newline
                                sys.stdout.write(f"\r\033[K\033[94m[BOT]\033[0m {text}\n")
                                sys.stdout.flush()
                            else:
                                # Progressive stream: Clear line and print with no newline
                                sys.stdout.write(f"\r\033[K\033[94m[BOT]\033[0m {text}...")
                                sys.stdout.flush()
                                
                        elif msg_type == "status":
                            state = data.get("state", "")
                            if state:
                                # Show status at the end of the current line temporarily
                                sys.stdout.write(f"\033[90m [{state}]\033[0m")
                                sys.stdout.flush()
                except ConnectionClosed:
                    pass

            # Start message receiver
            receiver_task = asyncio.create_task(receive_messages())

            # REPL Loop
            try:
                while True:
                    # Use run_in_executor to avoid blocking the event loop with input()
                    user_input = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: input("\n\033[92m[USER] > \033[0m")
                    )

                    if user_input.lower() in ["exit", "quit"]:
                        break

                    if not user_input.strip():
                        continue

                    # Send text query to agent
                    await ws.send(json.dumps({
                        "type": "text_query",
                        "text": user_input
                    }))
                    
                    # Small sleep to allow status messages to print
                    await asyncio.sleep(0.1)

            finally:
                receiver_task.cancel()
                print("\n\033[95m" + "="*60)
                print("      Goodbye! 🚀")
                print("="*60 + "\033[0m")

    except Exception as e:
        print(f"\n\033[91m[ERROR] WebSocket error: {e}\033[0m")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Bot Terminal Chat")
    parser.add_argument("--host", default="localhost", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    args = parser.parse_args()

    try:
        asyncio.run(agent_terminal(args.host, args.port))
    except KeyboardInterrupt:
        pass

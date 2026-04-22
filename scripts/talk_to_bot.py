"""
Voice Agent CLI — Talk to the bot from your terminal (requires PyAudio).

This script captures your microphone audio, sends it to the STT engine via WebSocket,
and prints the resulting agentic response.

Usage:
    python scripts/talk_to_bot.py --port 8000
"""

import asyncio
import json
import logging
import sys
import argparse
import websockets
import httpx

# Configure logging
logging.basicConfig(level=logging.ERROR)

async def talk_to_bot(host: str, port: int, input_device: int = None, debug: bool = False, stt_mode: str = None):
    import math
    import struct
    base_url = f"http://{host}:{port}"
    ws_url = f"ws://{host}:{port}"

    # 1. Check for PyAudio
    try:
        import pyaudio
    except ImportError:
        print("\033[91m[ERROR] PyAudio not installed.\033[0m")
        print("Please install it to use voice chat: \033[92m./venv/bin/pip install pyaudio\033[0m")
        return

    # 2. Create Session
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{base_url}/api/v1/sessions")
            session_id = response.json()["session_id"]
            ws_path = response.json()["websocket_url"]
    except Exception as e:
        print(f"\033[91m[ERROR] Failed to connect: {e}\033[0m")
        return

    # 3. Connect to WebSocket
    print("\n\033[95m" + "="*60)
    print(f"      🎤 TALKING TO AGENT (Session: {session_id[:8]}) 🎤")
    print("="*60 + "\033[0m")
    print("Agent is listening... (Speak into your microphone)\n")

    try:
        final_ws_url = f"{ws_url}{ws_path}"
        if stt_mode:
            final_ws_url += f"{'&' if '?' in final_ws_url else '?'}stt_mode={stt_mode}"
            
        async with websockets.connect(final_ws_url) as ws:
            
            # --- AUDIO SETUP ---
            p = pyaudio.PyAudio()
            # 16kHz Mono 16-bit PCM (Standard for our Deepgram TTS)
            audio_out = p.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=16000, 
                output=True,
                frames_per_buffer=1024
            )

            async def audio_stream_task():
                """Task to capture and send audio from mic."""
                # Use 16kHz to match Deepgram STT engine requirements
                stream = p.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=16000,
                    input=True,
                    input_device_index=input_device,
                    frames_per_buffer=1024
                )

                byte_count = 0
                try:
                    while True:
                        data = stream.read(1024, exception_on_overflow=False)
                        
                        # Audio Level Calculation (RMS)
                        count = len(data) / 2
                        format = "%dh" % (count)
                        shorts = struct.unpack(format, data)
                        sum_squares = sum(s*s for s in shorts)
                        rms = math.sqrt(sum_squares / count)
                        level = int(rms / 100)
                        meter = "█" * min(level, 20)
                        
                        if debug:
                            byte_count += len(data)
                            sys.stdout.write(f"\r\033[93m[MIC]\033[0m {meter:<20} | Sent: {byte_count/1024:.1f} KB")
                        else:
                            sys.stdout.write(f"\r\033[32m[MIC]\033[0m {meter:<20}")
                        sys.stdout.flush()

                        await ws.send(data)
                        await asyncio.sleep(0.01)
                except Exception as e:
                    print(f"\033[91m[ERROR] Mic stream failed: {e}\033[0m")
                finally:
                    stream.stop_stream()
                    stream.close()

            async def response_task():
                """Task to handle incoming transcripts and status."""
                while True:
                    msg = await ws.recv()
                    if isinstance(msg, bytes):
                        # PLAY AUDIO CHUNK
                        audio_out.write(msg)
                        continue
                        
                    data = json.loads(msg)
                    if data.get("type") == "transcript":
                        text = data.get('text', '')
                        if text:
                            # Print on a new line to avoid overwriting the MIC meter
                            sys.stdout.write(f"\n\033[90m[USER]\033[0m {text}\n")
                            sys.stdout.flush()
                    elif data.get("type") == "bot_transcript":
                        text = data.get('text', '')
                        if data.get("is_final"):
                            sys.stdout.write(f"\n\033[94m[BOT]\033[0m {text}\n")
                        else:
                            sys.stdout.write(f"\r\033[94m[BOT]\033[0m {text}...")
                        sys.stdout.flush()
                    elif data.get("type") == "audio_interrupt":
                        # CRITICAL: Stop the local speaker immediately on interruption
                        # to match server-side state.
                        audio_out.stop_stream()
                        audio_out.start_stream() # Re-start so it can take new chunks
                        sys.stdout.write("\n\033[91m[STOPPED]\033[0m interruption detected\n")
                        sys.stdout.flush()

            # Start tasks
            streamer = asyncio.create_task(audio_stream_task())
            responder = asyncio.create_task(response_task())
            
            try:
                await asyncio.gather(streamer, responder)
            except asyncio.CancelledError:
                pass
            finally:
                audio_out.stop_stream()
                audio_out.close()
                p.terminate()

    except Exception as e:
        print(f"\n\033[91m[ERROR] Session error: {e}\033[0m")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Bot CLI Chat")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--input-device", type=int, default=None, help="Input device index")
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug logging")
    parser.add_argument("--hinglish", action="store_true", help="Enable Hinglish (Romanized Hindi) output")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger("websockets").setLevel(logging.DEBUG)
        print("\033[93m[DEBUG] Debug mode enabled.\033[0m")

    try:
        asyncio.run(talk_to_bot(
            args.host, 
            args.port, 
            input_device=args.input_device, 
            debug=args.debug,
            stt_mode="hinglish" if args.hinglish else None
        ))
    except KeyboardInterrupt:
        pass

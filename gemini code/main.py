import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from gemini_live import GeminiLive

# Load environment variables
load_dotenv()

# Configure logging - DEBUG for our modules, INFO for everything else
logging.basicConfig(level=logging.INFO)
logging.getLogger("gemini_live").setLevel(logging.DEBUG)
logging.getLogger(__name__).setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("MODEL", "gemini-3.1-flash-live-preview")

# Saved prompts file
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "saved_prompts.json")

# Conversations directory
CONVERSATIONS_DIR = os.path.join(os.path.dirname(__file__), "conversations")
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)


def _load_prompts() -> dict:
    if os.path.exists(PROMPTS_FILE):
        with open(PROMPTS_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_prompts(prompts: dict):
    with open(PROMPTS_FILE, "w") as f:
        json.dump(prompts, f, indent=2)


class PromptData(BaseModel):
    voice: str
    system_prompt: str
    opening_sentence: str = ""


# Initialize FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


# --- Saved Prompts API ---

@app.get("/api/prompts")
async def list_prompts():
    return _load_prompts()


@app.post("/api/prompts/{name}")
async def save_prompt(name: str, data: PromptData):
    prompts = _load_prompts()
    prompts[name] = {"voice": data.voice, "systemPrompt": data.system_prompt, "openingSentence": data.opening_sentence}
    _save_prompts(prompts)
    return {"ok": True}


@app.delete("/api/prompts/{name}")
async def delete_prompt(name: str):
    prompts = _load_prompts()
    prompts.pop(name, None)
    _save_prompts(prompts)
    return {"ok": True}


# --- Conversations API ---

def _get_conversation_path(session_id: str) -> str:
    return os.path.join(CONVERSATIONS_DIR, session_id)


@app.get("/api/conversations")
async def list_conversations():
    """List all saved conversations, newest first."""
    conversations = []
    if not os.path.exists(CONVERSATIONS_DIR):
        return conversations
    for entry in os.listdir(CONVERSATIONS_DIR):
        meta_path = os.path.join(CONVERSATIONS_DIR, entry, "meta.json")
        if os.path.isfile(meta_path):
            with open(meta_path, "r") as f:
                meta = json.load(f)
            meta["id"] = entry
            meta["has_audio"] = os.path.isfile(
                os.path.join(CONVERSATIONS_DIR, entry, "recording.webm")
            )
            conversations.append(meta)
    conversations.sort(key=lambda c: c.get("timestamp", ""), reverse=True)
    return conversations


@app.get("/api/conversations/{session_id}")
async def get_conversation(session_id: str):
    """Get a single conversation's transcript and metadata."""
    conv_dir = _get_conversation_path(session_id)
    meta_path = os.path.join(conv_dir, "meta.json")
    if not os.path.isfile(meta_path):
        return {"error": "Not found"}
    with open(meta_path, "r") as f:
        meta = json.load(f)
    meta["id"] = session_id
    meta["has_audio"] = os.path.isfile(os.path.join(conv_dir, "recording.webm"))
    return meta


@app.get("/api/conversations/{session_id}/audio")
async def get_conversation_audio(session_id: str):
    """Download the audio recording for a conversation."""
    audio_path = os.path.join(_get_conversation_path(session_id), "recording.webm")
    if not os.path.isfile(audio_path):
        return {"error": "No audio recording found"}
    return FileResponse(audio_path, media_type="audio/webm", filename=f"recording-{session_id}.webm")


@app.post("/api/conversations/{session_id}/audio")
async def upload_conversation_audio(session_id: str, file: UploadFile = File(...)):
    """Upload an audio recording for a conversation."""
    conv_dir = _get_conversation_path(session_id)
    if not os.path.isdir(conv_dir):
        os.makedirs(conv_dir, exist_ok=True)
    audio_path = os.path.join(conv_dir, "recording.webm")
    content = await file.read()
    with open(audio_path, "wb") as f:
        f.write(content)
    logger.info(f"Saved audio recording for session {session_id}: {len(content)} bytes")
    return {"ok": True}


@app.delete("/api/conversations/{session_id}")
async def delete_conversation(session_id: str):
    """Delete a conversation and its recording."""
    import shutil
    conv_dir = _get_conversation_path(session_id)
    if os.path.isdir(conv_dir):
        shutil.rmtree(conv_dir)
    return {"ok": True}


# Serve static files (must be after API routes)
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for Gemini Live."""
    await websocket.accept()

    logger.info("WebSocket connection accepted")

    audio_input_queue = asyncio.Queue()
    video_input_queue = asyncio.Queue()
    text_input_queue = asyncio.Queue()

    async def audio_output_callback(data):
        await websocket.send_bytes(data)

    async def audio_interrupt_callback():
        # The event queue handles the JSON message, but we might want to do something else here
        pass

    # Wait for config message from client
    voice_name = "Puck"
    system_prompt = "You are a helpful AI assistant. Keep your responses concise."
    opening_sentence = ""
    try:
        first_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        payload = json.loads(first_msg)
        if isinstance(payload, dict) and payload.get("type") == "config":
            voice_name = payload.get("voice_name", voice_name)
            system_prompt = payload.get("system_prompt", system_prompt)
            opening_sentence = payload.get("opening_sentence", "").strip()
            logger.info(f"{'=='*40}\nReceived config: voice={voice_name}, system_prompt={system_prompt}, opening_sentence={opening_sentence}...\n{'=='*40}")
    except (asyncio.TimeoutError, json.JSONDecodeError) as e:
        logger.warning(f"No config message received, using defaults: {e}")

    # Generate a session ID and prepare conversation tracking
    session_id = str(uuid.uuid4())[:8] + "-" + datetime.now().strftime("%Y%m%d%H%M%S")
    conversation_messages = []

    # Send session ID to client so it can upload audio later
    await websocket.send_json({"type": "session_id", "session_id": session_id})

    # Queue opening sentence to be sent as the first text message to Gemini
    if opening_sentence:
        await text_input_queue.put(json.dumps({"text": opening_sentence}))
        logger.info(f"Queued opening sentence: {opening_sentence}")

    gemini_client = GeminiLive(
        api_key=GEMINI_API_KEY, model=MODEL, input_sample_rate=16000,
        voice_name=voice_name, system_prompt=system_prompt,
    )

    async def receive_from_client():
        try:
            while True:
                message = await websocket.receive()

                if message.get("bytes"):
                    await audio_input_queue.put(message["bytes"])
                elif message.get("text"):
                    text = message["text"]
                    try:
                        payload = json.loads(text)
                        if isinstance(payload, dict) and payload.get("type") == "image":
                            logger.info(f"Received image chunk from client: {len(payload['data'])} base64 chars")
                            image_data = base64.b64decode(payload["data"])
                            await video_input_queue.put(image_data)
                            continue
                        if isinstance(payload, dict) and payload.get("type") == "config":
                            continue  # Already handled
                    except json.JSONDecodeError:
                        pass

                    await text_input_queue.put(text)
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")
        except Exception as e:
            logger.error(f"Error receiving from client: {e}")

    receive_task = asyncio.create_task(receive_from_client())

    async def run_session():
        start_new_message = True
        async for event in gemini_client.start_session(
            audio_input_queue=audio_input_queue,
            video_input_queue=video_input_queue,
            text_input_queue=text_input_queue,
            audio_output_callback=audio_output_callback,
            audio_interrupt_callback=audio_interrupt_callback,
        ):
            if event:
                evt_type = event.get("type")
                # Track conversation messages for saving (merge chunks within same turn)
                if evt_type in ("user", "gemini"):
                    role = evt_type
                    if (not start_new_message
                            and conversation_messages
                            and conversation_messages[-1]["role"] == role):
                        conversation_messages[-1]["text"] += event["text"]
                    else:
                        conversation_messages.append({
                            "role": role,
                            "text": event["text"],
                            "timestamp": datetime.now().isoformat(),
                        })
                        start_new_message = False
                elif evt_type in ("turn_complete", "interrupted"):
                    start_new_message = True
                # Forward events (transcriptions, etc) to client
                try:
                    await websocket.send_json(event)
                except Exception:
                    break

    try:
        await run_session()
    except Exception as e:
        import traceback
        logger.error(f"Error in Gemini session: {type(e).__name__}: {e}\n{traceback.format_exc()}")
    finally:
        receive_task.cancel()

        # Save conversation
        try:
            conv_dir = _get_conversation_path(session_id)
            os.makedirs(conv_dir, exist_ok=True)
            meta = {
                "timestamp": datetime.now().isoformat(),
                "voice": voice_name,
                "system_prompt": system_prompt,
                "messages": conversation_messages,
            }
            with open(os.path.join(conv_dir, "meta.json"), "w") as f:
                json.dump(meta, f, indent=2)
            logger.info(f"Saved conversation {session_id} with {len(conversation_messages)} messages")
        except Exception as save_err:
            logger.error(f"Failed to save conversation {session_id}: {save_err}")

        # Ensure websocket is closed if not already
        try:
            await websocket.close()
        except:
            pass


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="localhost", port=port)

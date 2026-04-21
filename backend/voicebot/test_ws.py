import asyncio
from fastapi import FastAPI, WebSocket
import uvicorn
from multiprocessing import Process
import websockets

app = FastAPI()

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    data = await websocket.receive()
    print("RECEIVED TEXT:", data, flush=True)
    data = await websocket.receive()
    print("RECEIVED BYTES:", data, flush=True)
    await websocket.close()

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

async def test_client():
    await asyncio.sleep(1) # wait for server
    async with websockets.connect("ws://127.0.0.1:8000/ws") as ws:
        await ws.send("hello")
        await ws.send(b"123")
    await asyncio.sleep(1)

if __name__ == "__main__":
    p = Process(target=run_server)
    p.start()
    asyncio.run(test_client())
    p.terminate()

import asyncio
import logging
import httpx
import numpy as np
from livekit import rtc, api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("terminal-test")

async def main():
    # 1. Create a session on your backend to trigger the Agent
    async with httpx.AsyncClient() as client:
        # Get a bot ID first
        bots_res = await client.get("http://localhost:8000/api/v1/bots")
        bot_id = bots_res.json()["bots"][0]["id"]
        
        logger.info(f"Creating session for Bot: {bot_id} (WebRTC mode)...")
        res = await client.post("http://localhost:8000/api/v1/sessions", params={
            "bot_id": bot_id,
            "transport": "webrtc"
        })
        
        data = res.json()
        if not data.get("livekit"):
            logger.error(f"❌ Server failed to provide LiveKit info: {data.get('livekit_error')}")
            return
        
        room_name = data["livekit"]["room_name"]
        url = data["livekit"]["url"]
        
        logger.info(f"✅ Session Created: {data['session_id']} (Room: {room_name})")

    # 2. Configure our own test token for the same room
    API_KEY = "devkey" # From your settings
    API_SECRET = "secret"
    
    token = (
        api.AccessToken(API_KEY, API_SECRET)
        .with_identity("terminal-tester")
        .with_name("Voice Terminal")
        .with_grants(api.VideoGrants(room_join=True, room=room_name, can_publish=True, can_subscribe=True))
        .to_jwt()
    )

    room = rtc.Room()
    
    @room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
             logger.info(f"👂 BOT RESPONSE DETECTED from {participant.identity}!")

    logger.info(f"Connecting to {url}...")
    await room.connect(url, token)
    
    # 3. Stream 2 seconds of 440Hz sine wave (Mock speech)
    source = rtc.AudioSource(16000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("mic", source)
    await room.local_participant.publish_track(track)
    
    # Send 2 seconds in small chunks
    chunk_size = 3200 # 200ms at 16k
    sample_rate = 16000
    t = np.linspace(0, 2.0, int(sample_rate * 2.0))
    audio_data = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    
    logger.info("🎤 Streaming 2 seconds of mock 'audio' to bot...")
    for i in range(0, len(audio_data), chunk_size):
        chunk = audio_data[i:i+chunk_size]
        frame = rtc.AudioFrame(chunk.tobytes(), sample_rate, 1, len(chunk))
        await source.capture_frame(frame)
        await asyncio.sleep(0.15) # Mimic real streaming
    
    logger.info("⏳ Waiting for bot reply...")
    await asyncio.sleep(10)
    await room.disconnect()
    logger.info("Done.")

if __name__ == "__main__":
    asyncio.run(main())

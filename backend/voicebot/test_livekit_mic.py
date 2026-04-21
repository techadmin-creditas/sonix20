import asyncio
import logging
import os
import numpy as np
from livekit import rtc, api

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test-client")

async def main():
    # 1. Configuration (Matching your dev settings)
    URL = "ws://localhost:7880"
    API_KEY = "devkey"
    API_SECRET = "secret"
    ROOM_NAME = "voice-test"

    # 2. Get Access Token
    token = (
        api.AccessToken(API_KEY, API_SECRET)
        .with_identity("terminal-test-user")
        .with_name("Terminal Tester")
        .with_grants(api.VideoGrants(room_join=True, room=ROOM_NAME, can_publish=True, can_subscribe=True))
        .to_jwt()
    )

    room = rtc.Room()
    
    @room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"Connected: {participant.identity}")

    @room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"✅ Bot is speaking! (Track: {track.sid} from {participant.identity})")

    logger.info(f"Connecting to {URL} (Room: {ROOM_NAME})...")
    await room.connect(URL, token)
    logger.info("✅ Connected to room!")

    # 3. Create a Local Audio Track (Sine wave simulation)
    # We send a small burst of 'speech-like' frequency to trigger the bot
    source = rtc.AudioSource(16000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("test-mic", source)
    publication = await room.local_participant.publish_track(track)
    logger.info(f"✅ Mic Published: {publication.sid}")

    # Generate 1 second of audio
    sample_rate = 16000
    duration = 1.0 # seconds
    t = np.linspace(0, duration, int(sample_rate * duration))
    # 440Hz sine wave as "speech"
    audio_data = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    
    frame = rtc.AudioFrame(audio_data.tobytes(), sample_rate, 1, len(audio_data))
    
    logger.info("🚀 Sending 1 second of test audio...")
    await source.capture_frame(frame)
    
    logger.info("⏳ Waiting 10 seconds for bot response...")
    await asyncio.sleep(10)
    
    await room.disconnect()
    logger.info("Done.")

if __name__ == "__main__":
    asyncio.run(main())

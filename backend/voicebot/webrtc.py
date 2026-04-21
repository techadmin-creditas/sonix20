import json
import asyncio
import logging
import uuid
from typing import Optional

from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
import av

from voicebot.core.orchestrator.brain import AgenticBrain, SessionState

logger = logging.getLogger("webrtc")

pcs = set()
relay = MediaRelay()

class TTSMediaTrack(MediaStreamTrack):
    """
    A WebRTC audio track that reads raw 16-bit 16000Hz PCM
    from a queue and yields av.AudioFrames for the browser.
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.queue = asyncio.Queue()
        self.pts = 0
        self.rate = 16000
        # We need frames of 20ms (320 samples)
        self.frame_samples = 320
        self.sample_width = 2
        self.buffer = bytearray()

    async def add_pcm_bytes(self, pcm_data: bytes):
        await self.queue.put(pcm_data)

    async def recv(self):
        # We must return exactly one frame of matching size
        while len(self.buffer) < self.frame_samples * self.sample_width:
            chunk = await self.queue.get()
            if chunk is None:
                # End of track
                raise Exception("Track finished")
            self.buffer.extend(chunk)

        # Extract 20ms chunk
        chunk_size = self.frame_samples * self.sample_width
        pcm_chunk = self.buffer[:chunk_size]
        self.buffer = self.buffer[chunk_size:]

        frame = av.AudioFrame(format='s16', layout='mono', samples=self.frame_samples)
        frame.sample_rate = self.rate
        frame.planes[0].update(pcm_chunk)
        frame.pts = self.pts
        frame.time_base = av.Fraction(1, self.rate)
        self.pts += self.frame_samples

        return frame

# To be integrated with Brain

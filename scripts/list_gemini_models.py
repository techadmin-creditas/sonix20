"""
Available Models Explorer.

Lists all available models for the current Gemini API Key.
"""

from __future__ import annotations

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google import genai
from voicebot.shared.config import get_settings

settings = get_settings()

async def list_models():
    client = genai.Client(api_key=settings.gemini_api_key)
    print("Fetching models for your API key...")
    try:
        # Using synchronous list_models for speed in this tool
        for model in client.models.list():
            print(f"- {model.name} (v: {model.version})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())

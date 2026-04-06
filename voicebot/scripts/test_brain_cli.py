import asyncio
import sys
import os
import uuid
import time
import json
from pathlib import Path
from typing import Any, AsyncIterator, List, Optional

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from voicebot.core.orchestrator.brain import AgenticBrain, BotState
from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.shared.models.session import SessionState, TurnRole
from voicebot.shared.models.tools import ToolCall, ToolResult, LLMResponse
from voicebot.shared.config import get_settings
from voicebot.shared.logging.logger import setup_logger
from voicebot.services.llm.groq_provider import GroqStreamingProvider
from voicebot.services.llm.voice_llm_factory import wrap_llm_with_fallbacks

logger = setup_logger("cli-tester", level="INFO")
settings = get_settings()

class MockTTS:
    """Mock TTS that prints to console instead of generating audio."""
    async def stream_speech(self, text: str, **kwargs) -> AsyncIterator[bytes]:
        # We don't yield bytes, just print the text as if speaking
        print(f"\n\033[94m[BOT SPEAKING]\033[0m: {text}")
        yield b"" # Dummy yield to satisfy the async iterator

    async def reset(self):
        pass

async def run_cli_tester(bot_id: str = "011813c4"):
    """
    Run the AgenticBrain in a terminal loop.
    """
    db = SQLiteProvider()
    await db.initialize()

    # Load Bot Config
    bot_config = await db.get_bot(bot_id)
    if not bot_config:
        print(f"Error: Bot ID {bot_id} not found in database.")
        return

    print(f"\n\033[1m--- SONIX 2.0 CLI TESTER ---\033[0m")
    print(f"Bot: {bot_config['name']}")
    print(f"Goal: Secure Axis Bank Voice Flow (Account + DOB + Phone)\n")

    # Initialize Session
    session_id = str(uuid.uuid4())
    session = SessionState(
        session_id=session_id,
        detected_language=bot_config.get("default_language", "hi")
    )

    # Persist session to DB to avoid FOREIGN KEY constraint errors during logging
    await db.create_session(session_id, bot_id=bot_id, language=session.detected_language)

    # Initialize LLM (with optional fallbacks when keys are configured)
    llm = GroqStreamingProvider(
        model=bot_config.get("llm_model", "llama-3.3-70b-versatile")
    )
    llm = wrap_llm_with_fallbacks(llm, bot_config, settings)

    # Callbacks for UI/Console tracing
    async def on_bot_transcript(text, is_final):
        if is_final:
            pass # We already print in MockTTS for "speaking" feel

    async def on_tool_call(name, args):
        print(f"\n\033[93m[TOOL CALL]\033[0m: {name}({json.dumps(args, indent=2)})")

    async def on_tool_result(name, result):
        color = "\033[92m" if "verified" in result.lower() else "\033[91m"
        print(f"{color}[TOOL RESULT]\033[0m: {result}")

    async def on_log(tag, message, color_tag):
        # Translate frontend color tags to terminal colors if needed
        print(f"\033[90m{tag} {message}\033[0m")

    # Initialize Brain
    brain = AgenticBrain(
        session=session,
        llm_handler=llm,
        tts_handler=MockTTS(),
        db_handler=db,
        bot_config=bot_config,
        on_bot_transcript=on_bot_transcript,
        on_tool_call=on_tool_call,
        on_tool_result=on_tool_result,
        on_log=on_log
    )

    # --- Start Conversation ---
    greeting = bot_config.get("greeting", "Hello!")
    print(f"\n\033[94m[BOT GREETING]\033[0m: {greeting}")
    session.add_turn(TurnRole.ASSISTANT, greeting)

    try:
        while True:
            user_input = input("\n\033[1mUser > \033[0m")
            if user_input.lower() in ["exit", "quit", "q"]:
                break
            
            if not user_input.strip():
                continue

            # Process the turn
            # brain._process_user_turn handles guards, tools, and LLM generation
            await brain._process_user_turn(user_input)

    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        await llm.disconnect()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sonix 2.0 Brain CLI Tester")
    parser.add_argument("--bot_id", type=str, default="011813c4", help="Bot ID to load")
    args = parser.parse_args()

    asyncio.run(run_cli_tester(args.bot_id))

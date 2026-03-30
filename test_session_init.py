import asyncio
import logging
from voicebot.api.v1.routes import get_db

logging.basicConfig(level=logging.INFO)

async def test_session():
    try:
        db = await get_db()
        print("DB Initialized")
        await db.create_session("local-test-session", bot_id="recovery-blank")
        print("Session Created Successfully")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_session())

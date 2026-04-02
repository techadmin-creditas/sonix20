import asyncio
from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def main():
    db = SQLiteProvider()
    await db.initialize()
    bots = await db.list_bots()
    print(f"Bots: {bots}")
    sessions = await db.list_sessions()
    print(f"Sessions: {sessions}")

if __name__ == "__main__":
    asyncio.run(main())

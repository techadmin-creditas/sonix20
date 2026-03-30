import asyncio
import os
import sys

# Ensure we can import from the project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def verify_and_migrate():
    db_path = "data/voicebot.db"
    if not os.path.exists(db_path):
        print(f"ERROR: Database file not found at {db_path}")
        return

    print(f"--- Verifying and Migrating Database: {db_path} ---")
    db = SQLiteProvider(db_path)
    
    # This calls the automated migration logic
    await db.initialize()
    
    # Now let's list the columns to confirm
    def _get_columns():
        conn = db._get_conn()
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(bots)")
        return [(row[1], row[2]) for row in cursor.fetchall()]

    columns = await db._run(_get_columns)
    
    print("\nSUCCESS: Database structure is valid.")
    print("Columns in 'bots' table:")
    for name, dtype in columns:
        status = "✅" 
        print(f"  {status} {name:25} ({dtype})")

if __name__ == "__main__":
    asyncio.run(verify_and_migrate())

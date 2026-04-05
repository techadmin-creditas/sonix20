import asyncio
import os
import sys
import json
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.tools.registry import ToolRegistry
from voicebot.core.tools.base import BaseTool
from voicebot.core.orchestrator.brain import AgenticBrain, SessionState

async def test_all_tools():
    print("🛠️ Testing All Tools with Real Database...")
    
    # 1. Initialize DB Provider
    db_path = Path("data/voicebot.db")
    if not db_path.exists():
        print(f"❌ Error: {db_path} not found!")
        return
        
    db = SQLiteProvider(db_path=str(db_path))
    await db.initialize()
    
    # 2. Setup Session and Brain
    # Create session in DB to satisfy foreign keys
    bot_id = "011813c4"
    session_id = "test-all-tools-session"
    await db.create_session(session_id=session_id, bot_id=bot_id)
    
    session = SessionState()
    session.session_id = session_id
    
    # Mock log_call on BaseTool to avoid excessive noise (optional)
    # BaseTool.log_call = AsyncMock() 
    
    # Mock brain for tool context
    brain = MagicMock()
    brain.memory = None # Redis
    brain._vector_memory = None
    brain._topic_restriction = None
    brain.llm = None
    
    # 3. Test Tools
    
    # --- Tool: search_knowledge ---
    print("\n--- 1. search_knowledge ---")
    search_tool = ToolRegistry.instantiate_tool("search_knowledge", session=session, db=db, brain=brain)
    res = await search_tool.execute(query="lounge access", bot_id="011813c4")
    print(f"Result: {res[:100]}...")

    # --- Tool: verify_customer ---
    print("\n--- 2. verify_customer ---")
    verify_tool = ToolRegistry.instantiate_tool("verify_customer", session=session, db=db, brain=brain)
    res = await verify_tool.execute(account_number="ACC1002", dob="22-07-1985", phone_last_4="6780")
    print(f"Result: {res}")
    print(f"Session UserID after verification: {session.user_id}")

    # --- Tool: get_account_balance ---
    print("\n--- 3. get_account_balance ---")
    balance_tool = ToolRegistry.instantiate_tool("get_account_balance", session=session, db=db, brain=brain)
    res = await balance_tool.execute(account_number="ACC1002")
    print(f"Result: {res}")

    # --- Tool: get_loan_status ---
    print("\n--- 4. get_loan_status ---")
    loan_tool = ToolRegistry.instantiate_tool("get_loan_status", session=session, db=db, brain=brain)
    res = await loan_tool.execute(account_number="ACC1002")
    print(f"Result: {res}")

    # --- Tool: remember_user_fact ---
    print("\n--- 5. remember_user_fact ---")
    fact_tool = ToolRegistry.instantiate_tool("remember_user_fact", session=session, db=db, brain=brain)
    res = await fact_tool.execute(fact="I prefer 10 AM appointments", category="preference")
    print(f"Result: {res}")

    # --- Tool: get_appointments ---
    print("\n--- 6. get_appointments ---")
    appt_tool = ToolRegistry.instantiate_tool("get_appointments", session=session, db=db, brain=brain)
    res = await appt_tool.execute() # Should find no appointments for this test session unless defined
    print(f"Result: {res}")

    # --- Tool: get_weather (Mock/Config check) ---
    print("\n--- 7. get_weather ---")
    weather_tool = ToolRegistry.instantiate_tool("get_weather", session=session, db=db, brain=brain)
    # This will likely fail or show config error as per code
    res = await weather_tool.execute(city="Mumbai")
    print(f"Result: {res[:100]}...")

if __name__ == "__main__":
    asyncio.run(test_all_tools())

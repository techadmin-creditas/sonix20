import asyncio
import os
import sys
import json
from pathlib import Path

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.tools.implementations.knowledge_search import SearchKnowledgeTool
from voicebot.core.orchestrator.brain import AgenticBrain, SessionState

async def test_real_search():
    print("🔍 Testing Real Knowledge Search...")
    
    # 1. Initialize DB Provider
    db_path = Path("data/voicebot.db")
    if not db_path.exists():
        print(f"❌ Error: {db_path} not found!")
        return
        
    db = SQLiteProvider(db_path=str(db_path))
    await db.initialize()
    
    # 2. Mock AgenticBrain and Session
    session = SessionState()
    session.session_id = "test-real-search"
    
    # 3. Instantiate Tool
    tool = SearchKnowledgeTool()
    tool.db = db
    
    # Optional: Mock brain for the tool if needed (e.g. for logging)
    brain_mock = type('MockBrain', (), {
        'memory': None, 
        '_vector_memory': None,
        '_topic_restriction': None,
        'llm': None
    })
    tool.brain = brain_mock
    
    # 4. Test execution with your query
    test_queries = [
        "movie offers",
        "lounge access",
        "annual fees",
        "AJIO",
        "my zone"
    ]
    
    for query in test_queries:
        print(f"\n--- Query: '{query}' ---")
        result = await tool.execute(query=query, bot_id="011813c4")
        print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(test_real_search())

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.core.tools.implementations.knowledge_search import SearchKnowledgeTool

class AsyncIterator:
    def __init__(self, items):
        self.items = items
    def __aiter__(self):
        return self
    async def __anext__(self):
        if not self.items:
            raise StopAsyncIteration
        return self.items.pop(0)

@pytest.mark.asyncio
async def test_topic_gatekeeper_blocks_off_topic():
    # Setup brain with a topic restriction
    mock_llm = MagicMock()
    
    def mock_stream(*args, **kwargs):
        return AsyncIterator([MagicMock(content="NO")])
        
    mock_llm.stream_completion = MagicMock(side_effect=mock_stream)
    mock_llm._get_client.return_value = asyncio.sleep(0)
    
    bot_config = {
        "id": "bot_123",
        "topic_restriction": "Indian Banking",
        "refuse_off_topic": 1
    }
    
    brain = AgenticBrain(session=MagicMock(), bot_config=bot_config, llm_handler=mock_llm)
    
    # Mock _generate_and_speak to capture refusal
    brain._generate_and_speak = AsyncMock()
    # Mock log event call
    brain._log_event = AsyncMock()
    
    # Process off-topic query
    await brain._process_user_turn("What is the weather in London?")
    
    # Verify refusal was called
    brain._generate_and_speak.assert_called_once()
    args, _ = brain._generate_and_speak.call_args
    assert "specialized in Indian Banking" in args[0]

@pytest.mark.asyncio
async def test_auto_rag_tool_web_fallback(monkeypatch):
    # Setup tool with brain context
    mock_brain = MagicMock()
    mock_brain._topic_restriction = "Indian Banking"
    mock_brain._get_search_query = AsyncMock(return_value="SBI FD rate")
    mock_brain.llm = MagicMock()
    mock_brain._vector_memory = AsyncMock()
    
    # Mock web search provider using monkeypatch
    mock_results = [{"snippet": "SBI offers 7% interest on FD", "link": "https://sbi.com"}]
    
    class MockSearchProvider:
        async def get_web_results(self, query):
            return mock_results
            
    monkeypatch.setattr("voicebot.services.memory.search_provider.SearchProvider", MockSearchProvider)
    
    tool = SearchKnowledgeTool(brain=mock_brain, db=AsyncMock())
    tool._summarize_web_results = AsyncMock(return_value="SBI FD interest rate is 7%.")
    # Mock log call
    tool.log_call = AsyncMock()
    
    # Execute tool when local search (mocked db) returns no hits
    tool.db.search_knowledge.return_value = []
    
    result = await tool.execute(query="What is SBI FD rate?", bot_id="bot_123")
    
    assert "SBI FD interest rate is 7%" in result
    # Verify it was stored in vector memory
    mock_brain._vector_memory.store_fact.assert_called_once()

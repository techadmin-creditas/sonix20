import asyncio
import json
import logging
from unittest.mock import AsyncMock

from voicebot.shared.logging.logger import setup_logger
from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.services.llm.groq_provider import GroqStreamingProvider
from voicebot.shared.models.session import SessionState

logger = setup_logger("test-workflow", level="DEBUG")

mock_workflow_json = {
    "nodes": [
        {
            "id": "node_input_1",
            "type": "user-input"
        },
        {
            "id": "node_branch_1",
            "type": "smart-branch",
        },
        {
            "id": "node_bot_a",
            "type": "bot-says",
            "config": {"message": "You chose Option A."}
        },
        {
            "id": "node_bot_b",
            "type": "bot-says",
            "config": {"message": "You chose Option B."}
        }
    ],
    "edges": [
        {
            "source": "node_input_1",
            "target": "node_branch_1"
        },
        {
            "source": "node_branch_1",
            "target": "node_bot_a",
            "label": "Option A"
        },
        {
            "source": "node_branch_1",
            "target": "node_bot_b",
            "label": "Option B"
        }
    ],
    "start_node_id": "node_input_1"
}

async def main():
    db = SQLiteProvider()
    await db.initialize()
    
    # Push generic test workflow
    wf_id = "wf_test_123"
    await db.save_workflow(wf_id, "Generic Split", "Test A/B flow", mock_workflow_json["nodes"], mock_workflow_json["edges"])
    
    # 1. Setup Brain
    llm = GroqStreamingProvider(model="llama-3.3-70b-versatile")
    session = SessionState(session_id="test_session_xyz")
    
    brain = AgenticBrain(
        session=session,
        llm_handler=llm,
        db_handler=db,
        bot_config={"id": "mock_bot", "workflow_id": wf_id}
    )
    
    # Mock TTS for verification
    brain._generate_and_speak = AsyncMock()
    brain._log_event = AsyncMock()
    
    # Initialize engine manually (normally in start_conversation)
    brain.workflow_engine = WorkflowEngine(brain, {"nodes": mock_workflow_json["nodes"], "edges": mock_workflow_json["edges"], "start_node_id": "node_input_1"})
    
    # Test 1: Global Interceptor (Escalate)
    logger.info("=== Test 1: Global Escalation ===")
    yield_to_llm = await brain.workflow_engine.evaluate("Actually I need to speak to a manager immediately, I have a problem")
    assert not yield_to_llm
    brain._generate_and_speak.assert_called_with("Please wait while I transfer you to a human agent.")
    logger.info("Test 1 PASS: Escalate Intercepted")
    
    # Test 2: Smart Branch -> Option B
    logger.info("=== Test 2: Evaluate Flow into Option B ===")
    # Reset mock
    brain._generate_and_speak.reset_mock()
    # "Option B" semantic equivalent
    yield_to_llm = await brain.workflow_engine.evaluate("I think I would definitely prefer to go with the second choice you mentioned.")
    assert not yield_to_llm
    brain._generate_and_speak.assert_called_with("You chose Option B.")
    logger.info("Test 2 PASS: Smart Branch B")

if __name__ == "__main__":
    asyncio.run(main())

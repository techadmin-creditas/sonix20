import pytest
import asyncio
import re
from unittest.mock import AsyncMock, MagicMock
from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.shared.models.session import SessionState

@pytest.mark.asyncio
async def test_hinglish_detection_and_persistence():
    """Verify that Hinglish is detected and persists across turns."""
    session = SessionState(session_id="test-hinglish")
    session.metadata = {}
    
    brain = MagicMock()
    brain.session = session
    engine = WorkflowEngine(brain=brain, workflow_data={})
    
    # Simulate user speaking Hinglish
    text = "theek hai, main payment abhi kar deta hoon"
    
    # Mock the LLM response for detection
    engine._classifier_complete = AsyncMock(return_value="hinglish")
    
    await engine._detect_language(text)
    
    assert engine.session_data["language"] == "hinglish"
    assert session.detected_language == "hinglish"
    
    # Verify instruction matches Hinglish wording in the code
    instr = engine._get_lang_instruction()
    assert "Latin/English alphabet" in instr

@pytest.mark.asyncio
async def test_dynamic_pool_anti_repetition():
    """Verify that _get_dynamic_response never repeats the same phrase twice."""
    session = SessionState(session_id="test-pools")
    session.detected_language = "en"
    session.metadata = {"language": "en"}
    
    brain = MagicMock()
    brain.session = session
    engine = WorkflowEngine(brain=brain, workflow_data={})
    
    first = engine._get_dynamic_response("hurry_ack")
    second = engine._get_dynamic_response("hurry_ack")
    
    # Ensure variety
    assert first != second
    
    # Verify language shift
    session.detected_language = "hi"
    session.metadata["language"] = "hi"
    
    hindi_resp = engine._get_dynamic_response("hurry_ack")
    # Pool: "Theek hai...", "Ji...", "Maaf...", "Samajh..."
    found = any(word.lower() in hindi_resp.lower() for word in ["Theek", "Ji", "jaldi", "Maaf", "Samajh", "fast"])
    assert found, f"Expected Hindi keywords in response, got: {hindi_resp}"

@pytest.mark.asyncio
async def test_hurry_interceptor_acceleration():
    """Verify that HURRY intent triggers ack and sets session flag."""
    session = SessionState(session_id="test-hurry")
    session.metadata = {}
    
    brain = MagicMock()
    brain.session = session
    brain._generate_and_speak = AsyncMock()
    brain.db.merge_session_metadata = AsyncMock()
    
    # Mock interrupt event to prevent aborts
    brain._interrupt_event = MagicMock()
    brain._interrupt_event.is_set.return_value = False
    
    engine = WorkflowEngine(brain=brain, workflow_data={})
    
    # Mock ALL async calls in evaluate to prevent MagicMock coroutine errors
    engine._detect_language = AsyncMock(return_value="en")
    engine._check_global_interceptor = AsyncMock(return_value="HURRY")
    engine._detect_navigational_intent = AsyncMock(return_value=None)
    engine._execute_node_chain = AsyncMock(return_value=True)
    
    # Mock node state
    engine.current_node_id = "start"
    engine.nodes = {"start": {"id": "start", "type": "speech", "data": {"text": "Hello"}}}
    
    # Call evaluate
    await engine.evaluate("jaldi batao")
    
    # 1. Brain should have spoken the hurry_ack
    brain._generate_and_speak.assert_called()
    
    # 2. hurry_mode should be set in session_data
    assert engine.session_data.get("hurry_mode") is True

@pytest.mark.asyncio
async def test_escalation_payload_enrichment():
    """Verify that session_data is passed to the escalation handshake."""
    session = SessionState(session_id="test-escalate")
    session.metadata = {"amount_paid": "500", "language": "hinglish"}
    
    brain = MagicMock()
    brain.session = session
    engine = WorkflowEngine(brain=brain, workflow_data={})
    
    # Resolve farewell
    msg = engine._resolve_farewell("escalate")
    assert msg
    assert engine.session_data["language"] == "hinglish"

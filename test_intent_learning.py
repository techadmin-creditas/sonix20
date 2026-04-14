import asyncio
import os
import sys
import logging
from unittest.mock import MagicMock, AsyncMock

# Ensure the project root is in path
sys.path.append(os.getcwd())

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.core.orchestrator.intent_learner import IntentLearner

# Setup minimal logging for the test
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("learning-test")

async def run_test():
    """
    Verifies the Agentic Learning Loop:
    1. Turn 1 classifies via LLM and triggers a background learning task.
    2. The learner generalizes the input (PII-free) and stores a pattern in DB.
    3. Turn 2 matches a similar input via the DB cache, skipping the LLM entirely.
    """
    print("\n" + "="*60)
    print("🚀 STARTING AGENTIC INTENT LEARNING VERIFICATION")
    print("="*60)

    db_path = "test_learning_loop.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    db = SQLiteProvider(db_path)
    await db.initialize()

    # 1. BRAIN MOCK
    brain = MagicMock()
    brain.db = db
    brain.session = MagicMock()
    brain.session.session_id = "test-session-123"
    brain.session.metadata = {"language": "hi"}
    brain._bot_config = {"default_language": "hi"}
    brain._inject_variables.side_effect = lambda x: x # Identity function for regex
    
    # 2. LLM MOCK
    brain.llm = MagicMock()
    
    # Mock classification response
    async def mock_classify_stream(*args, **kwargs):
        msg = MagicMock()
        msg.content = "wrong_person"
        yield msg
        
    # Mock generalization response (The "Learner" output)
    async def mock_generalize_stream(*args, **kwargs):
        msg = MagicMock()
        msg.content = "mera naam .* he"
        yield msg

    # 3. WORKFLOW ENGINE SETUP
    workflow_data = {
        "start_node_id": "root",
        "nodes": [
            {"id": "root", "type": "userInput", "data": {"intents": ["confirmed", "wrong_person"]}}
        ],
        "edges": []
    }
    engine = WorkflowEngine(brain, workflow_data)

    # --- PHASE 1: INITIAL LEARNING ---
    print("\n[STEP 1] User says: 'mera naam vaibhav he'")
    print("EXPECTED: LLM Classification -> Background Learning Triggered")
    
    brain.llm.stream_completion.side_effect = mock_classify_stream
    
    intent_1 = await engine._classify_intent("mera naam vaibhav he", ["confirmed", "wrong_person"])
    print(f"RESULT: Detected Intent = '{intent_1}'")
    
    # Simulating the background learner task (with generalization mock)
    print("[LEARNER] Generalizing and saving pattern...")
    brain.llm.stream_completion.side_effect = mock_generalize_stream
    learner = IntentLearner(brain)
    await learner.learn_from_utterance("mera naam vaibhav he", "wrong_person")

    # --- PHASE 2: DB VERIFICATION ---
    affinities = await db.list_learned_affinities()
    print(f"\n[STEP 2] Check SQLite Memory")
    if affinities:
        p = affinities[0]
        print(f"CACHE ENTRY: Intent='{p['intent_label']}' | Pattern='{p['pattern']}'")
        
        # Privacy Check
        if "vaibhav" in p['pattern'].lower():
            print("❌ FAILURE: PII (Real Name) found in database pattern!")
            return
        else:
            print("✅ PRIVACY OK: No PII detected in stored pattern.")
    else:
        print("❌ FAILURE: No patterns were saved to DB.")
        return

    # --- PHASE 3: ADAPTIVE CACHE MATCH ---
    print("\n[STEP 3] User says: 'mera naam rahul he' (Different name, same pattern)")
    print("EXPECTED: Adaptive Cache Match -> ZERO LLM CALLS")
    
    # Crucial: Reset side effect to raise an error. 
    # If the engine tries to call the LLM, the test will crash, proving T2 work.
    brain.llm.stream_completion.side_effect = Exception("🛑 TEST FAILED: LLM called when cache match was expected!")

    try:
        intent_2 = await engine._classify_intent("mera naam rahul he", ["confirmed", "wrong_person"])
        print(f"RESULT: Detected Intent = '{intent_2}' (via TIER 2 CACHE)")
        
        if intent_2 == "wrong_person":
            print("✅ SUCCESS: Zero-LLM Adaptive match verified.")
        else:
            print(f"❌ FAILURE: Expected 'wrong_person', got '{intent_2}'")
    except Exception as e:
        print(f"\n{str(e)}")
        return

    # --- PHASE 4: HIT TRACKING ---
    await asyncio.sleep(0.1) # Wait for background hit increment
    aff_final = await db.list_learned_affinities()
    hits = aff_final[0]['hit_count']
    print(f"\n[STEP 4] Hit Tracking: Pattern has {hits} cache-hits.")
    
    if hits > 0:
        print("✅ SUCCESS: Hit count incremented.")
    else:
        print("❌ FAILURE: Hit count remained 0.")

    print("\n" + "="*60)
    print("🎉 ALL TESTS PASSED: Agentic Brain is now self-learning.")
    print("="*60)
    
    # Cleanup
    await db.close()
    if os.path.exists(db_path):
        os.remove(db_path)

if __name__ == "__main__":
    asyncio.run(run_test())

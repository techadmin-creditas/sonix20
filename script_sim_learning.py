import asyncio
import os
import sys
import re
from typing import List
from unittest.mock import MagicMock

# Ensure project root is in path
sys.path.append(os.getcwd())

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.core.orchestrator.intent_learner import IntentLearner

async def run_simulation():
    db_path = "sim_learning.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    db = SQLiteProvider(db_path)
    await db.initialize()

    # 1. Setup Brain & LLM
    brain = MagicMock()
    brain.db = db
    brain.session = MagicMock()
    brain.session.session_id = "sim-session-001"
    brain.session.metadata = {"language": "hi"}
    brain._bot_config = {"default_language": "hi"}
    brain._inject_variables.side_effect = lambda x: x
    
    # Real Groq Provider for high-fidelity testing
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    brain.llm = GroqStreamingProvider()

    # 2. Setup Engine
    workflow_data = {
        "start_node_id": "root",
        "nodes": [
            {"id": "root", "type": "userInput", "data": {"intents": ["confirmed", "wrong_person"]}}
        ],
        "edges": []
    }
    engine = WorkflowEngine(brain, workflow_data)
    learner = IntentLearner(brain)

    scenarios = [
        # SCENARIO 1: AGENTIC DISCOVERY (New Intent)
        {"input": "main manager se complain karunga", "label": "DISCOVERY TEST"},
        {"input": "main boss se complain karunga", "label": "DISCOVERY CACHE CHECK"},
        
        # SCENARIO 2: LANGUAGE LOCK (English)
        {"input": "good morning dear agent", "label": "ENGLISH LOCK TEST"},
        
        # SCENARIO 3: HINGLISH FLEX (Variation match)
        {"input": "mera naam vaibhav he", "label": "HINGLISH FLEX TEST"},
        {"input": "mera naam rahul hai", "label": "HINGLISH CACHE CHECK"}
    ]

    print("\n" + "="*80)
    print("🔥 AGENTIC INTELLIGENCE SIMULATION: Discovery & Language Lock")
    print("="*80)

    for step in scenarios:
        user_text = step['input']
        label = step['label']
        
        print(f"\n[{label}] User: \"{user_text}\"")
        
        # 1. Check Cache
        learned = await db.list_learned_affinities()
        match = None
        for aff in learned:
            if re.search(aff["pattern"], user_text, re.I | re.UNICODE):
                match = aff
                break
        
        if match:
            print(f"✅ CACHED: Intent='{match['intent_label']}' | Pattern='{match['pattern']}'")
        else:
            print(f"🧠 LEARNING: Consulting Neural Network...")
            intent = await engine._classify_intent(user_text, ["confirmed", "wrong_person"])
            print(f"Result: LLM detected intent '{intent}'")
            
            if intent != "NONE":
                await learner.learn_from_utterance(user_text, intent)
                await asyncio.sleep(0.5)
                # Verify what was saved
                update = await db.list_learned_affinities()
                if update:
                    new_pat = update[-1]['pattern']
                    print(f"Memory Update: Saved PII-safe pattern: '{new_pat}'")

    print("\n" + "="*80)
    print("🎯 SIMULATION COMPLETE")
    print("="*80)
    
    await db.close()
    if os.path.exists(db_path): os.remove(db_path)

if __name__ == "__main__":
    asyncio.run(run_simulation())

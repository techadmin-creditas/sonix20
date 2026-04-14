import asyncio
import os
import sys
import re
from typing import List, Dict

# Ensure project root is in path
sys.path.append(os.getcwd())

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.core.orchestrator.intent_learner import IntentLearner
from unittest.mock import MagicMock

test_scenarios = [
    {"input": "or kya haal he", "expect": "greeting"},
    {"input": "mera naam vaibhav hai", "expect": "introduction"},
    {"input": "kal paise de dunga", "expect": "ptp"},
    {"input": "manager se baat karao", "expect": "escalation"},
    {"input": "don't call me again", "expect": "dnc"}
]

async def run_debug_test():
    db_path = "debug_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    db = SQLiteProvider(db_path)
    await db.initialize()

    brain = MagicMock()
    brain.db = db
    brain.session = MagicMock()
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    brain.llm = GroqStreamingProvider()
    brain._bot_config = {"default_language": "hi"}
    brain._inject_variables.side_effect = lambda x: x

    engine = WorkflowEngine(brain, {"nodes": [], "edges": []})
    learner = IntentLearner(brain)

    print("\n[PHASE 1] TRAINING", flush=True)
    for sample in test_scenarios:
        text = sample["input"]
        intent = await engine._classify_intent(text, ["greeting", "wrong_person"])
        print(f"User: {text} -> LLM Detected: {intent}", flush=True)
        await learner.learn_from_utterance(text, intent)
        await asyncio.sleep(0.5)

    print("\n[PHASE 2] DATABASE CONTENT", flush=True)
    learned = await db.list_learned_affinities()
    for row in learned:
        print(f"Stored Pattern: {row['pattern']} | Intent: {row['intent_label']}", flush=True)

    print("\n[PHASE 3] CACHE MATCHING", flush=True)
    for sample in test_scenarios:
        text = sample["input"]
        match = False
        for row in learned:
            if re.search(row['pattern'], text, re.I | re.UNICODE):
                print(f"Match: '{text}' matched by '{row['pattern']}' ✅", flush=True)
                match = True
                break
        if not match:
            print(f"FAIL: '{text}' did NOT match any stored pattern ❌", flush=True)

    await db.close()

if __name__ == "__main__":
    asyncio.run(run_debug_test())

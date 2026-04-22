import asyncio
import os
import sys
import re

# Ensure project root is in path
sys.path.append(os.getcwd())

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.core.orchestrator.intent_learner import IntentLearner
from unittest.mock import MagicMock

async def test_languages():
    db_path = "lang_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    db = SQLiteProvider(db_path)
    await db.initialize()

    brain = MagicMock()
    brain.db = db
    brain.session = MagicMock()
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    brain.llm = GroqStreamingProvider()
    brain._bot_config = {"default_language": "en"}
    brain._inject_variables.side_effect = lambda x: x

    engine = WorkflowEngine(brain, {"nodes": [], "edges": []})
    learner = IntentLearner(brain)

    test_cases = [
        {"text": "Mujhe abhi baat nahi karni", "lang": "Hindi", "expect": "callback"},
        {"text": "konichiwa bot-san", "lang": "Japanese", "expect": "greeting"}
    ]

    print("\n" + "="*50)
    print("🌍 MULTI-LANGUAGE AGENTIC TEST")
    print("="*50)

    for case in test_cases:
        print(f"\n[{case['lang']}] Input: \"{case['text']}\"")
        intent = await engine._classify_intent(case['text'], ["greeting", "callback"])
        print(f"Detected Intent: {intent}")
        
        await learner.learn_from_utterance(case['text'], intent)
        await asyncio.sleep(2) # Quota safety
        
        # Verify Cache
        learned = await db.list_learned_affinities()
        pat = learned[-1]['pattern']
        print(f"Learned Pattern: {pat}")
        
        if re.search(pat, case['text'], re.I | re.UNICODE):
            print(f"✅ VERIFIED: Local Cache will catch this {case['lang']} phrase!")

    await db.close()

if __name__ == "__main__":
    asyncio.run(test_languages())

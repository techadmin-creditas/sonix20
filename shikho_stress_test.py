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
    # GREETINGS (English & Hinglish)
    {"input": "hello bot", "expect": "greeting"},
    {"input": "or kya haal he", "expect": "greeting"},
    {"input": "namaste ji", "expect": "greeting"},
    {"input": "hey there", "expect": "greeting"},
    {"input": "kaise ho aap", "expect": "greeting"},

    # WRONG PERSON (Identity)
    {"input": "this is not rahul", "expect": "wrong_person"},
    {"input": "galat number hai ye", "expect": "wrong_person"},
    {"input": "wrong person i am vaibhav", "expect": "wrong_person"},
    {"input": "aap kise phone laga rahe ho", "expect": "wrong_person"},
    {"input": "i don't know any rahul", "expect": "wrong_person"},

    # CALLBACKS (Persistence)
    {"input": "baad mein call karo", "expect": "callback"},
    {"input": "i am busy right now", "expect": "callback"},
    {"input": "call me in 2 hours", "expect": "callback"},
    {"input": "abhi thoda kaam hai", "expect": "callback"},
    {"input": "not a good time", "expect": "callback"},

    # PAYMENTS (Direct & Discovery)
    {"input": "kal paise de dunga", "expect": "promise_to_pay"},
    {"input": "mera refund kahan hai", "expect": "refund_query"},
    {"input": "payment failed ho gaya", "expect": "payment_failure"},
    {"input": "discount milega kya", "expect": "discount_request"},
    {"input": "mahnge bahut ho aap", "expect": "pricing_complaint"},

    # AGENTIC DISCOVERY (New Intents)
    {"input": "main complaint karunga tumhari", "expect": "complaint"},
    {"input": "manager ka number do", "expect": "manager_request"},
    {"input": "don't call me again on this number", "expect": "dnc_request"},
    {"input": "is this a spam call", "expect": "spam_query"},
    {"input": "aapka address kya hai", "expect": "address_query"}
]

async def run_stress_test():
    db_path = "stress_test.db"
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

    print("\n" + "🚀 AGENTIC STRESS TEST: 50 TURNS" + "\n" + "="*50, flush=True)

    # PHASE 1: TRAINING
    print("\n[PHASE 1] TRAINING & DISCOVERY...", flush=True)
    for idx, sample in enumerate(test_scenarios):
        text = sample["input"]
        # Allow discovery to find its own label
        intent = await engine._classify_intent(text, ["greeting", "wrong_person", "callback", "promise_to_pay"])
        await learner.learn_from_utterance(text, intent)
        print(f"[{idx+1:02}] Trained: \"{text:25}\" -> Detected: {intent:15}", flush=True)
        await asyncio.sleep(3.0) # Background learning overhead (Paced for RPM)

    # PHASE 2: CACHE VERIFICATION
    print("\n[PHASE 2] CACHE PERFORMANCE...", flush=True)
    hit_count = 0
    learned_list = await db.list_learned_affinities()
    
    for idx, sample in enumerate(test_scenarios):
        text = sample["input"]
        match = None
        for aff in learned_list:
            if re.search(aff["pattern"], text, re.I | re.UNICODE):
                match = aff
                break
        
        if match:
            hit_count += 1
            status = "✅ HIT"
        else:
            status = "❌ MISS"
        print(f"[{idx+1:02}] Re-Testing: \"{text:25}\" -> {status}", flush=True)

    total = len(test_scenarios)
    print("\n" + "="*50, flush=True)
    print(f"📊 FINAL SCORE: {hit_count}/{total} ({(hit_count/total)*100:.1f}%)", flush=True)
    print("="*50, flush=True)

    await db.close()

if __name__ == "__main__":
    asyncio.run(run_stress_test())

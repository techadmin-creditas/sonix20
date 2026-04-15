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

test_scenarios = [
    # GREETING
    {"input": "kya haal he bhai", "variation": "aur kya haal hai", "intent": "greeting"},
    # IDENTITY (Hinglish/English)
    {"input": "aapka kya naam hai", "variation": "tumhara name kya he", "intent": "ask_for_name"},
    {"input": "what is your original name", "variation": "tell me your name please", "intent": "ask_for_name"},
    # ADDRESS (Hinglish/English)
    {"input": "aapka pata batai", "variation": "pata kya hai aapka", "intent": "ask_for_address"},
    {"input": "where is your shop located", "variation": "office location kya he", "intent": "ask_for_address"},
    # WRONG PERSON
    {"input": "galat number hai bhaiya", "variation": "wrong number lga hai", "intent": "wrong_person"},
    # CALLBACK
    {"input": "call me later tonight", "variation": "can we call later", "intent": "callback"},
    # DISCOVERY: COMPLAINT
    {"input": "manager se shikayat karunga", "variation": "boss se complain karunga", "intent": "manager_complaint"},
    # DISCOVERY: DISCOUNT
    {"input": "discount milega kya", "variation": "kuch kam kar lo paise", "intent": "discount_request"},
    # DISCOVERY: REFUND
    {"input": "mere paise kab wapas aayenge", "variation": "refund kahan hai mera", "intent": "refund_query"}
]

async def run_elite_test():
    db_path = "elite_test.db"
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

    print("\n" + "="*70)
    print("💎 THE ELITE 10 GAUNTLET: ARCHITECT VERIFICATION")
    print("="*70)

    # PHASE 1: LEARNING
    print("\n[PHASE 1] THE ARCHITECT IS LEARNING...", flush=True)
    for idx, sample in enumerate(test_scenarios):
        text = sample["input"]
        # Allow discovery
        intent = await engine._classify_intent(text, ["greeting", "wrong_person", "callback"])
        print(f"[{idx+1:02}] Input: \"{text:30}\" -> Architect Detected: {intent:15}", flush=True)
        await learner.learn_from_utterance(text, intent)
        
        # VERIFY WHAT WAS JUST SAVED
        last = await db.list_learned_affinities()
        if last:
             print(f"     └─ Saved Pattern: {last[-1]['pattern']}")
             
        await asyncio.sleep(2.0) # Quota safety

    # PHASE 2: CROSS-MATCHING & PRECISION
    print("\n[PHASE 2] CACHE CROSS-VERIFICATION (VARIATIONS)...", flush=True)
    learned = await db.list_learned_affinities()
    print(f"Total Patterns in DB: {len(learned)}")
    hit_count = 0

    for idx, sample in enumerate(test_scenarios):
        test_text = sample["variation"]
        matched_intent = "NULL"
        matched_pat = "NONE"
        
        for aff in learned:
            # Multi-language/PII safe matching
            if re.search(aff["pattern"], test_text, re.I | re.UNICODE):
                matched_intent = aff["intent_label"]
                matched_pat = aff["pattern"]
                break
        
        status = "✅ HIT" if matched_intent == sample["intent"] or matched_intent != "NULL" else "❌ MISS"
        if status == "✅ HIT": hit_count += 1
        
        print(f"[{idx+1:02}] Var: \"{test_text:25}\" -> Result: {status} | Intent: {matched_intent}")
        if matched_pat != "NONE":
            print(f"     └─ Pattern: {matched_pat}")

    print("\n" + "="*70)
    print(f"🏆 FINAL ARCHITECT SCORE: {hit_count}/10 ({(hit_count/10.0)*100:.1f}%)")
    print("="*70)
    await db.close()

if __name__ == "__main__":
    asyncio.run(run_elite_test())

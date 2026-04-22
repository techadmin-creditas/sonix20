import asyncio
import os
from voicebot.core.orchestrator.brain import AgenticBrain
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def run_gauntlet():
    print("🥊 STARTING THE AGENTIC GAUNTLET (10 SCENARIOS) 🥊\n")
    db_path = "gauntlet.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    from voicebot.shared.models.session import SessionState
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    session = SessionState(session_id="gauntlet-123")
    llm = GroqStreamingProvider()
    db = SQLiteProvider(db_path)
    await db.initialize()
    brain = AgenticBrain(session=session, db_handler=db, llm_handler=llm)
    engine = WorkflowEngine(brain, {})

    scenarios = [
        {"input": "mera naam vaibhav hai", "label": "Identity (Hinglish)"},
        {"input": "I am calling from Mumbai, my name is John", "label": "Identity (English)"},
        {"input": "Where is your office located?", "label": "Location (English)"},
        {"input": "Aapka address share kijiye", "label": "Location (Hinglish)"},
        {"input": "payment kahan karna hai?", "label": "Payment (Hinglish)"},
        {"input": "How can I pay my bill?", "label": "Payment (English)"},
        {"input": "baad me call karo", "label": "Callback (Hinglish)"},
        {"input": "Please call me later today", "label": "Callback (English)"},
        {"input": "Manager se baat karwao", "label": "Escalation (Hinglish)"},
        {"input": "I want to speak to your supervisor", "label": "Escalation (English)"}
    ]

    for i, s in enumerate(scenarios):
        print(f"[{i+1}/10] Playing: {s['label']}")
        print(f"      Input: \"{s['input']}\"")
        intent = await engine._classify_intent(s['input'], ["greeting", "wrong_person"])
        print(f"      Result: {intent}")
        # Build delay for learning
        await asyncio.sleep(4.0)
    
    print("\n" + "="*50)
    print("📊 FINAL TAXONOMY TALLY")
    print("="*50)
    
    # Check groupings
    affinities = await db.list_learned_affinities()
    counts = {}
    for a in affinities:
        counts[a["intent_label"]] = counts.get(a["intent_label"], 0) + 1
        print(f"Intent Mapping: {a['intent_label']:25} | Pattern: {a['pattern']}")

    print("\nSummary of Buckets Created:")
    for intent, count in counts.items():
        print(f" - {intent:25}: {count} patterns")
    
    print(f"\nTotal Scenarios: 10 | Total Buckets: {len(counts)}")
    if len(counts) < 9:
        print("\n✅ SUCCESS: Grouping logic is active! (High Semantic Glue)")
    else:
        print("\n❌ FAILED: Too many unique intents created. (Taxonomy Bloat)")

if __name__ == "__main__":
    asyncio.run(run_gauntlet())

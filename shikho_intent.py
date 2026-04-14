import asyncio
import os
import sys
import logging
import re
from typing import List

# Ensure the project root is in path
sys.path.append(os.getcwd())

from voicebot.services.memory.sqlite_provider import SQLiteProvider
from voicebot.core.orchestrator.workflow_engine import WorkflowEngine
from voicebot.core.orchestrator.intent_learner import IntentLearner

# ANSI Colors for "Clear and Easy" UI
C_BLUE = "\033[94m"
C_GREEN = "\033[92m"
C_YELLOW = "\033[93m"
C_CYAN = "\033[96m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_END = "\033[0m"

async def interactive_test():
    os.system('clear' if os.name == 'posix' else 'cls')
    print(f"{C_CYAN}{C_BOLD}============================================================{C_END}")
    print(f"{C_CYAN}{C_BOLD}🧠 AGENTIC INTENT LEARNING PLAYGROUND{C_END}")
    print(f"Type anything. The first time, it learns. The second time, it's instant.{C_END}")
    print(f"{C_CYAN}{C_BOLD}============================================================{C_END}")
    print(f"Commands: 'exit' or 'quit' to stop | 'clear' to reset memory\n")

    db_path = "agentic_shard_v1.db"
    db = SQLiteProvider(db_path)
    await db.initialize()

    # 1. Setup minimal Brain-like objects
    from unittest.mock import MagicMock
    brain = MagicMock()
    brain.db = db
    brain.session = MagicMock()
    brain.session.session_id = "playground-session"
    brain.session.metadata = {"language": "hi"}
    brain._bot_config = {"default_language": "hi"}
    brain._inject_variables.side_effect = lambda x: x
    
    # Use real LLM for the interactive part
    from voicebot.services.llm.groq_provider import GroqStreamingProvider
    settings = MagicMock()
    settings.groq_api_key = os.getenv("GROQ_API_KEY", "gsk_jM763BvVEn7yU6fVCqSR") 
    brain.llm = GroqStreamingProvider()

    # 2. Setup Engine
    # We define a dummy workflow with common intents
    workflow_data = {
        "start_node_id": "root",
        "nodes": [
            {"id": "root", "type": "userInput", "data": {"intents": ["confirmed", "wrong_person", "callback", "busy", "pay_later", "greeting", "other"]}}
        ],
        "edges": []
    }
    engine = WorkflowEngine(brain, workflow_data)
    learner = IntentLearner(brain)

    while True:
        try:
            print(f"{C_BOLD}User Prompt > {C_END}", end="", flush=True)
            user_input = sys.stdin.readline().strip()

            if user_input.lower() in ("exit", "quit"):
                break
            
            if user_input.lower() == "clear":
                await db.close()
                if os.path.exists(db_path): os.remove(db_path)
                await db.initialize()
                print(f"{C_YELLOW}Memory cleared!{C_END}\n")
                continue

            if not user_input:
                continue

            # --- TIER 1/2 Check (Fast Path) ---
            # We simulate the _classify_intent logic here to show the "Label"
            
            # 1. Check SQLite first for the demo visualization
            learned = await db.list_learned_affinities()
            matched_pattern = None
            detected_intent = None
            
            for aff in learned:
                if re.search(aff["pattern"], user_input, re.I | re.UNICODE):
                    matched_pattern = aff["pattern"]
                    detected_intent = aff["intent_label"]
                    break
            
            if matched_pattern:
                # CACHED HIT
                print(f"{C_GREEN}{C_BOLD}[⚡ CACHED] {C_END}Matched via pattern: {C_BLUE}{matched_pattern}{C_END}")
                print(f"Result: {C_GREEN}Intent '{detected_intent}' identified in <5ms. (Skipped LLM){C_END}\n")
                asyncio.create_task(db.increment_affinity_hit(matched_pattern))
            else:
                # LLM LEARNING PATH
                print(f"{C_YELLOW}{C_BOLD}[🧠 LEARNING] {C_END}No local match. Consultng Neural Network...")
                
                # Real classification
                intent = await engine._classify_intent(user_input, ["confirmed", "wrong_person", "callback", "busy", "pay_later", "greeting", "other"])
                print(f"Result: {C_YELLOW}LLM detected '{intent}'. Starting background learning...{C_END}")
                
                if intent != "NONE":
                    await learner.learn_from_utterance(user_input, intent)
                    
                    # Show what was learned (show the LATEST entry)
                    update = await db.list_learned_affinities()
                    if update:
                         new_pat = update[-1]['pattern']
                         print(f"Memory Update: {C_CYAN}Saved PII-safe pattern: '{new_pat}'{C_END}")
                print()

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"{C_RED}Error: {e}{C_END}")

    await db.close()
    print(f"\n{C_CYAN}Playground closed. Memory persisted in {db_path}{C_END}")

if __name__ == "__main__":
    try:
        asyncio.run(interactive_test())
    except KeyboardInterrupt:
        pass

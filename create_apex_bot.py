import asyncio
import json
import sqlite3
from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def main():
    db = SQLiteProvider()
    await db.initialize()
    
    # Check if Apex already exists
    bots = await db.list_bots()
    if any(b['name'] == "Apex Banking Assistant" for b in bots):
        print("Apex Banking Assistant already exists.")
        return

    # Phase 1: Create the Banking Bot Persona
    apex_bot = {
        "name": "Apex Banking Assistant",
        "role": "Banking Support Specialist",
        "description": "Advanced AI voice banking assistant for Apex Bank",
        "persona": "calm, professional",
        "system_prompt": (
            "You are Apex, an advanced AI banking assistant for Apex Bank. Your goals:\n"
            "1. Verify caller identity using account number and date of birth before sharing any account info\n"
            "2. Handle balance enquiries, loan status, EMI details, and payment support\n"
            "3. Detect frustrated callers and escalate to a human agent when sentiment is negative for 2+ turns\n"
            "4. Never reveal full account numbers — always mask to last 4 digits\n"
            "5. Always confirm amounts before stating them\n"
            "Speak in a calm, professional tone. Keep responses under 2 sentences for voice clarity.\n"
            "Never use bullet points or markdown — speak naturally."
        ),
        "greeting": "Welcome to Apex Bank. I'm your AI assistant, Apex. Please provide your account number to get started.",
        "llm_model": "llama-3.3-70b-versatile",
        "voice_id": "pNInz6obpg8nEByWQX7X", # Rachel from ElevenLabs
        "temperature": 0.3,
        "max_tokens": 150,
        "tools_enabled": ["verify_customer", "get_account_balance", "get_loan_status", "search_knowledge", "remember_user_fact"],
    }
    
    # Create the bot basic info
    result = await db.create_bot(**apex_bot)
    bot_id = result['id']
    print(f"Created Apex Banking Assistant (id={bot_id})")
    
    # Now update with advanced fields
    guardrail_policy = {
        "injection_check_enabled": True,
        "injection_action": "block",
        "injection_threshold": 0.4,
        "kb_only_factual": True,
        "output_forbidden_regex": ["\\b\\d{16}\\b", "CVV\\s*\\d{3}"],
        "semantic_cache_ttl_seconds": 1800
    }
    data_access_policy = {
        "enabled_scopes": ["knowledge", "banking", "memory"],
        "appointments_match_session_user": True
    }
    agent_task_spec = {
        "spec_version": 1,
        "call_purpose": "Assist the bank customer with account enquiries, loan status, and EMI payment support.",
        "opening_script_hint": "Greet the customer, state you are from Apex Bank, and ask for their account number.",
        "verification_policy": "Always call verify_customer with account number and date of birth before sharing any account data. Never reveal the full account number — use only last 4 digits.",
        "objection_handling": "If the customer is frustrated, empathize once and offer to connect with a human agent.",
        "off_topic_behavior": "answer_briefly_then_return",
        "tool_policy": "Call verify_customer first. Then use get_account_balance or get_loan_status for account data. Use search_knowledge for product and policy questions like interest rates or required documents.",
        "exit_conditions": "Query resolved, customer satisfied, or customer requests a human agent.",
        "max_persuasion_rounds": 1,
        "escalation_triggers": ["speak to human", "manager", "complaint", "supervisor"]
    }

    def _update_advanced():
        conn = db._get_conn()
        conn.execute("""
            UPDATE bots SET guardrail_policy = ?, data_access_policy = ?, agent_task_spec = ?
            WHERE id = ?
        """, (json.dumps(guardrail_policy), json.dumps(data_access_policy), json.dumps(agent_task_spec), bot_id))
        conn.commit()

    await db._run(_update_advanced)
    print("Updated advanced configuration.")
    
    # Phase 4: Populate Knowledge Base for Apex
    kb_entries = [
        {"topic": "Product", "question": "What are the home loan interest rates?", "answer": "Current home loan rates start at 8.5% per annum fixed for 5 years. Contact us for floating rate options."},
        {"topic": "Policy", "question": "How do I pay my EMI?", "answer": "You can pay your EMI via UPI, net banking, or set up an auto-debit mandate. Log in to your account portal to configure auto-debit."},
        {"topic": "Product", "question": "What documents are needed for a personal loan?", "answer": "You need PAN card, Aadhaar card, last 3 months salary slips, and 6 months bank statement."},
        {"topic": "Technical", "question": "How do I report a lost or stolen card?", "answer": "Call our 24-hour helpline at 1800-XXX-XXXX immediately, or block your card via the app under Cards then Block Card."},
        {"topic": "Policy", "question": "What is the NEFT transfer limit?", "answer": "NEFT limit is rupees 10 lakh per transaction. For amounts above rupees 2 lakh, use RTGS which is available 24 hours."}
    ]
    
    for entry in kb_entries:
        await db.add_knowledge(
            topic=entry["topic"],
            question=entry["question"],
            answer=entry["answer"],
            bot_id=bot_id,
            priority=5 if entry["topic"] in ["Product", "Policy"] else 3
        )
    print(f"Added {len(kb_entries)} KB entries for Apex.")

if __name__ == "__main__":
    asyncio.run(main())

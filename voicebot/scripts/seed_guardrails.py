import asyncio
import json
import uuid
from voicebot.services.memory.sqlite_provider import SQLiteProvider

# Define some standard safety guardrails
DEFAULT_RULES = [
    {
        "id": "block-toxic-en",
        "name": "Toxic Language (EN)",
        "priority": 100,
        "trigger": "keyword",
        "pattern": "fuck,shit,asshole,bitch,bastard",
        "action": "block",
        "scope": "both",
        "params": {"message": "I maintain a professional tone and cannot continue with that language."}
    },
    {
        "id": "mask-pii-email",
        "name": "PII Masking (Email)",
        "priority": 90,
        "trigger": "regex",
        "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "action": "mask",
        "scope": "both",
        "params": {"replacement": "[EMAIL_HIDDEN]"}
    },
    {
        "id": "block-toxic-hi",
        "name": "Toxic Language (HI)",
        "priority": 100,
        "trigger": "keyword",
        "pattern": "गाली,बदतमीज,हरामी,कुत्ता",
        "action": "block",
        "scope": "both",
        "params": {"message": "क्षमा करें, मैं इस तरह की भाषा का जवाब नहीं दे सकता।"}
    }
]

async def seed_guardrails():
    db = SQLiteProvider()
    await db.initialize()
    
    bots = await db.list_bots()
    print(f"Found {len(bots)} active bots.")
    
    for bot in bots:
        bot_id = bot['id']
        bot_name = bot['name']
        
        # Load existing policy
        existing_bot = await db.get_bot(bot_id)
        policy = existing_bot.get("guardrail_policy") or {}
        
        # Add rules if not present
        if "rules" not in policy or not policy["rules"]:
            print(f"Updating bot '{bot_name}' ({bot_id}) with default guardrail rules...")
            policy["rules"] = DEFAULT_RULES
            
            success = await db.update_bot(bot_id, guardrail_policy=policy)
            if success:
                print(f" Successfully updated bot '{bot_name}'.")
            else:
                print(f" Failed to update bot '{bot_name}'.")
        else:
            print(f"Bot '{bot_name}' already has {len(policy['rules'])} rules. Skipping.")

    await db.close()

if __name__ == "__main__":
    asyncio.run(seed_guardrails())

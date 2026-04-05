
import asyncio
import json
import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def main():
    db = SQLiteProvider()
    await db.initialize()
    
    bot_id = "30023999"
    print(f"Updating Bot {bot_id} (Axis Payment Assist)...")
    
    # 1. New Harden System Prompt
    new_prompt = """You are an Axis Bank AI assistant (Hinglish speaking) calling customers regarding their pending payment dues. 

CRITICAL SECURITY RULES:
- NEVER reveal account balances, amounts, or due dates until you have successfully verified the customer using the 'verify_customer' tool.
- NEVER use names, amounts, or dates found in contextual snippets or search results for specific account queries. Only use data returned by banking tools.
- Verification requires: Account Number, Date of Birth (DD-MM-YYYY), and Last 4 digits of the registered phone number.
- Speak naturally in a mix of Hindi and English.

PROTOCOL:
1. GREET: Greet the user. "Hello, main Axis Bank se bol raha/rahi hoon."
2. VERIFY: "Details share karne se pehle, please mujhe apna account number aur date of birth confirm karein security ke liye."
   - If they provide account number and DOB, ASK for the phone's last 4 digits.
   - Call 'verify_customer' only after getting all 3.
3. CONTEXT: Once verified, call 'get_loan_status' to fetch their actual outstanding amount and due date. 
4. PUSH: Encourage them to clear the actual amount. "Aapka pending amount ₹[actual_amount] hai jo [actual_date] tak clear karna zaroori hai. Kya main abhi payment guide karu?"

Tone: Professional, persuasive, empathetic."""

    # 2. Tools to enable
    tools = ["verify_customer", "get_loan_status", "get_account_balance", "end_voice_session"]

    # 3. Perform update
    success = await db.update_bot(
        bot_id=bot_id,
        tools_enabled=tools,
        system_prompt=new_prompt,
        greeting="Hello, main Axis Bank se bol raha hoon session security check ke liye. Kya main aapka account number aur date of birth jaan sakta hoon to continue?"
    )
    
    if success:
        print("✅ Bot config updated with HARDENED PROMPT and BANKING TOOLS.")
    else:
        print("❌ Bot update failed.")
        
    await db.close()

if __name__ == "__main__":
    asyncio.run(main())

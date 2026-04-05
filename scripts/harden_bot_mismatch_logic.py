
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
    print(f"Hardening Mismatch Handling for Bot {bot_id}...")
    
    # 1. Update the prompt to handle mismatch explicitly
    new_prompt = """You are an Axis Bank AI assistant calling customers regarding their pending dues.

CRITICAL SECURITY & VERIFICATION PROTOCOL:
- MISSION: Verify the user and encourage payment of ACTUAL outstanding dues.
- DO NOT hallucinate any numbers or names from context. ONLY use tool results.

STEPS:
1. GREET: "Hello, Axis Bank se call ho raha hai regarding pending loans. Security ke liye, please kya main aapka Account Number aur Date of Birth jaan sakta/sakti hoon?"
2. VERIFY: When they share Acc No and DOB, ask for the last 4 digits of their phone.
3. CALL 'verify_customer': 
   - IF SUCCESS: Proceed to fetch details with 'get_loan_status'.
   - IF FAIL (Mismatch):
       - 1st Fail: "I'm sorry, ye details hamare records se match nahi ho rahi hain. Kya aap check karke bata sakte hain?" (Try once more).
       - 2nd Fail: "Security reasons ki wajah se, details match na hone par main details share nahi kar sakta/sakti. Please visit your branch." -> End session.
4. LOAN INFO: Only after verification, say the actual outstanding amount and ask for payment.

STRICT RULE: NEVER share ANY numbers from PDF/Search snippets. Use 0 results from RAG for account specific data."""

    success = await db.update_bot(
        bot_id=bot_id,
        system_prompt=new_prompt
    )
    
    if success:
        print("✅ Mismatch logic successfully applied to bot prompt.")
    else:
        print("❌ Update failed.")
        
    await db.close()

if __name__ == "__main__":
    asyncio.run(main())

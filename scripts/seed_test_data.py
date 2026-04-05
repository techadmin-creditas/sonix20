
import asyncio
import sys
from pathlib import Path

# Add the project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from voicebot.services.memory.sqlite_provider import SQLiteProvider

async def main():
    db = SQLiteProvider()
    await db.initialize()
    
    # 1. Insert a test customer "Sanjeev"
    # Account: 12345678, DOB: 15-08-1990, Phone: 9876543210
    print("Seed: Inserting customer Sanjeev (Account 12345678)...")
    await db.upsert_customer(
        account_number="12345678",
        customer_name="Sanjeev Kumar",
        dob="15-08-1990",
        balance=75400.0,
        account_type="Savings",
        phone="9876543210",
        email="sanjeev.k@example.com"
    )
    
    # 2. Insert a loan for Sanjeev
    # Outstanding: 12450.00, EMI: 2150.00, Next Due: 25-05-2024
    print("Seed: Inserting loan record for Sanjeev...")
    await db.upsert_loan(
        account_number="12345678",
        loan_type="personal_loan",
        principal=50000.0,
        outstanding=12450.0,
        emi_amount=2150.0,
        emi_due_date="25th every month",
        next_due="25-05-2024",
        status="active"
    )
    
    print("\n✅ Seed complete: Data for 'Sanjeev' (Account 12345678) is ready.")
    await db.close()

if __name__ == "__main__":
    asyncio.run(main())

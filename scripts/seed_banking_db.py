"""
Banking Database Seeder — Populates mock customer accounts and loans for testing.

Run once before live testing the banking bot:
    python scripts/seed_banking_db.py

Test credentials:
    ACC1001 / 15-03-1990  — Priya Sharma   (savings, personal loan)
    ACC1002 / 22-07-1985  — Rahul Verma    (current, home loan)
    ACC1003 / 05-11-1992  — Anjali Patel   (savings, auto loan)
    ACC1004 / 30-01-1988  — Kunal Mehta    (savings, overdue personal loan)
    ACC1005 / 18-09-1995  — Deepika Singh  (salary, no loans)
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voicebot.services.memory.sqlite_provider import SQLiteProvider


CUSTOMERS = [
    {
        "account_number": "ACC1001",
        "customer_name": "Priya Sharma",
        "dob": "15-03-1990",
        "phone": "9876543210",
        "email": "priya.sharma@example.com",
        "balance": 42500.00,
        "account_type": "savings",
    },
    {
        "account_number": "ACC1002",
        "customer_name": "Rahul Verma",
        "dob": "22-07-1985",
        "phone": "9123456780",
        "email": "rahul.verma@example.com",
        "balance": 8750.50,
        "account_type": "current",
    },
    {
        "account_number": "ACC1003",
        "customer_name": "Anjali Patel",
        "dob": "05-11-1992",
        "phone": "9988776655",
        "email": "anjali.patel@example.com",
        "balance": 125000.00,
        "account_type": "savings",
    },
    {
        "account_number": "ACC1004",
        "customer_name": "Kunal Mehta",
        "dob": "30-01-1988",
        "phone": "9871234560",
        "email": "kunal.mehta@example.com",
        "balance": 3200.00,
        "account_type": "savings",
    },
    {
        "account_number": "ACC1005",
        "customer_name": "Deepika Singh",
        "dob": "18-09-1995",
        "phone": "9765432100",
        "email": "deepika.singh@example.com",
        "balance": 67000.00,
        "account_type": "salary",
    },
]

LOANS = [
    {
        "account_number": "ACC1001",
        "loan_type": "personal",
        "principal": 200000.0,
        "outstanding": 142000.0,
        "emi_amount": 5800.0,
        "emi_due_date": "5th of every month",
        "next_due": "2026-04-05",
        "status": "active",
    },
    {
        "account_number": "ACC1002",
        "loan_type": "home",
        "principal": 3500000.0,
        "outstanding": 2980000.0,
        "emi_amount": 32500.0,
        "emi_due_date": "10th of every month",
        "next_due": "2026-04-10",
        "status": "active",
    },
    {
        "account_number": "ACC1003",
        "loan_type": "auto",
        "principal": 800000.0,
        "outstanding": 520000.0,
        "emi_amount": 14200.0,
        "emi_due_date": "1st of every month",
        "next_due": "2026-04-01",
        "status": "active",
    },
    {
        "account_number": "ACC1004",
        "loan_type": "personal",
        "principal": 50000.0,
        "outstanding": 28000.0,
        "emi_amount": 2300.0,
        "emi_due_date": "15th of every month",
        "next_due": "2026-03-15",
        "status": "overdue",
    },
]


async def seed():
    db = SQLiteProvider()
    await db.initialize()

    print("Seeding banking data...")

    print("\nCreating customer accounts...")
    for c in CUSTOMERS:
        await db.upsert_customer(
            account_number=c["account_number"],
            customer_name=c["customer_name"],
            dob=c["dob"],
            balance=c["balance"],
            account_type=c["account_type"],
            phone=c.get("phone", ""),
            email=c.get("email", ""),
        )
        print(f"  Account {c['account_number']} — {c['customer_name']} ({c['account_type']}, balance ₹{c['balance']:,.2f})")

    print("\nCreating loans...")
    for loan in LOANS:
        await db.upsert_loan(
            account_number=loan["account_number"],
            loan_type=loan["loan_type"],
            principal=loan["principal"],
            outstanding=loan["outstanding"],
            emi_amount=loan["emi_amount"],
            emi_due_date=loan["emi_due_date"],
            next_due=loan["next_due"],
            status=loan["status"],
        )
        flag = " [OVERDUE]" if loan["status"] == "overdue" else ""
        print(f"  {loan['loan_type'].title()} loan on {loan['account_number']} — outstanding ₹{loan['outstanding']:,.0f}, EMI ₹{loan['emi_amount']:,.0f}{flag}")

    await db.close()

    print("\nBanking seed complete!")
    print("\nTest these credentials in the live session:")
    print("  ACC1001 / DOB 15-03-1990  — Priya Sharma   (savings ₹42,500 + personal loan)")
    print("  ACC1002 / DOB 22-07-1985  — Rahul Verma    (current ₹8,750 + home loan)")
    print("  ACC1003 / DOB 05-11-1992  — Anjali Patel   (savings ₹1,25,000 + auto loan)")
    print("  ACC1004 / DOB 30-01-1988  — Kunal Mehta    (savings ₹3,200 + OVERDUE personal loan)")
    print("  ACC1005 / DOB 18-09-1995  — Deepika Singh  (salary ₹67,000, no loans)")
    print("\nEnable these tools on the banking bot: verify_customer, get_account_balance, get_loan_status")


if __name__ == "__main__":
    asyncio.run(seed())

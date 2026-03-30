"""
Database Seeder — Populates the SQLite DB with realistic demo data.

Run this once to set up:
  - 3 bot personas (General, Sales, Support)
  - 10 sample appointments
  - 20 knowledge base entries
  - 5 user facts
"""

import asyncio
import sys
import os

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voicebot.services.memory.sqlite_provider import SQLiteProvider


BOTS = [
    {
        "name": "Alex",
        "description": "General-purpose friendly assistant",
        "persona": "friendly, warm, concise, conversational",
        "greeting": "Hey there! I'm Alex, your personal assistant. How can I help you today?",
        "system_prompt": (
            "You are Alex, a friendly and helpful AI voice assistant. "
            "You help users with scheduling appointments, answering questions, "
            "and storing information they share with you. "
            "Keep responses short and conversational. Never use bullet points or markdown. "
            "You have access to tools to book appointments, search the knowledge base, "
            "and remember things users tell you."
        ),
        "tools_enabled": ["search_knowledge", "book_appointment", "get_appointments", "remember_user_fact"],
        "llm_model": "llama-3.3-70b-versatile",
        "role": "AI Concierge",
        "icon": "concierge",
        "color": "primary",
    },
    {
        "name": "Nova",
        "description": "Sales and product information bot",
        "persona": "professional, enthusiastic, persuasive, helpful",
        "greeting": "Welcome! I'm Nova, your sales assistant. Looking for something specific today?",
        "system_prompt": (
            "You are Nova, a professional sales and product assistant. "
            "You help customers discover products, understand pricing, and make decisions. "
            "Be enthusiastic but honest. Keep responses brief and focused. "
            "Never use markdown or bullet points. "
            "You can search the product knowledge base to answer questions accurately."
        ),
        "tools_enabled": ["search_knowledge", "remember_user_fact"],
        "llm_model": "llama-3.3-70b-versatile",
        "role": "Technical Lead",
        "icon": "memory",
        "color": "secondary",
    },
    {
        "name": "Max",
        "description": "Technical support and troubleshooting bot",
        "persona": "calm, technical, step-by-step, patient",
        "greeting": "Hi, I'm Max from technical support. What issue can I help you resolve today?",
        "system_prompt": (
            "You are Max, a calm and knowledgeable technical support agent. "
            "You help users troubleshoot problems step by step. "
            "Ask clarifying questions when needed. Be patient and clear. "
            "Never use markdown or bullet points in your responses — speak naturally. "
            "You can look up known issues and solutions from the knowledge base."
        ),
        "tools_enabled": ["search_knowledge", "remember_user_fact", "book_appointment"],
        "llm_model": "llama-3.3-70b-versatile",
        "role": "Schedule Asst",
        "icon": "event_busy",
        "color": "outline",
    },
    {
        "name": "Finley",
        "description": "Empathetic yet firm agent specialized in debt recovery.",
        "persona": "empathetic, firm, technical, counselor",
        "greeting": "Hello, I'm Finley. I'm here to discuss your account status and help find a resolution.",
        "system_prompt": (
            "You are Finley, a specialized loan recovery assistant. "
            "You help users manage their accounts and find payment solutions. "
            "Be empathetic but maintain a firm professional boundary. "
            "Never use markdown or bullet points. "
            "You can look up common financial questions in the knowledge base."
        ),
        "tools_enabled": ["search_knowledge", "remember_user_fact", "book_appointment"],
        "llm_model": "llama-3.3-70b-versatile",
        "role": "Loan Specialist",
        "icon": "account_balance",
        "color": "primary",
    },
]


KNOWLEDGE_BASE = [
    # General / Alex
    {"topic": "Office Hours", "question": "What are your office hours?",
     "answer": "We're open Monday to Friday, 9 AM to 6 PM, and Saturdays from 10 AM to 2 PM. We're closed on Sundays.",
     "keywords": ["hours", "open", "close", "timing", "schedule", "when"]},
    {"topic": "Location", "question": "Where are you located?",
     "answer": "We're located at 42 Innovation Park, Bandra West, Mumbai. Nearest metro is Bandra station.",
     "keywords": ["where", "address", "location", "find", "directions", "office"]},
    {"topic": "Contact", "question": "How can I contact you?",
     "answer": "You can reach us at support@company.com or call us at 1800-123-4567. We typically respond within 2 hours.",
     "keywords": ["contact", "email", "phone", "call", "reach", "support"]},
    {"topic": "Appointments", "question": "How do I book an appointment?",
     "answer": "Just tell me your name, preferred date, and time, and I'll book it right here for you.",
     "keywords": ["appointment", "book", "schedule", "meeting", "slot"]},
    {"topic": "Cancellation", "question": "How do I cancel an appointment?",
     "answer": "You can cancel up to 24 hours before your appointment. Just contact us by phone or email with your name and appointment details.",
     "keywords": ["cancel", "reschedule", "postpone", "change", "appointment"]},

    # Sales / Nova
    {"topic": "Pricing", "question": "What are your product prices?",
     "answer": "Our Starter plan is 999 rupees per month, the Professional plan is 2499 rupees, and the Enterprise plan starts at 7999 rupees. All plans include a 14-day free trial.",
     "keywords": ["price", "cost", "plan", "pay", "charge", "rupees", "fee", "subscription"]},
    {"topic": "Free Trial", "question": "Do you offer a free trial?",
     "answer": "Yes! Every plan includes a 14-day free trial with full features. No credit card required to start.",
     "keywords": ["free", "trial", "test", "demo", "try"]},
    {"topic": "Features", "question": "What features are included?",
     "answer": "All plans include unlimited voice sessions, real-time transcription, multi-language support, and email reports. The Professional and Enterprise plans add custom bot personas and API access.",
     "keywords": ["features", "include", "what", "offer", "functionality", "capability"]},
    {"topic": "Refund", "question": "What is your refund policy?",
     "answer": "We offer a full refund within 30 days of purchase if you're not satisfied, no questions asked.",
     "keywords": ["refund", "money back", "return", "guarantee", "cancel subscription"]},
    {"topic": "Integrations", "question": "What systems do you integrate with?",
     "answer": "We integrate with Slack, Google Calendar, Salesforce, Zendesk, and all major CRM platforms via our REST API.",
     "keywords": ["integrate", "connect", "api", "crm", "slack", "calendar", "salesforce"]},

    # Support / Max
    {"topic": "Microphone Not Working", "question": "My microphone is not working",
     "answer": "First, check that your browser has microphone permissions enabled. In Chrome, click the lock icon in the address bar and allow microphone access. Then refresh the page and try again.",
     "keywords": ["mic", "microphone", "audio", "not working", "no sound", "permission"]},
    {"topic": "Voice Not Detected", "question": "The bot is not hearing me",
     "answer": "Try speaking closer to your microphone and ensure background noise is minimal. If the issue persists, try using a headset instead of your built-in microphone.",
     "keywords": ["not hearing", "detect", "voice", "speak", "listening", "silent"]},
    {"topic": "Connection Issues", "question": "The bot keeps disconnecting",
     "answer": "Disconnections are usually caused by unstable internet. Check your WiFi signal, try switching to a wired connection, or disable VPN if active. If the issue continues, please contact support.",
     "keywords": ["disconnect", "drop", "connection", "unstable", "network", "wifi", "internet"]},
    {"topic": "Audio Quality", "question": "The voice sounds choppy or distorted",
     "answer": "Choppy audio is often caused by high CPU usage or network congestion. Try closing other browser tabs, restarting your browser, or reducing your video quality if on a video call.",
     "keywords": ["choppy", "distorted", "quality", "robotic", "lag", "latency", "slow"]},
    {"topic": "Login Issues", "question": "I cannot log in to my account",
     "answer": "Try resetting your password using the Forgot Password link. If you still can't access your account, contact our support team at support@company.com with your registered email.",
     "keywords": ["login", "sign in", "password", "forgot", "access", "account", "locked"]},

    # General extra
    {"topic": "Languages", "question": "What languages do you support?",
     "answer": "We currently support English, Hindi, Spanish, French, German, and Mandarin. More languages are coming soon.",
     "keywords": ["language", "hindi", "spanish", "french", "multilingual", "support"]},
    {"topic": "Privacy", "question": "Is my data secure?",
     "answer": "Yes. We use end-to-end encryption, never sell your data, and comply with GDPR and India's DPDP Act. All voice recordings are deleted after processing.",
     "keywords": ["privacy", "security", "data", "safe", "gdpr", "encryption", "recording"]},
    {"topic": "Bot Creation", "question": "Can I create my own bot?",
     "answer": "Absolutely! You can create unlimited custom bot personas with unique names, personalities, and toolsets through the dashboard. No coding required.",
     "keywords": ["create", "custom", "bot", "persona", "own", "build", "configure"]},
    {"topic": "API Access", "question": "Do you have an API?",
     "answer": "Yes, we offer a full REST API and WebSocket interface for developers. API documentation is available at docs.company.com. Professional and Enterprise plans include API access.",
     "keywords": ["api", "rest", "websocket", "developer", "code", "integrate", "access"]},
    {"topic": "Concurrent Sessions", "question": "How many users can use the bot simultaneously?",
     "answer": "The Starter plan supports up to 10 concurrent sessions. Professional supports 100, and Enterprise is unlimited. Each session is independent with its own conversation history.",
     "keywords": ["concurrent", "simultaneous", "users", "scale", "multiple", "sessions"]},
]


APPOINTMENTS = [
    {"user_name": "Priya Sharma", "date": "2026-04-01", "time": "10:00", "reason": "Product demo"},
    {"user_name": "Rahul Verma", "date": "2026-04-01", "time": "11:30", "reason": "Sales consultation"},
    {"user_name": "Anjali Patel", "date": "2026-04-02", "time": "14:00", "reason": "Technical onboarding"},
    {"user_name": "Kunal Mehta", "date": "2026-04-02", "time": "15:30", "reason": "Support call"},
    {"user_name": "Deepika Singh", "date": "2026-04-03", "time": "09:00", "reason": "Account review"},
    {"user_name": "Arun Kumar", "date": "2026-04-03", "time": "16:00", "reason": "Renewal discussion"},
    {"user_name": "Meera Iyer", "date": "2026-04-04", "time": "10:30", "reason": "Product feedback session"},
    {"user_name": "Vivek Nair", "date": "2026-04-07", "time": "11:00", "reason": "Enterprise trial setup"},
    {"user_name": "Sona Bose", "date": "2026-04-07", "time": "13:00", "reason": "Integration support"},
    {"user_name": "Dev Tiwari", "date": "2026-04-08", "time": "15:00", "reason": "Custom bot configuration"},
]


USER_FACTS = [
    {"user_id": "user_001", "fact": "Prefers morning appointments before 11 AM", "category": "preference"},
    {"user_id": "user_001", "fact": "Is interested in Enterprise plan", "category": "business"},
    {"user_id": "user_002", "fact": "Uses Salesforce CRM and needs Salesforce integration", "category": "technical"},
    {"user_id": "user_003", "fact": "Speaks both Hindi and English", "category": "language"},
    {"user_id": "user_004", "fact": "CEO of a 200-person company", "category": "identity"},
]


async def seed():
    db = SQLiteProvider()
    await db.initialize()

    print("🌱 Seeding database...")

    # Create bots
    print("\n📦 Creating bots...")
    bot_ids = {}
    for bot_data in BOTS:
        result = await db.create_bot(**bot_data)
        bot_ids[bot_data["name"]] = result["id"]
        print(f"  ✅ Bot created: {bot_data['name']} (id={result['id']})")

    # Seed knowledge base
    print("\n📚 Seeding knowledge base...")
    for i, entry in enumerate(KNOWLEDGE_BASE):
        # Assign some entries to specific bots, some global
        bot_id = None
        if i >= 5 and i < 10:
            bot_id = bot_ids.get("Nova")
        elif i >= 10 and i < 15:
            bot_id = bot_ids.get("Max")

        await db.add_knowledge(
            topic=entry["topic"],
            question=entry["question"],
            answer=entry["answer"],
            keywords=entry.get("keywords", []),
            bot_id=bot_id,
            priority=5 if i < 5 else 3,
        )
    print(f"  ✅ {len(KNOWLEDGE_BASE)} knowledge entries added")

    # Seed appointments
    print("\n📅 Seeding appointments...")
    for appt in APPOINTMENTS:
        await db.book_appointment(
            user_name=appt["user_name"],
            date=appt["date"],
            time_str=appt["time"],
            reason=appt.get("reason", ""),
        )
    print(f"  ✅ {len(APPOINTMENTS)} appointments added")

    # Seed user facts
    print("\n🧠 Seeding user facts...")
    for fact_data in USER_FACTS:
        await db.save_user_fact(
            fact=fact_data["fact"],
            user_id=fact_data["user_id"],
            category=fact_data["category"],
        )
    print(f"  ✅ {len(USER_FACTS)} user facts added")

    # Summary
    bots = await db.list_bots()
    appts = await db.get_appointments()
    print(f"\n✅ Database seeded successfully!")
    print(f"   📦 Bots     : {len(bots)}")
    print(f"   📅 Appts    : {len(appts)}")
    print(f"   📚 KB items : {len(KNOWLEDGE_BASE)}")
    print(f"\n💡 Available bots:")
    for b in bots:
        print(f"   - {b['name']} (id={b['id']}) — {b['description']}")

    await db.close()


if __name__ == "__main__":
    asyncio.run(seed())

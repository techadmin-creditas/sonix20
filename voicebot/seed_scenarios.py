import sqlite3
import json
import uuid

conn = sqlite3.connect('/Users/Projects/sonix20/voicebot/data/voicebot.db')
owner_id = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()[0]

scenarios = [
    {
        "id": "scenario-negotiator",
        "name": "The Negotiator",
        "desc": "High-Stakes Debt Settlement",
        "role": "Negotiator",
        "lang": "hi",
        "color": "#fb8c00",
        "prompt": "You are a professional debt negotiator. Your goal is to find a win-win settlement for both the user and the bank."
    },
    {
        "id": "scenario-emi",
        "name": "The EMI Converter",
        "desc": "Bounce Probability Reduction",
        "role": "Financial Advisor",
        "lang": "hi",
        "color": "#06b6d4",
        "prompt": "You are a helpful financial advisor focusing on EMI restructuring and payment consistency."
    },
    {
        "id": "scenario-settlement",
        "name": "The Settlement Specialist",
        "desc": "NPA Resolution Protocol",
        "role": "Resolution Lead",
        "lang": "en",
        "color": "#8f4e00",
        "prompt": "You are a legal and recovery specialist focusing on resolving NPA accounts via official protocols."
    },
    {
        "id": "scenario-regional",
        "name": "The Regional Connect",
        "desc": "Vernacular Linguistic Link",
        "role": "Regional Support",
        "lang": "ta",
        "color": "#10b981",
        "prompt": "You are a culturally attuned regional support agent. Use respectful honorifics and focus on clear communication."
    },
    {
        "id": "scenario-nudge",
        "name": "The Gentle Nudge",
        "desc": "Early-Stage Pre-Emptive Care",
        "role": "Customer Care",
        "lang": "en",
        "color": "#ffb77b",
        "prompt": "You are a friendly customer care agent providing gentle reminders and assistance for upcoming payments."
    }
]

tools_json = json.dumps(["search_knowledge", "get_appointments", "remember_user_fact"])

for s in scenarios:
    if not conn.execute("SELECT 1 FROM bots WHERE id = ?", (s["id"],)).fetchone():
        conn.execute(
            """
            INSERT INTO bots (
                id, name, description, persona, system_prompt, greeting, tools_enabled,
                llm_model, voice_id, role, icon, color, temperature, max_tokens, owner_user_id,
                default_language
            )
            VALUES (?, ?, ?, 'professional', ?, 'Hello, how can I help you today?', ?, 'llama-3.3-70b-versatile', 'v1', ?, 'bot', ?, 0.7, 1024, ?, ?)
            """,
            (s["id"], s["name"], s["desc"], s["prompt"], tools_json, s["role"], s["color"], owner_id, s["lang"])
        )
conn.commit()
print("Scenarios seeded!")

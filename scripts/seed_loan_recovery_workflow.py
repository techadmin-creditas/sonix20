"""
Seed script: Clear all existing test workflows and create a rich Loan Recovery Flow
with proper React Flow node structure (positions, types, data).
"""
import asyncio
import json
import sqlite3

DB_PATH = "data/voicebot.db"

LOAN_RECOVERY_FLOW = {
    "id": "wf_loan_recovery_v1",
    "name": "Loan Recovery Flow",
    "description": "AI-driven workflow to recover overdue loan payments. Detects language, analyzes sentiment, sends payment links via SMS, and convinces users to commit to payment.",
    "nodes": [
        # ── Step 1: Bot opens the call ──────────────────────────────────────────
        {
            "id": "n_greeting",
            "type": "speech",
            "position": {"x": 350, "y": 0},
            "data": {
                "label": "Initial Reminder",
                "speech": "Hello! I'm calling from your bank regarding an overdue loan payment. Your account shows a payment of ₹{amount} was due on {due_date}. I'm here to help you resolve this today. Can we take a moment to discuss?"
            }
        },
        # ── Step 2: Detect user language before listening ───────────────────────
        {
            "id": "n_lang_detect",
            "type": "language",
            "position": {"x": 350, "y": 180},
            "data": {
                "label": "Detect Language"
            }
        },
        # ── Step 3: Listen for user's first response ────────────────────────────
        {
            "id": "n_user_response",
            "type": "userInput",
            "position": {"x": 350, "y": 360},
            "data": {
                "label": "User Response",
                "intents": ["Agree to Pay", "Refuse", "Need Extension", "Off-topic", "Request Callback"]
            }
        },
        # ── Step 4: Branch — did user agree? ────────────────────────────────────
        {
            "id": "n_agree_branch",
            "type": "logic",
            "position": {"x": 350, "y": 540},
            "data": {
                "label": "Agrees to Pay?"
            }
        },
        # ── YES path: Send payment link via SMS & close ─────────────────────────
        {
            "id": "n_send_sms",
            "type": "action",
            "position": {"x": 100, "y": 720},
            "data": {
                "label": "Send SMS Payment Link",
                "actionType": "sms",
                "template": "Dear Customer, your payment link: {{payment_link}}. Amount: ₹{{amount}}. Due: {{due_date}}. Pay now to avoid late fees."
            }
        },
        {
            "id": "n_confirm_sent",
            "type": "speech",
            "position": {"x": 100, "y": 900},
            "data": {
                "label": "Confirm Link Sent",
                "speech": "I've just sent a secure payment link to your registered mobile number. You can pay instantly through our portal. Is there anything else I can help you with?"
            }
        },
        # ── NO path: Analyze sentiment and try to persuade ──────────────────────
        {
            "id": "n_sentiment",
            "type": "sentiment",
            "position": {"x": 620, "y": 720},
            "data": {
                "label": "Analyze Refusal Tone"
            }
        },
        {
            "id": "n_persuade",
            "type": "speech",
            "position": {"x": 620, "y": 900},
            "data": {
                "label": "Persuade User",
                "speech": "I completely understand that finances can be challenging. However, missing this payment may impact your credit score and attract a late fee of ₹{late_fee}. We can offer a 3-month extension plan with no penalties. Would that help you get back on track?"
            }
        },
        # ── Off-topic/questions → Knowledge Base ────────────────────────────────
        {
            "id": "n_knowledge",
            "type": "knowledge",
            "position": {"x": 900, "y": 720},
            "data": {
                "label": "Handle Off-topic",
                "query": "loan payment policy interest rates EMI schedule extension"
            }
        },
        {
            "id": "n_backtrack",
            "type": "backtrack",
            "position": {"x": 900, "y": 900},
            "data": {
                "label": "Return to Payment Topic"
            }
        },
        # ── Second chance listen after persuasion ───────────────────────────────
        {
            "id": "n_final_decision",
            "type": "userInput",
            "position": {"x": 620, "y": 1080},
            "data": {
                "label": "Final Decision",
                "intents": ["Agree to Pay", "Request Extension", "Escalate to Human", "End Call"]
            }
        },
        # ── Send email summary regardless ───────────────────────────────────────
        {
            "id": "n_send_email",
            "type": "action",
            "position": {"x": 620, "y": 1260},
            "data": {
                "label": "Send Email Summary",
                "actionType": "email",
                "template": "Dear {{name}}, this email summarizes your recent interaction regarding overdue payment of ₹{{amount}}. Payment link: {{payment_link}}"
            }
        },
    ],
    "edges": [
        {"id": "e1", "source": "n_greeting",       "target": "n_lang_detect",   "animated": True},
        {"id": "e2", "source": "n_lang_detect",     "target": "n_user_response", "animated": True},
        {"id": "e3", "source": "n_user_response",   "target": "n_agree_branch",  "animated": True},
        # YES branch
        {"id": "e4", "source": "n_agree_branch",    "target": "n_send_sms",      "sourceHandle": "yes", "animated": True, "label": "Yes"},
        {"id": "e5", "source": "n_send_sms",        "target": "n_confirm_sent",  "animated": True},
        # NO branch
        {"id": "e6", "source": "n_agree_branch",    "target": "n_sentiment",     "sourceHandle": "no", "animated": True, "label": "No"},
        {"id": "e7", "source": "n_sentiment",       "target": "n_persuade",      "sourceHandle": "neutral", "animated": True},
        # Off-topic / knowledge
        {"id": "e8", "source": "n_user_response",   "target": "n_knowledge",     "animated": True, "label": "Off-topic"},
        {"id": "e9", "source": "n_knowledge",       "target": "n_backtrack",     "animated": True},
        {"id": "e10", "source": "n_backtrack",      "target": "n_user_response", "animated": True},
        # After persuasion — listen again
        {"id": "e11", "source": "n_persuade",       "target": "n_final_decision","animated": True},
        {"id": "e12", "source": "n_final_decision", "target": "n_send_email",    "animated": True},
    ]
}

def seed():
    conn = sqlite3.connect(DB_PATH)

    # Clear all existing workflows
    deleted = conn.execute("DELETE FROM workflows").rowcount
    print(f"Deleted {deleted} existing workflow(s).")

    # Insert the new loan recovery flow
    wf = LOAN_RECOVERY_FLOW
    conn.execute("""
        INSERT INTO workflows (id, name, description, nodes_json, edges_json, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, strftime('%s','now'))
    """, (
        wf["id"],
        wf["name"],
        wf["description"],
        json.dumps(wf["nodes"]),
        json.dumps(wf["edges"]),
    ))
    conn.commit()
    print(f"Created workflow: {wf['name']} (id={wf['id']}, nodes={len(wf['nodes'])}, edges={len(wf['edges'])})")

    # Verify
    row = conn.execute("SELECT id, name, is_active FROM workflows WHERE id = ?", (wf["id"],)).fetchone()
    print(f"Verified in DB: {dict(zip(['id','name','is_active'], row))}")
    conn.close()

if __name__ == "__main__":
    seed()

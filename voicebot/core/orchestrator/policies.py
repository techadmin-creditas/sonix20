"""
Centralized conversation policies, prompts, and linguistic constants for AgenticBrain.
"""

from typing import Dict, List, Tuple, Set

# ─── Linguistic & Extraction Constants ────────────────────────────────

# Ordered from longest to shortest so longer prefixes are matched first.
# These are suspicious suffixes that may be the start of a hallucination tag.
SUSPICIOUS_PREFIXES: Tuple[str, ...] = (
    "<function=", "(function=",
    "```json", "```", "[TOOL:",
    "<function", "<functio", "<functi", "<funct", "<func", "<fun", "<fu", "<f", "<",
)

COMMITMENT_PROMPTS: Dict[str, str] = {
    "extract_commitment": (
        "Did the user just make a commitment, promise, or clear statement of intent?\n"
        "A commitment is any definite statement about what they WILL do, WANT, or have AGREED to.\n"
        "NOT a commitment: questions, greetings, filler words ('okay', 'haan'), passive statements.\n"
        "{few_shots}"
        "User said: \"{text}\"\n\n"
        "If a commitment exists, reply with ONLY the commitment as one short sentence (max 15 words).\n"
        "If no commitment, reply with exactly: NONE"
    ),
    "check_contradiction": (
        "Prior commitments made by the user in this call:\n{commitments}\n\n"
        "{few_shots}"
        "User just said: \"{text}\"\n\n"
        "Does the user's current statement directly contradict or walk back any prior commitment?\n"
        "Clarifying questions, partial information, or unrelated statements are NOT contradictions.\n\n"
        "If YES — reply in this exact format:\n"
        "CONTRADICTION: <prior commitment text> | <what they are now saying>\n\n"
        "If NO contradiction — reply with exactly: NONE"
    ),
}

# ─── Dynamic Response Pools ───────────────────────────────────────────

DYNAMIC_RESPONSES: Dict[str, Dict[str, List[str]]] = {
    "low_confidence_reprompt": {
        "en": [
            "I didn't quite catch that. Could you say that again?",
            "Sorry, I missed that. Can you please repeat it?",
            "I'm sorry, I didn't hear you clearly. Could you say that once more?",
            "Excuse me, I missed the last part. What was that?"
        ],
        "hi": [
            "Maaf kijiye, main sun nahi paaya. Kya aap phir se kahenge?",
            "Sorry, mujhe samajh nahi aaya. Ek baar phir bolenge?",
            "Kshama kijiye, main sun nahi saka. Dobara bol sakte hain?",
            "Aapki awaaz thodi kat gayi thi. Phir se batayiye?"
        ]
    },
    "sentiment_escalation": {
        "en": [
            "I can hear this is frustrating. Let me connect you with a team member who can help you directly.",
            "I understand your frustration. I'm transferring you to a senior advisor now.",
            "I'm sorry this is difficult. Let me get a specialist on the line for you.",
            "I want to make sure you get the right help. Let me connect you with one of our managers."
        ],
        "hi": [
            "Main samajh sakta hoon ki aap pareshaan hain. Main aapki baat apne senior se karwata hoon.",
            "Maaf kijiye, main aapko senior advisor se connect kar raha hoon jo isme behtar madad kar sakein.",
            "Main aapka frustration samajh sakta hoon. Line par rahiye, main call transfer kar raha hoon.",
            "Main chahta hoon aapki poori madad ho. Main call senior team member ko de raha hoon."
        ]
    },
    "topic_violation": {
        "en": [
            "I am specialized in {topic}. Is there something related to that I can help with?",
            "Actually, I'm only trained to assist with {topic} right now. Any questions on that?",
            "I'm here to help with {topic}. Let's stick to that for now, if that's okay.",
            "My expertise is limited to {topic}. Happy to help you with that!"
        ],
        "hi": [
            "Main abhi sirf {topic} mein madad kar sakta hoon. Kya aap is baare mein kuch poochna chahein?",
            "Kshama kijiye, main sirf {topic} par baat kar sakta hoon.",
            "Mera kaam sirf {topic} se juda hai. Kya main isme aapki koi madad karoon?",
            "Main filhaal sirf {topic} ke liye trained hoon. Is par baat karte hain."
        ]
    },
    "security_block": {
        "en": [
            "I'm sorry, I can't process that request.",
            "I am unable to perform that action for security reasons.",
            "That request goes beyond what I'm allowed to do.",
            "I'm unable to fulfill that specific request."
        ],
        "hi": [
            "Maaf kijiye, main yeh nahi kar sakta.",
            "Suraksha kaarno se main yeh request poori nahi kar sakta.",
            "Kshama kijiye, yeh mere adhikaar kshetra se bahar hai.",
            "Main is request ko poora karne mein asamarth hoon."
        ]
    }
}

# ─── Latency Watchdog Fillers ─────────────────────────────────────────

LATENCY_FILLERS: Dict[str, Dict[str, Tuple[str, ...]]] = {
    "en": {
        "default": (
            "One moment please.",
            "Just a second.",
            "Let me check that for you.",
            "Bear with me.",
            "Alright, one moment.",
            "Hmm, give me a moment.",
        ),
        "question": (
            "Let me look that up.",
            "Good question — one moment.",
            "Let me find that for you.",
        ),
        "ack": (
            "Got it — one moment.",
            "Thanks — let me check.",
            "Okay, just a second.",
        ),
        "frustration": (
            "I understand — let me help with that.",
            "Sorry about the wait — one moment.",
            "Let me sort that out for you.",
        )
    },
    "hi": {
        "default": (
            "Ek second, main check karta hoon.",
            "Thoda wait kijiye.",
            "Bas ek moment...",
            "Theek hai, abhi dekh raha hoon.",
            "Ek minute, please.",
            "Haan, bas ek second.",
        ),
        "question": (
            "Achha sawal hai, main iska pata lagata hoon.",
            "Theek hai, main is baare mein check karta hoon.",
            "Ek second, main details nikal raha hoon.",
            "Hmm, let me look that up for you.",
            "Ji, main abhi information check karta hoon.",
        ),
        "ack": (
            "Ji.",
            "Theek hai.",
            "Samajh gaya.",
            "Ji, bilkul.",
            "Theek hai, ek second rukiye.",
            "Ji samajh gaya, bas ek moment.",
        ),
        "frustration": (
            "Main samajh sakta hoon ki aapko thodi dikkat ho rahi hai. Ek second rukiye.",
            "I understand — let me fix that for you real quick.",
            "Maaf kijiye, main abhi iska hal nikalta hoon.",
            "Theek hai, main abhi check karta hoon ki kya problem hai.",
        ),
        "action": (
            "Theek hai, main yeh process kar raha hoon.",
            "Ji, main abhi action leta hoon. Ek second.",
            "Theek hai, main yeh details update kar raha hoon.",
        )
    }
}

# ─── Tooling and Analysis ─────────────────────────────────────────────

SCOPE_TOOL_NAMES: Dict[str, Tuple[str, ...]] = {
    "knowledge": ("search_knowledge",),
    "appointments": ("book_appointment", "get_appointments"),
    "user_memory": ("remember_user_fact",),
    "weather": ("get_weather",),
    "banking": ("verify_customer", "get_account_balance", "get_loan_status"),
}

POST_CALL_REFLECTION_PROMPT: str = """
You are a Senior Conversation Analyst. Your goal is review a voice conversation and extract deep insights for future use.

### ANALYSIS GOALS:
1.  **USER FACTS**: Identify specific facts about the user (preferences, account details mentioned, constraints, personality traits).
2.  **SUCCESSFUL TACTICS**: Identify specifically what the bot did that worked well (e.g., "Used a calm tone during frustration," "Offered a discount").
3.  **SUMMARY**: A concise 1-2 sentence summary of the call outcome.
4.  **CONFIDENCE**: For each fact/tactic, provide a confidence score between 0.0 and 1.0.

### OUTPUT FORMAT (JSON ONLY):
{{
    "user_facts": [{{"fact": "...", "confidence": 0.95}}, ...],
    "successful_tactics": [{{"tactic": "...", "confidence": 0.8}}, ...],
    "outcome_summary": "Summary text..."
}}

### CONVERSATION TRANSCRIPT:
{transcript}
"""

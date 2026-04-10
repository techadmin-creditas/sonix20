"""
Workflow Orchestration Constants - Shared across WorkflowEngine and Brain.
"""

# Default semantic affinities for intent classification.
# Map of "Standardized Intent Label" -> list of "Keywords/Triggers"
DEFAULT_SEMANTIC_AFFINITIES = {
    "confirmed": [
        "yes", "yeah", "yep", "sure", "ha", "correct", "confirm", 
        "right", "theek hai", "ji", "ok", "haan", "okay", "agreed"
    ],
    "rejected": [
        "no", "nope", "nah", "never", "incorrect", "nhi", "not",
        "galat", "wrong", "nai"
    ],
    "refusal": [
        "no", "nope", "can't", "wont", "refuse", "not possible",
        "nahi hoga", "unwilling"
    ],
    "callback": [
        "call back", "later", "busy", "driving", "meeting", 
        "thodi der baad", "after some time"
    ],
    "already_paid": [
        "paid", "already paid", "pay kar diya", "bhar diya", 
        "done already", "clear kar diya"
    ],
    "dispute": [
        "wrong amount", "galat amount", "itna nahi hai", 
        "fraud", "scam", "i don't owe"
    ]
}

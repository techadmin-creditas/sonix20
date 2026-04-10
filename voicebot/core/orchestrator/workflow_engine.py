import json
import re
import asyncio
import httpx
from typing import Optional, Any
import logging
from voicebot.core.orchestrator.constants import DEFAULT_SEMANTIC_AFFINITIES
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("workflow-engine")
_background_tasks: set[asyncio.Task] = set()

# Node type used to signal "hand off to the main LLM" — any unknown type also falls through.
_LLM_FALLBACK_TYPE = "llm_fallback"

# --- Global Prompt Registry ---
PROMPT_TEMPLATES = {
    "dynamic_speech": (
        "You are a sophisticated AI voice bot. Your current workflow step is: {label}.\n"
        "GOAL/OBJECTIVE: {base_text}\n\n"
        "Context from previous turns:\n{context_str}\n\n"
        "Most Recent User Input: {last_user_text}\n\n"
        "YOUR TASK:\n"
        "1. Analyze the user's latest query in the context of the previous chat.\n"
        "2. Generate a warm, empathetic, and professional response that resolves the user's immediate concern.\n"
        "3. CRITICAL: You MUST end your response with a clear question that steers the user back toward achieving the 'GOAL/OBJECTIVE' stated above.\n"
        "Keep it concise (1-2 sentences) and suitable for high-quality voice synthesis.\n"
        "If the user mentioned specific details like names or amounts, acknowledge them naturally."
    ),
    "nav_intent": (
        "Analyze the user's voice transcript for 'navigational' or 'topic switching' intent.\n"
        "Does the user want to:\n"
        "1. Go back to a previous topic or step? (e.g., 'Wait, go back to the start')\n"
        "2. Jump to a specific topic or step mentioned? (e.g., 'Tell me about the discount', 'I want to pay now')\n"
        "3. Skip a step or Restart?\n\n"
        "Reply with a JSON object:\n"
        '{{"action": "BACKTRACK" | "JUMP" | "SKIP" | "RESTART" | "CONTINUE", "target_label": "the name of the step or topic mentioned", "reason": "..."}}'
        '\n\nTranscript: "{text}"'
    ),
    "global_intent": (
        "Analyze if the user explicitly wants to terminate the call, talk to a human, or is being impatient.\n"
        "- User wants to HANG UP / END the call (e.g., 'bye', 'disconnect', 'stop calling', 'hang up now') → reply: DISCONNECT\n"
        "- User wants a human agent, manager, or supervisor → reply: ESCALATE\n"
        "- User is impatient, wants to hurry up, or skip preamble (e.g., 'jaldi batao', 'hurry up', 'get to the point') → reply: HURRY\n"
        "- User is asking a question, arguing, or making a statement (even if negative) → reply: CONTINUE\n\n"
        "Reply STRICTLY with ONE word.\n\nTranscript: \"{text}\""
    ),
    "logic_intent": (
        "User Language Context: {user_lang}\n"
        "Classify the following user input into EXACTLY ONE of: [{ops_str}].\n"
        "Rule: Map the user's input (whether in English, Hindi, or Hinglish) to the closest semantic English intent label from the available English Intents list.\n"
        "CRITICAL: You must output ONLY the raw string label. Do not output conversational text or preamble.\n"
        "If no match is found or it is irrelevant, output \"NONE\".\n\n"
        "User Input: \"{text}\""
    ),
    "sentiment": (
        "What is the sentiment of this response?\n"
        "Reply with exactly one word: positive, neutral, or negative.\n\n"
        "Text: \"{text}\""
    ),
    "knowledge_intent": (
        "Analyze the user's input: \"{text}\"\n"
        "Is the user asking a general question, seeking information, or asking an FAQ that might be in a Knowledge Base?\n"
        "Ignore simple 'yes/no' or mission-direct answers.\n"
        "Reply with: YES or NO."
    ),
    "knowledge_grounding": (
        "USER QUESTION: {text}\n"
        "TOP RAG CONTEXT:\n{context}\n\n"
        "TASK:\n"
        "1. Verify if the context actually answers the user's question.\n"
        "2. If the context is unrelated (e.g. user asks about 'payment options' but context is about 'movie tickets'), reply: [REJECT].\n"
        "3. If it answers the question, rephrase the context into a natural, empathetic, and professional 1-2 sentence voice reply.\n"
        "4. Do NOT say 'Reflecting on the text' or 'According to the context'. Just say the answer directly.\n\n"
        "REPLY ONLY WITH THE REPHRASED VOICETEXT OR [REJECT]."
    )
}

# --- Dynamic Response Pools (To prevent robotic repetition) ---
_DYNAMIC_RESPONSES = {
    "hurry_ack": {
        "en": [
            "Got it, I'll be quick.",
            "Sure, getting straight to the point.",
            "Understood, let's move fast.",
            "Okay, I'll keep this short."
        ],
        "hi": [
            "Bilkul, main seedhe point par aata hoon.",
            "Theek hai, jaldi se batata hoon.",
            "Samajh gaya, thoda fast chalte hain.",
            "Ji, bina ghumaaye batata hoon."
        ]
    },
    "knowledge_miss": {
        "en": [
            "I don't have that exact info right now, but I can find out.",
            "Let me check on that for you.",
            "I'm not completely sure, let me verify that.",
            "Good question. I'll need to look that up."
        ],
        "hi": [
            "Abhi mere paas iski poori jankari nahi hai, par main check kar sakta hoon.",
            "Mujhe confirm karna padega, ek second.",
            "Iski details main nikalwa leta hoon.",
            "Yeh mujhe check karna padega."
        ]
    },
    "disconnect": {
        "en": [
            "I understand. Thank you for your time. This is {name}. Have a good day.",
            "Thanks for speaking with me, {name} here. Take care and goodbye.",
            "Alright, I'll note that down. Thanks for your time today. Goodbye."
        ],
        "hi": [
            "Theek hai, samay dene ke liye shukriya. Main {name} baat kar raha tha. Aapka din shubh ho.",
            "Baat karne ke liye dhanyawad. Namaste.",
            "Theek hai, main update kar deta hoon. Apna khayal rakhiye, goodbye."
        ]
    },
    "escalate": {
        "en": [
            "I understand. Please hold for a moment while I connect you with a senior advisor.",
            "Let me get a team member on the line who can help you directly. Please hold.",
            "I'm transferring you to a specialist now. Just a moment."
        ],
        "hi": [
            "Main samajh gaya. Line par bane rahiye, main aapki baat apne senior se karwata hoon.",
            "Kripya hold karein, main call transfer kar raha hoon.",
            "Main ek senior team member ko connect kar raha hoon, bas ek second."
        ]
    },
    "reprompt_error": {
        "en": [
            "I'm sorry, I seem to be having technical issues. Let's talk again later. Goodbye.",
            "Apologies, my connection seems a bit unstable right now. We'll reach out later."
        ],
        "hi": [
            "Maaf kijiye, mujhe kuch technical problem aa rahi hai. Hum baad mein baat karenge. Namaste.",
            "Sorry, network mein kuch issue lag raha hai. Main baad mein call karunga."
        ]
    },
    "notification_sent": {
        "en": [
            "I've sent that information to your registered mobile number.",
            "I've dispatched the details to your phone. Let me know if you get it.",
            "Done. You should receive an SMS with those details shortly.",
            "I've sent that over to you now."
        ],
        "hi": [
            "Mainne woh jankari aapke mobile number par bhej di hai.",
            "Details aapke phone par bhej diye gaye hain. Check kar lijiye.",
            "Theek hai, sms bhej diya gaya hai.",
            "Ji, mainne details aapko forward kar diye hain."
        ]
    },
    "grounding_bridge": {
        "en": [
            "Anyway, going back to what we were discussing...",
            "Coming back to our conversation...",
            "Right, moving back to where we were...",
            "Anyway, let's get back on track."
        ],
        "hi": [
            "Khair, wapas aate hain hamari baat par...",
            "Haan, toh hum baat kar rahe thhe...",
            "Anyway, main wapas topic par aata hoon...",
            "Theek hai, main wapas point par aata hoon..."
        ]
    }
}


# --- Node Handlers (Strategy Pattern) ---

class BaseNodeHandler:
    """Base interface for all workflow conversation blocks."""
    async def handle(self, engine: "WorkflowEngine", node: dict[str, Any], user_text: str) -> bool:
        """
        Execute the node logic.
        Returns:
            - True if the engine should pause/yield (e.g., userInput, or LLM fallback).
            - False if it should continue immediately to the next node in the chain.
        """
        raise NotImplementedError()

class SpeechHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        data = node.get("data") or {}
        mode = data.get("mode", "direct")
        text = _node_speech(node)

        if mode == "llm":
            text = await engine._generate_dynamic_speech(node, user_text)

        if text:
            # Note: Variables are injected centrally in Brain._generate_and_speak
            await engine.brain._generate_and_speak(text)
        else:
            logger.warning("[WorkflowEngine] Speech node %s has no text configured.", node['id'])
            await engine.brain._generate_and_speak("...")
        
        engine._mark_spoken()
        if node['id'] not in engine.history:
            engine.history.append(node['id'])

        edges = engine._get_outgoing_edges(node['id'])
        if edges:
            target_id = edges[0].get("target")
            next_node = engine.nodes.get(target_id)
            if next_node and _norm_type(next_node.get("type", "")) == "userInput":
                engine.current_node_id = target_id
                return True # Pause on next userInput
            engine.current_node_id = target_id
            return False # Continue chain
        else:
            # TERMINAL NODE: End Call gracefully
            engine.current_node_id = None
            engine.brain.request_voice_session_end("workflow_completed")
            return True # Yield/End

class UserInputHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        # userInput always pauses the flow execution for the next turn
        return True

class LogicHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        if not user_text:
            # If no input yet, wait for the user to respond to the previous prompt
            return True

        edges = engine._get_outgoing_edges(node['id'])
        if not edges:
            engine.current_node_id = None
            return True # Yield to LLM
            
        intents = _node_intents(node)
        edge_labels = [e.get("label") or e.get("sourceHandle") or "" for e in edges]
        # Skip internal retry labels for semantic classification
        semantic_labels = [l for l in edge_labels if "retry_" not in l.lower()]
        all_options = list(set([l for l in semantic_labels + intents if l]))

        # 1. Smart Sentiment Routing
        sentiment = await engine._classify_sentiment(user_text)
        if sentiment in ("positive", "negative"):
            target_handle = "yes" if sentiment == "positive" else "no"
            
            # Priority A: Specific escape keywords (anger, escalation, etc)
            if sentiment == "negative":
                for e in edges:
                    lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
                    if any(x in lbl for x in ["anger", "fast_exit", "escalate", "agent"]):
                        await engine._log("[WORKFLOW]", "Escape routing: Negative sentiment / Anger detected.", "text-red-400")
                        engine.current_node_id = e.get("target")
                        return False

            # Priority B: Direct Handle/Label Match (Intuitive branching for Yes/No)
            # We look for an edge that matches the sentiment's intent (yes/no)
            for e in edges:
                handle = (e.get("sourceHandle") or "").lower()
                lbl = (e.get("label") or "").lower()
                
                # A 'match' happens if handle is 'yes'/'no' 
                # OR if it is a negative response and the label is 'retry_n' or 'fail'
                is_no_match = (target_handle == "no" and (handle == "no" or "retry" in lbl or "fail" in lbl or "refusal" in lbl))
                is_yes_match = (target_handle == "yes" and (handle == "yes" or "confirm" in lbl or "success" in lbl))
                
                if is_no_match or is_yes_match:
                    # If this is a numbered retry path (e.g. retry_1), follow the current visit count
                    if "retry_" in lbl:
                        current_visits = engine.node_visit_counts.get(node['id'], 0)
                        if f"retry_{current_visits + 1}" in lbl:
                           await engine._log("[WORKFLOW]", f"Sentiment auto-retry → {lbl}", "text-emerald-400")
                           engine.node_visit_counts[node['id']] = current_visits + 1
                           engine.current_node_id = e.get("target")
                           return False
                    elif handle == target_handle or (target_handle == "no" and ("fail" in lbl or "refusal" in lbl)):
                        # Simple match
                        await engine._log("[WORKFLOW]", f"Sentiment routing → {lbl or handle}", "text-emerald-400")
                        engine.current_node_id = e.get("target")
                        return False

        # 2. Track visits for Persistence Loops
        node_id = node['id']
        current_visits = engine.node_visit_counts.get(node_id, 0)
        engine.node_visit_counts[node_id] = current_visits + 1
        
        retry_limit = int((node.get("data") or {}).get("retry_limit") or 3)

        # 3. Classify Intent
        selected = await engine._classify_intent(user_text, all_options) if all_options else "NONE"
        await engine._log("[WORKFLOW]", f"Logic branch → {selected} (Try {engine.node_visit_counts[node_id]})", "text-primary")

        # Intelligence Update: If NO match found, stay on node and re-prompt!
        if selected == "NONE":
            await engine._log("[ENGINE]", f"Ambiguous input: '{user_text}'. Providing clarification.", "text-amber-400")
            await engine._handle_reprompt(user_text)
            return True # PAUSE and wait for new user input after reprompt

        # 4. Routing Logic (Priority: Intent Match -> Retry Match -> Default)
        target_id = None
        
        # Standard label match (STRICT MATCHING)
        for e in edges:
            lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
            if selected and lbl and lbl == selected.lower():
                target_id = e.get("target")
                break
        
        # If no specific intent matched, AND we have a retry path available, use it
        if not target_id and current_visits < retry_limit:
            retry_label = f"retry_{current_visits + 1}"
            for e in edges:
                lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
                if retry_label in lbl:
                    await engine._log("[WORKFLOW]", f"Generic fallback → Persistence Tier {retry_label}", "text-amber-400")
                    target_id = e.get("target")
                    break

        # Sane Fallback: If still no target, don't just pick edges[0] if it's ambiguous
        if not target_id:
            # Try to find a 'default' or 'fallback' or 'denied' edge
            for e in edges:
                lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
                if any(x in lbl for x in ["denied", "fallback", "default", "exit"]):
                    target_id = e.get("target")
                    break
        
        if not target_id:
            # Safer Fallback: Instead of guessing the first edge, 
            # provide a smart AI re-prompt to get back on track.
            await engine._log("[WORKFLOW]", f"No valid path for '{selected}'. Re-prompting user.", "text-amber-300")
            await engine._handle_reprompt(user_text)
            return True # Pause and wait for better input

        # Capture data for session (webhooks)
        capture_key = (node.get("data") or {}).get("label") or node['id']
        engine.session_data[capture_key] = selected
        
        engine.current_node_id = target_id
        return False

class SentimentHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        if not user_text:
            return True
            
        edges = engine._get_outgoing_edges(node['id'])
        if not edges:
            engine.current_node_id = None
            return True
            
        sentiment = await engine._classify_sentiment(user_text)
        await engine._log("[WORKFLOW]", f"Sentiment detected: {sentiment}", "text-emerald-400")

        target_id = None
        for e in edges:
            handle = (e.get("sourceHandle") or e.get("label") or "").lower()
            if handle and handle in sentiment.lower():
                target_id = e.get("target")
                break
        
        if not target_id:
            for e in edges:
                if "neutral" in (e.get("sourceHandle") or "").lower():
                    target_id = e.get("target")
                    break
        
        if not target_id:
            await engine._log("[WORKFLOW]", "No sentiment match found. Re-prompting user.", "text-amber-300")
            await engine._handle_reprompt(user_text)
            return True
            
        engine.current_node_id = target_id
        return False

class LanguageHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        language = await engine._detect_language(user_text)
        await engine._log("[WORKFLOW]", f"Language detected: {language}", "text-blue-400")
        
        edges = engine._get_outgoing_edges(node['id'])
        target_id = None
        
        # Match language code (e.g. 'en', 'hi') to edge sourceHandle or label
        for e in edges:
            lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
            if language.lower() in lbl:
                target_id = e.get("target")
                break
        
        if not target_id:
            # If only one edge exists, it's a pass-through
            if len(edges) == 1:
                target_id = edges[0].get("target")
            else:
                await engine._log("[WORKFLOW]", f"Ambiguous language path for '{language}'. Re-prompting.", "text-amber-300")
                await engine._handle_reprompt(user_text)
                return True

        engine.current_node_id = target_id
        return False

class BacktrackHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        await engine._log("[WORKFLOW]", "Backtrack point reached.", "text-purple-300")
        edges = engine._get_outgoing_edges(node['id'])
        if edges:
            engine.current_node_id = edges[0].get("target")
            return False
        else:
            engine.current_node_id = None
            return True


class ActionHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        action_type = _node_action_type(node)
        data = node.get("data") or node.get("config") or {}
        label = (node.get("data") or {}).get("label") or action_type

        await engine._log("[WORKFLOW]", f"Executing action: {action_type} — {label}", "text-amber-400")
        
        bot_config = getattr(engine.brain, "_bot_config", {})
        session_id = engine.brain.session.session_id
        user_id = engine.brain.session.user_id

        if action_type == "webhook":
            webhook_url = data.get("webhookUrl") or data.get("url") or bot_config.get("actions_webhook_url", "")
            if webhook_url:
                try:
                    payload = {
                        "action": label, 
                        "session_id": session_id, 
                        "user_id": user_id, 
                        "data": data,
                        "session_data": engine.session_data # Pass collected intents
                    }
                    async with httpx.AsyncClient(timeout=5.0) as _hc:
                        resp = await _hc.post(webhook_url, json=payload)
                    await engine._log("[WORKFLOW]", f"Webhook {webhook_url} → {resp.status_code}", "text-amber-300")
                except Exception as e:
                    logger.warning("[WorkflowEngine] Webhook failed: %s", e)
        
        elif action_type in ("sms", "email"):
            actions_url = bot_config.get("actions_webhook_url", "")
            spoken_msg = data.get("speech") or data.get("message") or engine._get_dynamic_response("notification_sent")
            
            if actions_url:
                async def _dispatch():
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as _hc:
                            await _hc.post(actions_url, json={
                                "action_type": action_type, "session_id": session_id, "user_id": user_id, "data": data
                            })
                    except Exception as e:
                        logger.warning("[WorkflowEngine] Action task failed: %s", e)
                task = asyncio.create_task(_dispatch())
                _background_tasks.add(task)
                task.add_done_callback(_background_tasks.discard)
            
            if spoken_msg:
                await engine.brain._generate_and_speak(spoken_msg)

        edges = engine._get_outgoing_edges(node['id'])
        if edges:
            engine.current_node_id = edges[0].get("target")
        else:
            engine.current_node_id = None
        return True # Yield after action

class KnowledgeHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        query = _node_knowledge_query(node)
        await engine._log("[WORKFLOW]", f"RAG lookup: '{query}'", "text-indigo-400")
        try:
            results = await engine.brain.db.search_knowledge(query, limit=2)
            if results:
                answer = results[0].get("answer", "")
                if answer:
                    await engine.brain._generate_and_speak(answer)
            else:
                # -> NEW DYNAMIC FALLBACK
                miss_msg = engine._get_dynamic_response("knowledge_miss")
                await engine.brain._generate_and_speak(miss_msg)
        except Exception as e:
            logger.warning("[WorkflowEngine] RAG failed: %s", e)
        
        edges = engine._get_outgoing_edges(node['id'])
        if edges:
            engine.current_node_id = edges[0].get("target")
        else:
            engine.current_node_id = None
        return True

class FallbackHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        await engine._log("[WORKFLOW]", "Yielding to agentic LLM.", "text-indigo-400")
        edges = engine._get_outgoing_edges(node['id'])
        engine.current_node_id = edges[0].get("target") if edges else None
        return True

HANDLER_REGISTRY: dict[str, BaseNodeHandler] = {
    "speech":     SpeechHandler(),
    "userInput":  UserInputHandler(),
    "logic":      LogicHandler(),
    "sentiment":  SentimentHandler(),
    "language":   LanguageHandler(),
    "backtrack":  BacktrackHandler(),
    "action":     ActionHandler(),
    "knowledge":  KnowledgeHandler(),
    "llm_fallback": FallbackHandler(),
}
# Canonical type aliases: both the React Flow UI types and legacy backend types are accepted
_TYPE_NORMALISE = {
    "bot-says":  "speech",
    "speech":    "speech",
    "user-input":  "userInput",
    "userInput":   "userInput",
    "smart-branch": "logic",
    "logic":        "logic",
    "sentiment":    "sentiment",
    "language":     "language",
    "backtrack":    "backtrack",
    "action":       "action",
    "knowledge":    "knowledge",
}

def _norm_type(raw: str) -> str:
    return _TYPE_NORMALISE.get(raw, raw)

def _node_speech(node: dict[str, Any]) -> str:
    """Extract the bot's speech text from any node format."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    
    # Check keys in order: data first, then config. 
    # Use explicit None check to allow intentional empty strings.
    for key in ["speech", "message"]:
        if (res := data.get(key)) is not None:
            return str(res)
        if (res := config.get(key)) is not None:
            return str(res)
    return ""

def _get_effective_speech(engine, node) -> str:
    """Get speech for a node, looking back one step if it's an empty userInput node."""
    speech = _node_speech(node)
    if speech:
        return speech
        
    # If empty userInput, try to find the immediate previous speech node
    node_type = _norm_type(node.get("type", ""))
    if node_type == "userinput":
        node_id = node.get("id")
        # Find incoming edges
        incoming = [e.get("source") for e in engine.edges if e.get("target") == node_id]
        if incoming:
            prev_node = engine.nodes.get(incoming[0])
            if prev_node:
                return _node_speech(prev_node)
    return ""


def _node_intents(node: dict[str, Any]) -> list[str]:
    """Extract expected intents/options from a userInput or logic node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return data.get("intents") or config.get("intents") or []


def _node_action_type(node: dict[str, Any]) -> str:
    """Return the action type (sms / email / webhook) from an action node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return (
        data.get("actionType") 
        or config.get("actionType") 
        or config.get("action_name") 
        or "action"
    )


def _node_knowledge_query(node: dict[str, Any]) -> str:
    """Return the knowledge search query from a knowledge node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return data.get("query") or config.get("query") or ""


def _extract_json(text: str) -> Optional[dict[str, Any]]:
    """
    Robust JSON extraction from LLM responses using regex.
    Handles markdown fences and trailing commas with a strict try/except guard.
    """
    if not text:
        return None
    try:
        # Improved regex to capture the first/outermost balanced JSON object
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match:
            return None
        
        json_str = match.group(0)
        return json.loads(json_str)
    except Exception as e:
        logger.warning("[WorkflowEngine] JSON extraction failed (Likely invalid syntax): %s", e)
        return None


class WorkflowEngine:
    """
    Stateful, node-graph conversational engine.

    Accepts both React Flow node format (with `position` + `data` fields) and
    the simpler backend-only format (`config` field, no `position`). The node
    type aliases table `_TYPE_NORMALISE` maps all known variants to canonical
    type strings that the `_execute_node_chain` switch handles.
    """

    # --- Constants ---
    MAX_HOPS = 20
    MAX_ESCALATION_TRANSCRIPT_TURNS = 10
    MAX_DYNAMIC_SPEECH_CONTEXT_TURNS = 6

    def __init__(self, brain, workflow_data: dict[str, Any]):
        self.brain = brain
        self.nodes = {n['id']: n for n in workflow_data.get('nodes', [])}
        self.edges = workflow_data.get('edges', [])

        # Build adjacency list
        self.adjacency: dict[str, list[dict]] = {}
        for edge in self.edges:
            src = edge.get("source")
            if src not in self.adjacency:
                self.adjacency[src] = []
            self.adjacency[src].append(edge)

        # 🔄 HYDRATION: Check for saved state in session metadata
        saved_node_id = None
        if self.brain.session and self.brain.session.metadata:
            saved_node_id = self.brain.session.metadata.get("workflow_node_id")

        self._current_node_id: Optional[str] = saved_node_id or workflow_data.get("start_node_id")
        self.history: list[str] = []
        # UNIFIED MEMORY: Workflow shares the brain's session metadata for persistence
        self.session_data: dict[str, Any] = self.brain.session.metadata
        self.last_user_text: str = ""
        self._spoke: bool = False
        self.last_intent = None

        # Harvest raw patterns from configuration for dynamic resolution
        bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
        rules = bot_cfg.get("conversational_rules") or {}
        self._raw_intent_patterns: dict[str, str] = rules.get("intent_patterns") or {}
        self.intent_patterns: dict[str, re.Pattern] = {}

        # Tracks how many times each node has been visited/executed in this session
        self.node_visit_counts: dict[str, int] = {}
        
        # Find start node if not set
        if not self._current_node_id and self.nodes:
            targets = {e.get("target") for e in self.edges}
            root_candidates = [n for n in self.nodes.keys() if n not in targets]
            self._current_node_id = root_candidates[0] if root_candidates else list(self.nodes.keys())[0]

        if saved_node_id:
            logger.info("[WorkflowEngine] Strategy-based engine RESUMED at node: %s", self._current_node_id)
        else:
            logger.info("[WorkflowEngine] Strategy-based engine initialized. Start: %s", self._current_node_id)
        self._classifier_llm = None

    def _get_intent_regex(self, name: str) -> Optional[re.Pattern]:
        """Dynamically resolve variables in regex and compile on-the-fly."""
        raw = self._raw_intent_patterns.get(name)
        if not raw:
            return None
            
        try:
            # Resolve dynamic variables [POS Amount], etc.
            resolved = self.brain._inject_variables(raw)
            return re.compile(resolved, re.I | re.UNICODE)
        except Exception as e:
            logger.error("[WorkflowEngine] Dynamic regex resolve failed for '%s': %s", name, e)
            return None

    def _get_outgoing_edges(self, node_id: str) -> list[dict]:
        return self.adjacency.get(node_id, [])

    @property
    def current_node_id(self) -> Optional[str]:
        return self._current_node_id

    @current_node_id.setter
    def current_node_id(self, value: Optional[str]):
        if value != self._current_node_id:
            logger.debug("[WorkflowEngine] Node transition: %s -> %s", self._current_node_id, value)
            self._current_node_id = value
            self._sync_state()

    def _mark_spoken(self):
        self._spoke = True

    def _sync_state(self):
        """Persist the current node ID to the database session metadata."""
        if not self.brain or not self.brain.session:
            return
            
        # 1. Update in-memory session metadata
        metadata = getattr(self.brain.session, "metadata", {})
        metadata["workflow_node_id"] = self.current_node_id
        
        # 2. Fire async DB sync
        if self.brain.db:
            asyncio.create_task(
                self.brain.db.merge_session_metadata(
                    self.brain.session.session_id, 
                    {"workflow_node_id": self.current_node_id}
                )
            )
            logger.debug("[WorkflowEngine] Synced current_node_id %s to DB", self.current_node_id)

    def _get_dynamic_response(self, category: str, **kwargs) -> str:
        """Picks a random, non-repeating human-like response based on session language."""
        user_lang = self.session_data.get("language", "en").lower()
        lang_key = "hi" if ("hi" in user_lang or user_lang.startswith("hi")) else "en"
        
        pool = _DYNAMIC_RESPONSES.get(category, {}).get(lang_key, [])
        if not pool:
            return "..." # Ultimate fallback

        # Prevent immediate repetition
        history_key = f"_last_{category}"
        last_used = getattr(self, history_key, "")
        
        choices = [phrase for phrase in pool if phrase != last_used]
        if not choices:
            choices = pool # Fallback if pool is too small

        import random
        selected = random.choice(choices)
        
        # Inject dynamic variables like {name}
        try:
            selected = selected.format(**kwargs)
        except KeyError:
            pass

        setattr(self, history_key, selected)
        return selected

    async def evaluate(self, user_text: str) -> bool:
        """
        Process the workflow. 
        """
        if not self.current_node_id or self.current_node_id not in self.nodes:
            return True

        user_text = user_text.strip()
        if user_text:
            # Globally detect and update session language context on every turn
            await self._detect_language(user_text)

            # 1. Global Interceptors (Disconnect/Escalate)
            global_intent = await self._check_global_interceptor(user_text)
            if global_intent in ("DISCONNECT", "ESCALATE"):
                key = "disconnect" if global_intent == "DISCONNECT" else "escalation"
                key_color = "text-red-400" if global_intent == "DISCONNECT" else "text-orange-400"
                await self._log("[INTERCEPTOR]", f"Detected global move: {global_intent}", f"{key_color} font-bold")
                
                # Speak the proper farewell and terminate
                farewell = self._resolve_farewell(key)
                await self.brain._generate_and_speak(farewell)
                
                if global_intent == "DISCONNECT":
                    self.brain.request_voice_session_end("user_disconnect")
                else:
                    await self._handle_escalation()
                
                return False # MUST return False to prevent double-speech

            if global_intent == "HURRY":
                await self._log("[INTERCEPTOR]", "Detected impatience: HURRY. Accelerating.", "text-amber-400 font-bold")
                
                # -> NEW DYNAMIC ACKNOWLEDGMENT
                ack_msg = self._get_dynamic_response("hurry_ack")
                await self.brain._generate_and_speak(ack_msg)

                # 2. Flag the session to force the next LLM generation to be ultra-short
                self.session_data["hurry_mode"] = True

                # 3. Advance the workflow
                edges = self._get_outgoing_edges(self.current_node_id)
                if edges:
                    best_edges = [e for e in edges if "retry" not in (e.get("label") or "").lower()]
                    self.current_node_id = (best_edges or edges)[0].get("target")
                    return await self.evaluate("")

            # 2. Navigation / Context Switching (Backtrack or Jump)
            nav_intent = await self._detect_navigational_intent(user_text)
            if nav_intent:
                action = nav_intent.get("action")
                target = nav_intent.get("target_label")
                if action in ("BACKTRACK", "JUMP") and target:
                    if await self._handle_jump(target):
                        await self._log("[NAV]", f"Context switched to → {target}", "text-purple-300")
                elif action == "BACKTRACK": # Simple backtrack
                    if await self._handle_backtrack(None):
                        await self._log("[NAV]", "Backtracked.", "text-purple-300")

            # 3. FAQ / Knowledge Interceptor
            if await self._check_knowledge_interceptor(user_text):
                await self._log("[GLOBAL]", "FAQ Interceptor matched", "text-indigo-400")
                if await self._execute_knowledge_jump(user_text):
                    return False # Knowledge took over

        # 3. Advance past userInput blockers
        node = self.nodes[self.current_node_id]
        node_type = _norm_type(node.get("type", ""))
        
        if user_text and node_type == "userInput":
            # Track visits for userInput to trigger auto-backtrack on persistent failure
            current_visits = self.node_visit_counts.get(self.current_node_id, 0)
            retry_limit = int((node.get("data") or {}).get("retry_limit") or 2)
            
            edges = self._get_outgoing_edges(self.current_node_id)
            if not edges:
                self.current_node_id = None
                return True
            
            logger.info("[evaluate] Node: %s | Outgoing Edges: %d", self.current_node_id, len(edges))
            
            self.last_user_text = user_text
            self.node_visit_counts[self.current_node_id] = current_visits + 1
            
            # If we've failed too many times, backtrack to help the user get back on track
            if current_visits >= retry_limit:
                await self._log("[ENGINE]", f"Persistent ambiguity on node '{self.current_node_id}'. Attempting auto-backtrack.", "text-amber-400")
                if await self._handle_backtrack(None):
                    return await self._execute_node_chain(user_text)
                return True # Yield if we can't backtrack
            
            # Smart Guard: If user says "No/Can't" but we only have a "Success" path, block it.
            if len(edges) == 1:
                lbl = (edges[0].get("label") or edges[0].get("sourceHandle") or "").lower()
                expected_intents = _node_intents(node)
                
                # Logic Passthrough: If the next node is a LOGIC node, 
                # ALWAYS pass the input through. Logic nodes handle the validation internally.
                target_node = self.nodes.get(edges[0].get("target"), {})
                target_type = _norm_type(target_node.get("type", ""))
                
                logger.info("[evaluate] One edge detected. Target: %s (%s) | lbl: '%s' | Expected Intents: %s", 
                            edges[0].get("target"), target_type, lbl, expected_intents)
                
                if target_type == "logic" or (not lbl or lbl == "next") and not expected_intents:
                    self.current_node_id = edges[0].get("target")
                    return await self._execute_node_chain(user_text)

                # Otherwise, strict validation
                sentiment = await self._classify_sentiment(user_text)
                if sentiment == "negative" and "yes" not in lbl:
                    await self._log("[ENGINE]", "Refusal detected on success-path. Attempting smart routing to Empathy.", "text-red-400")
                    
                    # 1. Try to find a 'refusal' or 'retry_1' path in the global graph
                    if await self._handle_jump("Tier 1 - Empathy") or await self._handle_jump("Empathy") or await self._handle_jump("refusal"):
                        return await self._execute_node_chain(user_text)
                        
                    # 2. Fallback to backtrack
                    if await self._handle_backtrack(None):
                        return await self._execute_node_chain(user_text)
                    
                    # 3. If all else fails, yield but don't error
                    return True 
                
                # If user says something irrelevant like "hello", stay here rather than jumping
                valid_options = [lbl] if lbl and lbl != "next" else expected_intents
                selected = await self._classify_intent(user_text, valid_options)
                
                if selected == "NONE":
                    await self._handle_reprompt(user_text)
                    return False # Return False: We already spoke the reprompt, don't let Brain speak again.
                
                # If we matched one of the node's semantic intents, proceed to the target
                self.last_intent = selected
                self.current_node_id = edges[0].get("target")
            else:
                labels = [e.get("label") or e.get("sourceHandle") or "next" for e in edges]
                selected = await self._classify_intent(user_text, labels)
                self.last_intent = selected # Capture for UI debugging
                
                # Intelligence Update: If NO match found, stay on node and re-prompt!
                if selected == "NONE":
                    await self._log("[ENGINE]", f"Ambiguous input: '{user_text}'. Providing clarification.", "text-amber-400")
                    await self._handle_reprompt(user_text)
                    return False # Return False to prevent double-speech
                
                target_id = next((e.get("target") for e in edges if (e.get("label") or "").lower() == selected.lower()), None)
                if not target_id:
                    await self._handle_reprompt(user_text)
                    return False

                self.current_node_id = target_id

        return await self._execute_node_chain(user_text)

    def _resolve_farewell(self, key: str) -> str:
        """Get farewell/escalation message dynamically based on detected language."""
        bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
        msg = bot_cfg.get(f"{key}_message") or bot_cfg.get("farewell_message") or bot_cfg.get("farewell")
        if msg:
            return msg
            
        name = bot_cfg.get("name", "Assistant")
        
        # -> NEW DYNAMIC FAREWELLS
        if key == "disconnect":
            return self._get_dynamic_response("disconnect", name=name)
            
        # Escalation Handshake (Warm Transfer)
        return self._get_dynamic_response("escalate")

    async def _execute_node_chain(self, user_text: str = "") -> bool:
        """
        Walk the graph executing deterministic nodes until a blocking point.
        Returns True if the caller should yield to the main LLM (free-form fallback).
        Returns False if the workflow handled the turn fully.
        """
        hops = 0
        self._spoke = False

        while self.current_node_id and self.current_node_id in self.nodes and hops < self.MAX_HOPS:
            hops += 1
            # 0. SENSORY SYNC: Check for hardware interruptions or session end
            if self.brain._interrupt_event.is_set() or self.brain.session.voice_session_end_requested:
                logger.debug("[WorkflowEngine] Aborting node chain due to interruption/session end.")
                return False

            prev_node_id = self.current_node_id
            node = self.nodes[self.current_node_id]
            node_type = _norm_type(node.get("type", "")) or "llm_fallback"
            
            try:
                handler = HANDLER_REGISTRY.get(node_type) or HANDLER_REGISTRY["llm_fallback"]
                should_pause = await handler.handle(self, node, user_text)
                if should_pause:
                    break
            except Exception as e:
                logger.error("[WorkflowEngine] Handler Error at node %s: %s", self.current_node_id, e)
                await self._log("[ENGINE]", f"Logic Failure! Redirecting to fallback...", "text-red-500")
                
                # Try to jump to fallback node
                fallback_id = next((nid for nid, n in self.nodes.items() if _norm_type(n.get("type", "")) == "llm_fallback"), None)
                if fallback_id and self.current_node_id != fallback_id:
                    self.current_node_id = fallback_id
                    continue
                else:
                    return True # Yield to LLM on absolute failure

            # ADVANCEMENT LOGIC:
            # If the handler didn't move the node ID, and it's not a node that
            # waits for user input, move to the first outgoing edge automatically.
            if self.current_node_id == prev_node_id and node_type != "userInput":
                edges = self._get_outgoing_edges(self.current_node_id)
                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    # Sink node: Try fallback or stop
                    fallback_id = next((nid for nid, n in self.nodes.items() if _norm_type(n.get("type", "")) == "llm_fallback"), None)
                    if fallback_id and self.current_node_id != fallback_id:
                        self.current_node_id = fallback_id
                    else:
                        self.current_node_id = None
                        break

        if hops >= self.MAX_HOPS:
            logger.error("[WorkflowEngine] Max hop limit reached — possible loop in graph.")

        if hops > 0 and not self._spoke:
            logger.warning("[WorkflowEngine] Chain ran but produced no speech — yielding.")
            return True
        return False

    async def _handle_escalation(self) -> None:
        """
        Fire escalation webhook (if configured on bot) and end the voice session.
        Falls back to a spoken message when no webhook URL is set.
        """
        bot_config = getattr(self.brain, "_bot_config", {})
        escalate_url = bot_config.get("escalate_webhook_url", "")
        session_id = self.brain.session.session_id
        user_id = self.brain.session.user_id

        # Gather recent transcript for context
        transcript_lines: list[str] = []
        try:
            for turn in self.brain.session.get_context_window(max_turns=self.MAX_ESCALATION_TRANSCRIPT_TURNS):
                transcript_lines.append(f"{turn['role'].capitalize()}: {turn['content']}")
        except Exception:
            pass
        transcript_text = "\n".join(transcript_lines)

        if escalate_url:
            try:
                # Add workflow session data to give the live agent instant context
                wf_data = getattr(self, "session_data", {})
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(escalate_url, json={
                        "session_id": session_id,
                        "user_id": user_id,
                        "reason": "user_requested_escalation",
                        "transcript": transcript_text,
                        "extracted_data": wf_data
                    })
                await self._log("[ESCALATE]", f"Escalation webhook fired → {escalate_url}", "text-orange-400")
            except Exception as e:
                logger.warning("[WorkflowEngine] Escalation webhook failed: %s", e)

        await self.brain._generate_and_speak(self._resolve_farewell("escalation"))
        self.brain.request_voice_session_end("escalated")


    async def _log(self, tag: str, msg: str, color: str = "text-outline"):
        try:
            await self.brain._log_event(tag, msg, color)
        except Exception:
            pass

    def _get_classifier_llm(self):
        """
        Return a fast, cheap LLM for classification tasks (intent, sentiment, interceptor).

        Instance is created once per WorkflowEngine and cached — 'Provider initialized'
        logs appear only on the FIRST call.

        Resolution order (first match wins):
          1. bot_config["classifier_llm_provider"] + bot_config["classifier_llm_model"]
          2. Settings: CLASSIFIER_LLM_PROVIDER / CLASSIFIER_LLM_MODEL env vars
          3. Auto-pick: Groq if GROQ_API_KEY set (fast, free tier)
          4. Auto-pick: OpenRouter if OPENROUTER_API_KEY set (uses default model)
          5. Bot's main LLM (shared, not cached here)
        """
        if self._classifier_llm is not None:
            return self._classifier_llm

        bot_cfg: dict = (self.brain._bot_config or {}) if hasattr(self.brain, "_bot_config") else {}

        try:
            from voicebot.shared.config import get_settings
            _s = get_settings()

            # 1. Explicit bot-level override (Classifier-specific)
            provider = bot_cfg.get("classifier_llm_provider")
            model    = bot_cfg.get("classifier_llm_model")

            # NEW: If not explicitly set for classifier, use the main bot's settings
            if not provider:
                provider = bot_cfg.get("llm_provider") or bot_cfg.get("llm") or getattr(_s, "classifier_llm_provider", "")
                model    = bot_cfg.get("llm_model") or getattr(_s, "classifier_llm_model", "")

            if provider:
                provider = provider.lower()
                if provider == "groq" and _s.groq_api_key:
                    from voicebot.services.llm.groq_provider import GroqStreamingProvider
                    self._classifier_llm = GroqStreamingProvider(model=model or _s.groq_model or "llama-3.3-70b-versatile")
                    return self._classifier_llm
                if provider == "openrouter" and _s.openrouter_api_key:
                    from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
                    self._classifier_llm = OpenRouterStreamingProvider(model=model or "meta-llama/llama-3.3-70b-instruct")
                    return self._classifier_llm
                if provider == "anthropic" and _s.anthropic_api_key:
                    from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
                    self._classifier_llm = AnthropicStreamingProvider(model=model or "claude-haiku-4-20250514")
                    return self._classifier_llm
                if provider == "gemini" and _s.gemini_api_key:
                    from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
                    self._classifier_llm = GeminiStreamingProvider(model=model or "gemini-2.0-flash-001")
                    return self._classifier_llm

            # 2. Auto-pick: Groq first (fastest + free tier)
            if _s.groq_api_key:
                from voicebot.services.llm.groq_provider import GroqStreamingProvider
                self._classifier_llm = GroqStreamingProvider(model=_s.groq_model or "llama-3.1-8b-instant")
                return self._classifier_llm

            # 3. Auto-pick: OpenRouter free models
            if _s.openrouter_api_key:
                from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider
                self._classifier_llm = OpenRouterStreamingProvider(model="meta-llama/llama-3.3-70b-instruct")
                return self._classifier_llm

        except Exception as _e:
            logger.warning("[WorkflowEngine] classifier LLM init failed (%s), using main LLM", _e)

        # Final fallback — the bot's main LLM (not cached here since it's shared)
        return self.brain.llm

    def get_context_status(self) -> str:
        """Return a high-level summary of the current node's objective for the Agent Brain."""
        if not self.current_node_id or self.current_node_id not in self.nodes:
            return "No active workflow task."
            
        # Recursive Lookback: Find the most recent instruction/speech node
        target_id = self.current_node_id
        visited = set()
        
        while target_id and target_id in self.nodes and target_id not in visited:
            visited.add(target_id)
            node = self.nodes[target_id]
            node_type = (node.get("type") or "").lower()
            
            # Extract meaningful objective text
            text = node.get("data", {}).get("speech") or \
                   node.get("data", {}).get("text") or \
                   node.get("config", {}).get("text") or \
                   node.get("data", {}).get("label") or ""
            
            if text and node_type in ("speech", "userinput", "verify", "identification"):
                label = node.get("data", {}).get("label") or node.get("id")
                return f"CURRENT TASK: [{label}]. Objective: {text[:250]}"
            
            # Walk backward to find context if we're in a Logic node (Logic nodes don't have text)
            # This is simple 'reverse scan' — in complex graphs we take the first incoming edge
            incoming = [e.get("source") for e in self.edges if e.get("target") == target_id]
            target_id = incoming[0] if incoming else None
            
        return "Executing background logic. Stay on high alert for user interruptions."

    async def _classifier_complete(self, system_prompt: str, user_prompt: str) -> str:
        """Stream a single classifier response using the cheap classifier LLM."""
        llm = self._get_classifier_llm()
        chunks: list[str] = []
        async for chunk in llm.stream_completion(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        ):
            chunks.append(chunk.content or "")
        return "".join(chunks).strip()

    async def _check_global_interceptor(self, text: str) -> str:
        """Detect disconnect / escalation / hurry intent via dynamic patterns or cheap LLM."""
        # 1. Fast-path regex (dynamic from config)
        if (p := self._get_intent_regex("disconnect")) and p.search(text):
            return "DISCONNECT"
        if (p := self._get_intent_regex("escalate")) and p.search(text):
            return "ESCALATE"

        # 1b. Fast-path for impatience (Hindi/English)
        text_lower = text.lower().strip("?.! ")
        if any(h in text_lower for h in ["jaldi", "fast", "fatafat", "hurry"]):
            return "HURRY"

        # Refinement: Reject conversational statements or logic keywords that aren't explicit requests to stop.
        if text_lower in ("no", "never", "can't pay", "i don't have money", "give me money"):
            return "CONTINUE"

        # 2. Heuristic check: short utterances are rarely global intents
        if len(text.split()) <= 4:
            return "CONTINUE"

        # 3. LLM classification fallback
        try:
            prompt = PROMPT_TEMPLATES["global_intent"].format(text=text)
            response = await self._classifier_complete(
                "You are a strict intent classifier. Reply only with: DISCONNECT, ESCALATE, HURRY, or CONTINUE.",
                prompt,
            )
            response = response.upper()
            if "DISCONNECT" in response: return "DISCONNECT"
            if "ESCALATE" in response: return "ESCALATE"
            if "HURRY" in response: return "HURRY"
            return "CONTINUE"
        except Exception as e:
            logger.error("[WorkflowEngine] Global interceptor error: %s", e)
            return "CONTINUE"

    async def _classify_intent(self, text: str, options: list[str]) -> str:
        """Map user input to one of the provided labels or 'NONE' if ambiguous."""
        text_lower = text.lower()
        
        # Fast path for very short turns
        if len(text_lower.split()) < 3:
            # 1. Load affinities (Shared Defaults + Bot Overrides)
            bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
            affinities = {**DEFAULT_SEMANTIC_AFFINITIES, **(bot_cfg.get("semantic_affinities", {}))}
            
            for opt in options:
                opt_low = opt.lower()
                # Direct match
                if opt_low in text_lower:
                    return opt
                # Affinity match
                for aff_key, keywords in affinities.items():
                    if aff_key in opt_low and any(k == text_lower for k in keywords):
                        return opt

        user_lang = self.session_data.get("language", "en")
        ops_str = ", ".join([f'"{opt}"' for opt in options])
        try:
            prompt = PROMPT_TEMPLATES["logic_intent"].format(
                user_lang=user_lang,
                ops_str=ops_str,
                text=text
            )
            response = await self._classifier_complete(
                "You are an intent classifier. Output exactly the label and nothing else.",
                prompt,
            )
            for opt in options:
                if opt.lower() in response.lower():
                    return opt
            return "NONE"
        except Exception as e:
            logger.error("[WorkflowEngine] Intent classification error: %s", e)
            return "NONE"

    async def _handle_reprompt(self, last_input: str) -> None:
        """Informative clarification + Repeat the current question."""
        node = self.nodes.get(self.current_node_id, {})
        base_speech = _get_effective_speech(self, node)
        
        # Use LLM to generate a smart clarification. 
        # If the user is asking a relevant question (e.g. "What is your bank name?"), 
        # the LLM should answer it first, then re-ask the original question.
        lang_instruction = self._get_lang_instruction()
        clarification_prompt = (
            f"The user said '{last_input}' while the bot's current objective is: {base_speech}.\n\n"
            f"TASK:\n"
            f"1. If the user asked a relevant question, ANSWER IT briefly.\n"
            f"2. Then, RE-ASK the original question to get the workflow back on track.\n\n"
            f"CRITICAL: {lang_instruction} Keep your total response under 2 sentences."
        )
        
        try:
            # Use the main LLM for this as it might need general knowledge, not just classification
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are a professional debt collection voice assistant. Answer user queries concisely and stay on track.",
                messages=[{"role": "user", "content": clarification_prompt}]
            ):
                chunks.append(chunk.content or "")
            res = "".join(chunks).strip()
            
            await self.brain._generate_and_speak(res)
            self._spoke = True
        except Exception as e:
            logger.error("[WorkflowEngine] Reprompt generation failed: %s", e)
            # -> NEW DYNAMIC ERROR MESSAGE
            err_msg = self._get_dynamic_response("reprompt_error")
            await self.brain._generate_and_speak(err_msg)
            self.brain.request_voice_session_end("reprompt_error")
            self._spoke = True

    async def _classify_sentiment(self, text: str) -> str:
        """Detect base sentiment via dynamic patterns or cheap LLM."""
        pos = self._get_intent_regex("positive")
        neg = self._get_intent_regex("negative")
        
        if pos and pos.search(text) and (not neg or not neg.search(text)):
            return "positive"
        if neg and neg.search(text) and (not pos or not pos.search(text)):
            return "negative"

        if len(text.split()) <= 3:
            return "neutral"

        try:
            prompt = PROMPT_TEMPLATES["sentiment"].format(text=text)
            response = await self._classifier_complete(
                "You are a sentiment classifier. Reply only with: positive, neutral, or negative.",
                prompt,
            )
            response = response.lower()
            if "positive" in response: return "positive"
            if "negative" in response: return "negative"
            return "neutral"
        except Exception as e:
            logger.error("[WorkflowEngine] Sentiment classification error: %s", e)
            return "neutral"

    async def _detect_language(self, text: str) -> str:
        """
        Stateful language detection optimized for English, Hindi, and Hinglish.
        Short texts inherit the session language to prevent amnesia.
        """
        # 1. Fetch existing language from session (default to 'en')
        current_lang = self.session_data.get("language", "en")

        if not text:
            return current_lang
            
        # 2. Don't waste LLM tokens on short utterances (e.g., "haan", "yes", "theek hai").
        if len(text.split()) < 3:
            return current_lang

        try:
            prompt = (
                f'Identify the primary language of this text. It will be one of: English, pure Hindi (Devanagari), or Hinglish (Hindi words written in English script, or a mix).\n'
                f'Reply STRICTLY with exactly one word: "en" for English, "hi" for Hindi, or "hinglish" for Hinglish.\n\n'
                f'Text: "{text}"'
            )
            result = await self._classifier_complete(
                "You are a language detector. Reply ONLY with 'en', 'hi', or 'hinglish'.",
                prompt,
            )
            detected = result.lower().strip()
            
            # Clean up punctuation just in case
            detected = re.sub(r'[^a-z]', '', detected)
            
            # 3. Save to state if valid
            if detected in ["en", "hi", "hinglish"]:
                self.session_data["language"] = detected
                if self.brain and self.brain.session:
                    self.brain.session.detected_language = detected
                return detected
                
            return current_lang
        except Exception as e:
            logger.error("[WorkflowEngine] Language detection error: %s", e)
            return current_lang

    def _get_lang_instruction(self) -> str:
        """Get prompt directive for the current session language script."""
        user_lang = self.session_data.get("language", "en")
        if user_lang == "hinglish":
            return "Respond in HINGLISH (conversational Hindi written entirely in the Latin/English alphabet)."
        elif user_lang == "hi":
            return "Respond in pure Hindi (Devanagari script)."
        return "Respond in professional English."

    # ─── Advanced AI Orchestration ──────────────────────────────────────────

    async def _generate_dynamic_speech(self, node: dict, last_user_text: str) -> str:
        """Use LLM to generate context-aware speech for a workflow node."""
        label = (node.get("data") or {}).get("label") or "Response"
        base_text = _node_speech(node)
        
        context_str = "None"
        try:
            turns = self.brain.session.get_context_window(max_turns=self.MAX_DYNAMIC_SPEECH_CONTEXT_TURNS)
            if turns:
                context_str = "\n".join([f"{t['role'].capitalize()}: {t['content']}" for t in turns])
        except Exception:
            pass

        lang_instruction = self._get_lang_instruction()
        
        # Apply hurry modifier if the user is impatient
        hurry_modifier = ""
        if self.session_data.pop("hurry_mode", None):
            hurry_modifier = "\nCRITICAL: The user is in a rush. Skip all pleasantries, empathy, and filler words. Deliver the core information in maximum 1 short sentence."

        prompt = PROMPT_TEMPLATES["dynamic_speech"].format(
            label=label,
            base_text=base_text,
            context_str=context_str,
            last_user_text=last_user_text or "None"
        )
        prompt += f"\n\nCRITICAL LANGUAGE RULE: {lang_instruction}{hurry_modifier}"

        try:
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are a natural-sounding voice assistant. Speak concisely and empathetically.",
                messages=[{"role": "user", "content": prompt}]
            ):
                chunks.append(chunk.content or "")
            return "".join(chunks).strip()
        except Exception as e:
            logger.error("[WorkflowEngine] Dynamic speech error: %s", e)
            return base_text

    async def _handle_jump(self, target_label: Optional[str]) -> bool:
        """Find ANY node in the graph matching the target_label semantically."""
        if not target_label:
            return False

        # 1. Direct label match (case-insensitive)
        for node_id, node in self.nodes.items():
            label = (node.get("data") or {}).get("label") or ""
            if target_label.lower() in label.lower():
                self.current_node_id = node_id
                # Reset history to this point (if possible) or just continue
                return True

        # 2. Fuzzy match via LLM or simplified check
        # For now, we stick to label substring matching as it's safer for structured flows.
        return False

    async def _check_knowledge_interceptor(self, text: str) -> bool:
        """Heuristic and LLM check to see if we should trigger a RAG lookup."""
        if not text or len(text.split()) < 4:
            return False
            
        try:
            prompt = PROMPT_TEMPLATES["knowledge_intent"].format(text=text)
            resp = await self._classifier_complete("Classify intent as FAQ or not.", prompt)
            return "YES" in resp.upper()
        except Exception:
            return False

    async def _execute_knowledge_jump(self, user_text: str) -> bool:
        """
        Find all knowledge nodes or do direct RAG, then resume original flow if possible.
        Hardened with:
          1. Multi-node Aggregation (Combines all knowledge nodes in graph)
          2. Topic & Source filtering
          3. LLM Grounding (verification before speaking)
        """
        all_topics = set()
        all_sources = set()
        
        # 1. Collect filters from ALL knowledge nodes in the current graph
        for node in self.nodes.values():
            if _norm_type(node.get("type", "")) == "knowledge":
                node_data = node.get("data") or {}
                
                # Topics
                t = node_data.get("topics") or node_data.get("filter") or []
                if isinstance(t, str): all_topics.add(t)
                elif isinstance(t, list): all_topics.update(t)
                
                # Sources (filenames)
                s = node_data.get("sources") or node_data.get("source") or []
                if isinstance(s, str): all_sources.add(s)
                elif isinstance(s, list): all_sources.update(s)
        
        # 2. Build data_access filter
        data_access = {}
        if all_topics:
             data_access["knowledge_topic_allowlist"] = list(all_topics)
        if all_sources:
             data_access["knowledge_source_allowlist"] = list(all_sources)
             
        if data_access:
            logger.info("[Knowledge] Using combined filters: %s", data_access)

        # 3. Fetch RAG Context
        try:
            results = await self.brain.db.search_knowledge(user_text, limit=2, data_access=data_access)
            if not results:
                logger.info("[Knowledge] No RAG results found for query: %s", user_text)
                return False
                
            # Combine snippets for the LLM
            context_blocks = []
            for r in results:
                context_blocks.append(f"Topic: {r.get('topic')}\nSource: {r.get('source')}\nQ: {r.get('question')}\nA: {r.get('answer')}")
            full_context = "\n---\n".join(context_blocks)

            # 4. LLM Grounding Verification
            lang_instruction = self._get_lang_instruction()
            prompt = PROMPT_TEMPLATES["knowledge_grounding"].format(
                text=user_text,
                context=full_context
            )
            prompt += f"\n\nCRITICAL: {lang_instruction}"
            
            rephrased_resp = await self._classifier_complete("Verify and rephrase RAG context.", prompt)
            rephrased_resp = rephrased_resp.strip()
            
            if "[REJECT]" in rephrased_resp.upper() or len(rephrased_resp) < 5:
                logger.warning("[Knowledge] Grounding REJECTED for text: '%s'", user_text)
                return False
                
            # 5. Success!
            await self._log("[GLOBAL]", f"RAG Grounded ({len(results)} matches)", "text-green-400")
            
            # Bridge back to the current node's goal
            current_node = self.nodes.get(self.current_node_id, {})
            current_speech = _node_speech(current_node)
            final_output = rephrased_resp
            if current_speech:
                bridge = self._get_dynamic_response("grounding_bridge")
                final_output = f"{rephrased_resp} {bridge} {current_speech}"
            
            await self.brain._generate_and_speak(final_output)
            return True
            
        except Exception as e:
            logger.error("[Knowledge] Error during grounding: %s", e)
            return False

    async def _detect_navigational_intent(self, text: str) -> Optional[dict]:
        """Detect if user wants to jump back, skip, or restart via dynamic regex or cheap LLM."""
        if not text: return None

        # Stage 1: Dynamic Regex lookup
        nav_p = self._get_intent_regex("navigation")
        if nav_p and not nav_p.search(text):
            return None

        # Stage 2: LLM analysis
        if len(text.split()) < 3: # Shorter threshold for navigation keywords
            return None

        prompt = PROMPT_TEMPLATES["nav_intent"].format(text=text)
        try:
            resp = await self._classifier_complete(
                "You are a navigation intent detector. Reply ONLY with valid JSON.",
                prompt,
            )
            data = _extract_json(resp)
            if not data or data.get("action") == "CONTINUE":
                return None
            return data
        except Exception as e:
            logger.error("[WorkflowEngine] Nav intent error: %s", e)
            return None

    async def _handle_backtrack(self, target_label: Optional[str]) -> bool:
        """Find the best node in history to jump back to."""
        if not self.history:
            return False

        target_node_id = None
        
        if target_label:
            # Try to match history labels
            for node_id in reversed(self.history):
                node = self.nodes.get(node_id)
                if node and target_label.lower() in (node.get("data", {}).get("label") or "").lower():
                    target_node_id = node_id
                    break
        
        if not target_node_id:
            # Pop last item (current node's parent)
            target_node_id = self.history[-1] if self.history else None

        if target_node_id:
            await self._log("[NAV]", f"Backtracking → {target_node_id}", "text-purple-400")
            self.current_node_id = target_node_id
            # Truncate history after the jump
            try:
                idx = self.history.index(target_node_id)
                self.history = self.history[:idx]
            except ValueError:
                pass
            return True
        
        return False

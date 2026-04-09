import json
import re
import asyncio
import httpx
from typing import Optional, Any
import logging
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("workflow-engine")

# Node type used to signal "hand off to the main LLM" — any unknown type also falls through.
_LLM_FALLBACK_TYPE = "llm_fallback"

# --- Global Prompt Registry ---
PROMPT_TEMPLATES = {
    "dynamic_speech": (
        "You are a sophisticated AI voice bot. Your current workflow step is: {label}.\n"
        "Base Instruction: {base_text}\n\n"
        "Context from conversation:\n{context_str}\n\n"
        "Recent User Input: {last_user_text}\n\n"
        "Your Task: Generate a warm, professional response that fulfills the bridge between the conversation context and the workflow goal.\n"
        "Keep it concise (1-2 sentences) and suitable for high-quality voice synthesis.\n"
        "If the user mentioned specific details (e.g., their name, a date), acknowledge them naturally."
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
        "Does this voice transcript show:\n"
        "- User wants to hang up / end the call? → reply: DISCONNECT\n"
        "- User wants a human agent/manager? → reply: ESCALATE\n"
        "- Normal response? → reply: CONTINUE\n\n"
        "Reply STRICTLY with ONE word.\n\nTranscript: \"{text}\""
    ),
    "logic_intent": (
        "Classify the following user input into EXACTLY ONE of: [{ops_str}].\n"
        "CRITICAL: You must output ONLY the raw string label. Do not output conversational text or preamble.\n"
        "If no match is found, output \"NONE\".\n\n"
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
            text = engine._inject_variables(text)
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
            engine.current_node_id = None
            return True # Yield

class UserInputHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        # userInput always pauses the flow execution for the next turn
        return True

class LogicHandler(BaseNodeHandler):
    async def handle(self, engine, node, user_text):
        edges = engine._get_outgoing_edges(node['id'])
        if not edges:
            engine.current_node_id = None
            return True # Yield to LLM
            
        intents = _node_intents(node)
        edge_labels = [e.get("label") or e.get("sourceHandle") or "" for e in edges]
        all_options = list(set([l for l in edge_labels + intents if l]))

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

            # Priority B: Direct Handle Match (Intuitive branching for Yes/No)
            # We look for an edge that matches the sentiment's handle AND hasn't been exhausted if it's a retry
            for e in edges:
                handle = (e.get("sourceHandle") or "").lower()
                if handle == target_handle:
                    # If this is a numbered retry path (e.g. retry_1), follow the current visit count
                    lbl = (e.get("label") or "").lower()
                    if "retry_" in lbl:
                        current_visits = engine.node_visit_counts.get(node['id'], 0)
                        if f"retry_{current_visits + 1}" in lbl:
                           await engine._log("[WORKFLOW]", f"Sentiment routing → {lbl}", "text-emerald-400")
                           engine.node_visit_counts[node['id']] = current_visits + 1
                           engine.current_node_id = e.get("target")
                           return False
                    else:
                        # Simple un-labeled handle match
                        await engine._log("[WORKFLOW]", f"Sentiment routing → handle '{target_handle}'", "text-emerald-400")
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
            spoken_msg = data.get("speech") or data.get("message") or (
                "I've sent that information to your registered mobile number." if action_type == "sms"
                else "I've sent you an email with the details."
            )
            if actions_url:
                async def _dispatch():
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as _hc:
                            await _hc.post(actions_url, json={
                                "action_type": action_type, "session_id": session_id, "user_id": user_id, "data": data
                            })
                    except Exception as e:
                        logger.warning("[WorkflowEngine] Action task failed: %s", e)
                asyncio.create_task(_dispatch())
            
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
                await engine.brain._generate_and_speak("I don't have that info yet, but I can check for you.")
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

        self.current_node_id: Optional[str] = workflow_data.get("start_node_id")
        self.history: list[str] = []
        self.session_data: dict[str, Any] = {}
        self.last_user_text: str = ""
        self._spoke: bool = False
        self.last_intent = None

        # Compile conversational regexes from bot config
        self.intent_patterns: dict[str, re.Pattern] = {}
        self._init_intent_patterns()

        # Tracks how many times each node has been visited/executed in this session
        self.node_visit_counts: dict[str, int] = {}
        
        # Find start node if not set
        if not self.current_node_id and self.nodes:
            targets = {e.get("target") for e in self.edges}
            root_candidates = [n for n in self.nodes.keys() if n not in targets]
            self.current_node_id = root_candidates[0] if root_candidates else list(self.nodes.keys())[0]

        logger.info("[WorkflowEngine] Strategy-based engine initialized. Start: %s", self.current_node_id)
        self._classifier_llm = None

    def _init_intent_patterns(self):
        """Compile regexes from bot configuration (conversational_rules)."""
        bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
        # Expected config format: {"intent_patterns": {"disconnect": "bye|stop", "positive": "yes|ok"}}
        rules = bot_cfg.get("conversational_rules") or {}
        patterns = rules.get("intent_patterns") or {}

        for name, raw in patterns.items():
            try:
                self.intent_patterns[name] = re.compile(raw, re.I | re.UNICODE)
            except Exception as e:
                logger.error("[WorkflowEngine] Invalid regex for intent '%s': %s", name, e)

    def _get_outgoing_edges(self, node_id: str) -> list[dict]:
        return self.adjacency.get(node_id, [])

    def _mark_spoken(self):
        self._spoke = True

    def _inject_variables(self, text: str) -> str:
        """Replace [Variable Name] placeholders from session data, metadata, mappings, or bot defaults."""
        if not text: return ""
        
        # 1. Gather all data sources
        metadata = getattr(self.brain.session, "metadata", {}) if self.brain.session else {}
        session_data = self.session_data
        bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
        
        # New: Bot-level mappings and defaults
        mappings = bot_cfg.get("variable_mappings", {})
        defaults = bot_cfg.get("metadata_defaults", {})
        
        # Regex to find [Bracked Variables]
        pattern = re.compile(r'\[(.*?)\]')
        
        def _repl(match):
            key = match.group(1).strip()
            bracketed_key = f"[{key}]"
            
            # Helper to check if a value is actually another key in metadata
            def _resolve_pointer(v):
                if isinstance(v, str) and (v in metadata or v in session_data):
                    return str(metadata.get(v) or session_data.get(v))
                return str(v)

            # A. Check explicit mappings (e.g. "[POS Amount]" -> "balance")
            mapped_key = mappings.get(bracketed_key) or mappings.get(key)
            if mapped_key:
                val = metadata.get(mapped_key) or session_data.get(mapped_key)
                if val is not None: return _resolve_pointer(val)
                
            # B. Check direct metadata/session_data (exact, bracketed, and snake_case)
            val = metadata.get(bracketed_key) or session_data.get(bracketed_key) or \
                  metadata.get(key) or session_data.get(key)
            if val is not None: return _resolve_pointer(val)
            
            # C. Check snake_case variant
            sc_key = key.lower().replace(" ", "_").replace("-", "_")
            val = metadata.get(sc_key) or session_data.get(sc_key)
            if val is not None: return _resolve_pointer(val)
            
            # D. Check bot config defaults
            val = defaults.get(bracketed_key) or defaults.get(key) or \
                  defaults.get(sc_key) or bot_cfg.get(sc_key)
            if val is not None: return _resolve_pointer(val)
            
            # E. Fallback to the original tag if nothing found
            return match.group(0)
            
        return pattern.sub(_repl, text)

    async def evaluate(self, user_text: str) -> bool:
        """Process one user turn using the dynamic engine."""
        if not self.current_node_id or self.current_node_id not in self.nodes:
            return True

        user_text = user_text.strip()
        if user_text:
            # 1. Global Interceptors (Disconnect/Escalate)
            global_intent = await self._check_global_interceptor(user_text)
            if global_intent in ("DISCONNECT", "ESCALATE"):
                key = "disconnect" if global_intent == "DISCONNECT" else "escalation"
                await self._log("[GLOBAL]", f"User: {global_intent}", "text-red-400")
                await self.brain._generate_and_speak(self._resolve_farewell(key))
                
                if global_intent == "DISCONNECT":
                    self.brain.request_voice_session_end("user_disconnect")
                else:
                    await self._handle_escalation()
                return False

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
            edges = self._get_outgoing_edges(self.current_node_id)
            if not edges:
                self.current_node_id = None
                return True
            
            self.last_user_text = user_text
            
            # Smart Guard: If user says "No/Can't" but we only have a "Success" path, block it.
            if len(edges) == 1:
                # Single-Edge Rescue: If the edge is unlabeled, it's a "Continue" gate. No classification needed.
                lbl = (edges[0].get("label") or edges[0].get("sourceHandle") or "").lower()
                if not lbl or lbl == "next":
                    self.current_node_id = edges[0].get("target")
                    return await self._execute_node_chain(user_text)

                # Otherwise, strict validation
                sentiment = await self._classify_sentiment(user_text)
                if sentiment == "negative" and "yes" not in lbl:
                    await self._log("[ENGINE]", "Refusal detected on single-edge input. Backtracking for logic re-evaluation.", "text-red-400")
                    if await self._handle_backtrack(None):
                        return await self._execute_node_chain(user_text)
                    return True # Yield if we can't backtrack safely
                
                # If user says something irrelevant like "hello", stay here rather than jumping
                selected = await self._classify_intent(user_text, [lbl])
                if selected == "NONE":
                    await self._handle_reprompt(user_text)
                    return True # PAUSE and wait for new user input after reprompt

                self.current_node_id = edges[0].get("target")
            else:
                labels = [e.get("label") or e.get("sourceHandle") or "next" for e in edges]
                selected = await self._classify_intent(user_text, labels)
                self.last_intent = selected # Capture for UI debugging
                
                # Intelligence Update: If NO match found, stay on node and re-prompt!
                if selected == "NONE":
                    await self._log("[ENGINE]", f"Ambiguous input: '{user_text}'. Providing clarification.", "text-amber-400")
                    await self._handle_reprompt(user_text)
                    return True # PAUSE and wait for new user input after reprompt
                
                target_id = next((e.get("target") for e in edges if (e.get("label") or "").lower() == selected.lower()), None)
                if not target_id:
                    await self._handle_reprompt(user_text)
                    return True # PAUSE and wait

                self.current_node_id = target_id

        return await self._execute_node_chain(user_text)

    def _resolve_farewell(self, key: str) -> str:
        """Get farewell/escalation message from bot config."""
        bot_cfg = getattr(self.brain, "_bot_config", {}) or {}
        return bot_cfg.get(f"{key}_message") or "I understand. Thank you."

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
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(escalate_url, json={
                        "session_id": session_id,
                        "user_id": user_id,
                        "reason": "user_requested_escalation",
                        "transcript": transcript_text,
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

            # 1. Explicit bot-level override
            provider = bot_cfg.get("classifier_llm_provider") or getattr(_s, "classifier_llm_provider", "")
            model    = bot_cfg.get("classifier_llm_model")    or getattr(_s, "classifier_llm_model", "")

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
        """Detect disconnect / escalation intent via dynamic patterns or cheap LLM."""
        # 1. Fast-path regex (dynamic from config)
        if (p := self.intent_patterns.get("disconnect")) and p.search(text):
            return "DISCONNECT"
        if (p := self.intent_patterns.get("escalate")) and p.search(text):
            return "ESCALATE"

        # 2. Heuristic check: short utterances are rarely global intents
        if len(text.split()) <= 4:
            return "CONTINUE"

        # 3. LLM classification fallback
        try:
            prompt = PROMPT_TEMPLATES["global_intent"].format(text=text)
            response = await self._classifier_complete(
                "You are a strict intent classifier. Reply only with: DISCONNECT, ESCALATE, or CONTINUE.",
                prompt,
            )
            response = response.upper()
            if "DISCONNECT" in response: return "DISCONNECT"
            if "ESCALATE" in response: return "ESCALATE"
            return "CONTINUE"
        except Exception as e:
            logger.error("[WorkflowEngine] Global interceptor error: %s", e)
            return "CONTINUE"

    async def _classify_intent(self, text: str, options: list[str]) -> str:
        """Map user input to one of the provided labels or 'NONE' if ambiguous."""
        text_lower = text.lower()
        
        # Fast path for very short turns
        if len(text_lower.split()) < 3:
            for opt in options:
                if opt.lower() in text_lower:
                    return opt

        ops_str = ", ".join([f'"{opt}"' for opt in options])
        try:
            prompt = (
                f"User said: \"{text}\"\n"
                f"Available Intents: {ops_str}, \"NONE\"\n\n"
                f"Rule: If the input matches an intent, output only the label. "
                f"If the input is irrelevant, a greeting like 'hello', or completely unrelated to the options, output \"NONE\"."
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
        base_speech = _node_speech(node)
        
        # Use LLM to generate a smart clarification. 
        # If the user is asking a relevant question (e.g. "What is your bank name?"), 
        # the LLM should answer it first, then re-ask the original question.
        clarification_prompt = (
            f"The user said '{last_input}' while the bot's current objective is: {base_speech}.\n\n"
            f"TASK:\n"
            f"1. If the user is asking a question or seeking information, ANSWER IT briefly and professionally based on your general knowledge. "
            f"If it's just a greeting or off-topic, acknowledge it warmly.\n"
            f"2. Then, RE-ASK the original question to get the workflow back on track.\n\n"
            f"CRITICAL: Keep your total response under 2 sentences. Use natural, conversational voice-suitable language."
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
            await self.brain._generate_and_speak(f"I understand. To continue, {base_speech}")
            self._spoke = True

    async def _classify_sentiment(self, text: str) -> str:
        """Detect base sentiment via dynamic patterns or cheap LLM."""
        pos = self.intent_patterns.get("positive")
        neg = self.intent_patterns.get("negative")
        
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
        Detect language via cheap Groq classifier.
        Short texts default to 'en' without any LLM call.
        """
        if not text or len(text.strip()) < 3:
            return "en"
        # Simple heuristic: if text is entirely ASCII it's almost certainly English
        try:
            text.encode("ascii")
            return "en"
        except UnicodeEncodeError:
            pass  # Non-ASCII → run classifier

        try:
            prompt = (
                f'What language is this text written in?\n'
                f'Reply with a 2-letter ISO 639-1 code only (e.g. en, es, fr, hi, ta).\n\n'
                f'Text: "{text}"'
            )
            result = await self._classifier_complete(
                "You are a language detector. Reply with a 2-letter ISO code only.",
                prompt,
            )
            return result.lower()[:2] or "en"
        except Exception as e:
            logger.error("[WorkflowEngine] Language detection error: %s", e)
            return "en"

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

        prompt = PROMPT_TEMPLATES["dynamic_speech"].format(
            label=label,
            base_text=base_text,
            context_str=context_str,
            last_user_text=last_user_text or "None"
        )

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
        except:
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
            prompt = PROMPT_TEMPLATES["knowledge_grounding"].format(
                text=user_text,
                context=full_context
            )
            
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
                final_output += f" Anyway, going back to what we were discussing: {current_speech}"
            
            await self.brain._generate_and_speak(final_output)
            return True
            
        except Exception as e:
            logger.error("[Knowledge] Error during grounding: %s", e)
            return False

    async def _detect_navigational_intent(self, text: str) -> Optional[dict]:
        """Detect if user wants to jump back, skip, or restart via dynamic regex or cheap LLM."""
        if not text: return None

        # Stage 1: Dynamic Regex lookup
        nav_p = self.intent_patterns.get("navigation")
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

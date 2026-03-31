import json
import re
import asyncio
from typing import Dict, Any, Optional, List
import logging
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("workflow-engine")

# Node type used to signal "hand off to the main LLM" — any unknown type also falls through.
_LLM_FALLBACK_TYPE = "llm_fallback"

# ─── Built-in farewell messages keyed by BCP-47 language code ────────────────
# Each entry: (disconnect_msg, escalation_msg)
_FAREWELL_BY_LANG: dict[str, tuple[str, str]] = {
    "en": (
        "I understand. Hanging up now. Goodbye!",
        "Please wait while I connect you with a team member who can assist you.",
    ),
    "hi": (
        "समझ गया। अभी कॉल समाप्त कर रहा हूँ। अलविदा!",
        "कृपया प्रतीक्षा करें, मैं आपको एक सहायक से जोड़ रहा हूँ।",
    )
}
_FAREWELL_DEFAULT_LANG = "en"


def _resolve_farewell(brain, key: str) -> str:
    """
    Return the right farewell/escalation message for the current session.

    Resolution order:
      1. bot_config["disconnect_messages"][lang]  /  bot_config["escalation_messages"][lang]
      2. bot_config["disconnect_message"]          /  bot_config["escalation_message"]
      3. Built-in translation for detected_language (falls back to English)

    ``key`` must be either ``"disconnect"`` or ``"escalation"``.
    """
    lang = (getattr(brain.session, "detected_language", None) or _FAREWELL_DEFAULT_LANG).lower()
    bot_cfg: dict = getattr(brain, "_bot_config", {}) or {}

    # 1. Per-language override dict in bot_config
    lang_map = bot_cfg.get(f"{key}_messages") or {}
    if isinstance(lang_map, dict):
        msg = lang_map.get(lang) or lang_map.get(_FAREWELL_DEFAULT_LANG)
        if msg:
            return str(msg)

    # 2. Single-message override in bot_config (language-agnostic, set by operator)
    single = bot_cfg.get(f"{key}_message")
    if single:
        return str(single)

    # 3. Built-in translation
    pair = _FAREWELL_BY_LANG.get(lang) or _FAREWELL_BY_LANG[_FAREWELL_DEFAULT_LANG]
    return pair[0] if key == "disconnect" else pair[1]

# Canonical type aliases: both the React Flow UI types and legacy backend types are accepted
_TYPE_NORMALISE = {
    # Speech / Bot output
    "bot-says":  "speech",
    "speech":    "speech",
    # User input / listen
    "user-input":  "userInput",
    "userInput":   "userInput",
    # Conditional branching
    "smart-branch": "logic",
    "logic":        "logic",
    # Sentiment analysis
    "sentiment":    "sentiment",
    # Language detection
    "language":     "language",
    # Loop-back
    "backtrack":    "backtrack",
    # System / external action
    "action":       "action",
    # RAG knowledge lookup
    "knowledge":    "knowledge",
}

def _norm_type(raw: str) -> str:
    return _TYPE_NORMALISE.get(raw, raw)


# ─── Fast rule-based patterns (no LLM cost) ──────────────────────────────────
# Covers EN + HI keywords; LLM fallback only fires for ambiguous cases.
_DISCONNECT_RE = re.compile(
    r'\b(bye|goodbye|hang up|end call|disconnect|quit|exit|stop|close|finish|done|'
    r'bandh|alvida|band karo|khatam|rukna|jane do|chodna|chodo)\b',
    re.I | re.UNICODE,
)
_ESCALATE_RE = re.compile(
    r'\b(human|agent|manager|supervisor|transfer|escalate|representative|operator|'
    r'insaan|manushya|adhikari|senior|vyakti se baat|insaan se baat)\b',
    re.I | re.UNICODE,
)
# Sentiment word lists (avoids LLM call for clear-cut cases)
_POSITIVE_RE = re.compile(
    r'\b(great|good|thanks|thank you|awesome|perfect|excellent|happy|yes|okay|ok|'
    r'sure|wonderful|love|nice|dhanyawad|shukriya|accha|theek|bilkul|haan)\b',
    re.I | re.UNICODE,
)
_NEGATIVE_RE = re.compile(
    r'\b(bad|terrible|awful|angry|upset|frustrated|no|never|hate|horrible|worst|'
    r'bura|bura laga|nahi|nahin|galat|problem|issue|complaint|complaint)\b',
    re.I | re.UNICODE,
)
# Navigation intent — only bother with LLM when the user mentions a backward/skip keyword.
# Saves a main-LLM call on every normal conversational turn.
_NAV_RE = re.compile(
    r'\b(go back|back|pichhe|restart|start over|skip|change|update|wapas|dobara|'
    r'phir se|previous|last step|redo|cancel that|correction|correct that|mujhe wapas)\b',
    re.I | re.UNICODE,
)


def _node_speech(node: dict) -> str:
    """Extract the bot's speech text from any node format."""
    # React Flow format: node.data.speech  or  node.data.message
    data = node.get("data") or {}
    # Legacy backend format: node.config.message
    config = node.get("config") or {}
    return (
        data.get("speech")
        or data.get("message")
        or config.get("message")
        or config.get("speech")
        or ""
    )


def _node_intents(node: dict) -> List[str]:
    """Extract expected intents/options from a userInput or logic node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return data.get("intents") or config.get("intents") or []


def _node_action_type(node: dict) -> str:
    """Return the action type (sms / email / webhook) from an action node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return data.get("actionType") or config.get("actionType") or config.get("action_name") or "action"


def _node_knowledge_query(node: dict) -> str:
    """Return the knowledge search query from a knowledge node."""
    data = node.get("data") or {}
    config = node.get("config") or {}
    return data.get("query") or config.get("query") or ""


class WorkflowEngine:
    """
    Stateful, node-graph conversational engine.

    Accepts both React Flow node format (with `position` + `data` fields) and
    the simpler backend-only format (`config` field, no `position`). The node
    type aliases table `_TYPE_NORMALISE` maps all known variants to canonical
    type strings that the `_execute_node_chain` switch handles.
    """

    def __init__(self, brain, workflow_data: dict):
        self.brain = brain
        self.nodes = {n['id']: n for n in workflow_data.get('nodes', [])}
        self.edges = workflow_data.get('edges', [])

        # Build adjacency list: node_id -> [ edge_dict ]
        self.adjacency: Dict[str, List[dict]] = {}
        for edge in self.edges:
            src = edge.get("source")
            if src not in self.adjacency:
                self.adjacency[src] = []
            self.adjacency[src].append(edge)

        self.current_node_id: Optional[str] = workflow_data.get("start_node_id")

        # --- Advanced State Management ---
        self.history: List[str] = [] # Stack of visited node IDs
        self.session_data: Dict[str, Any] = {} # Extracted entities / user data
        self.last_user_text: str = ""

        # Auto-detect start node: node with no incoming edges
        if not self.current_node_id and self.nodes:
            targets = {e.get("target") for e in self.edges}
            root_candidates = [n for n in self.nodes.keys() if n not in targets]
            self.current_node_id = root_candidates[0] if root_candidates else list(self.nodes.keys())[0]

        logger.info("[WorkflowEngine] Initialized. Start node: %s | Total nodes: %d | Total edges: %d",
                    self.current_node_id, len(self.nodes), len(self.edges))

        # Cached classifier LLM — initialized once, reused on every turn.
        # Prevents "Groq Provider initialized" spam in logs and the ~10ms GC
        # cost of constructing a new provider object per turn.
        self._classifier_llm = None

    def _get_outgoing_edges(self, node_id: str) -> List[dict]:
        return self.adjacency.get(node_id, [])

    async def evaluate(self, user_text: str) -> bool:
        """
        Process one user turn.
        Returns False if the engine handled the turn fully.
        Returns True if LLM free-form fallback is needed.
        """
        if not self.current_node_id or self.current_node_id not in self.nodes:
            logger.warning("[WorkflowEngine] No valid current node. Falling back to LLM.")
            return True

        # ─── Global pre-flight interceptors ────────────────────────────────────
        user_text = user_text.strip()
        if user_text:
            global_intent = await self._check_global_interceptor(user_text)
            if global_intent == "DISCONNECT":
                await self._log("[GLOBAL]", "User requested disconnect.", "text-red-400")
                # Speak the farewell first so TTS fully completes before the
                # session teardown is triggered.
                await self.brain._generate_and_speak(_resolve_farewell(self.brain, "disconnect"))
                self.brain.request_voice_session_end("user_disconnect")
                return False
            elif global_intent == "ESCALATE":
                await self._log("[GLOBAL]", "User requested escalation to human.", "text-orange-400")
                await self._handle_escalation()
                return False

            # --- Advanced: Detect Navigational Intent (Reversibility) ---
            nav_intent = await self._detect_navigational_intent(user_text)
            if nav_intent and nav_intent.get("action") == "BACKTRACK":
                target_label = nav_intent.get("target_label")
                if await self._handle_backtrack(target_label):
                    # Resume from the new backtrack target
                    return await self._execute_node_chain(user_text)

        # ─── If we're paused on a userInput node, advance past it first ────────
        node = self.nodes[self.current_node_id]
        node_type = _norm_type(node.get("type", ""))
        logger.info("[WorkflowEngine] Current node: %s (%s → %s)", self.current_node_id, node.get("type"), node_type)

        if user_text and node_type == "userInput":
            edges = self._get_outgoing_edges(self.current_node_id)
            if not edges:
                logger.warning("[WorkflowEngine] userInput node %s has no outgoing edges. Clearing state to fallback.", self.current_node_id)
                self.current_node_id = None
                return True
            
            # Record text for dynamic nodes to use
            self.last_user_text = user_text
            
            # If multiple edges, use the logic classifier to pick the best next node BEFORE entering the chain
            if len(edges) > 1:
                intents = _node_intents(node)
                labels = [e.get("label") or e.get("sourceHandle") or "next" for e in edges]
                all_options = list(set([l for l in labels + intents if l]))
                
                selected = await self._classify_intent(user_text, all_options)
                await self._log("[WORKFLOW]", f"User input branched → {selected}", "text-primary")
                
                target_id = None
                for e in edges:
                    lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
                    if lbl and lbl in selected.lower():
                        target_id = e.get("target")
                        break
                self.current_node_id = target_id or edges[0].get("target")
            else:
                # Normal linear flow
                self.current_node_id = edges[0].get("target")

        # ─── Execute the node chain until we hit a blocking node ───────────────
        yield_to_llm = await self._execute_node_chain(user_text)
        return yield_to_llm

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
            for turn in self.brain.session.get_context_window(max_turns=10):
                transcript_lines.append(f"{turn['role'].capitalize()}: {turn['content']}")
        except Exception:
            pass
        transcript_text = "\n".join(transcript_lines)

        if escalate_url:
            try:
                import httpx
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

        await self.brain._generate_and_speak(_resolve_farewell(self.brain, "escalation"))
        self.brain.request_voice_session_end("escalated")

    async def _execute_node_chain(self, user_text: str = "") -> bool:
        """
        Walk the graph executing deterministic nodes until a blocking point.
        Returns True if the caller should yield to the main LLM (free-form fallback).
        Returns False if the workflow fully handled the turn.
        """
        max_hops = 20  # Safety guard against infinite loops
        hops = 0
        _spoke = False  # tracks whether any speech node emitted audio this chain

        while self.current_node_id and self.current_node_id in self.nodes and hops < max_hops:
            hops += 1
            node = self.nodes[self.current_node_id]
            raw_type = node.get("type", "")
            node_type = _norm_type(raw_type)
            edges = self._get_outgoing_edges(self.current_node_id)

            await self._log("[WORKFLOW]", f"Executing {raw_type}→{node_type} node '{self.current_node_id}'", "text-purple-400")
            logger.debug("[WorkflowEngine] Executing node %s (%s) — %d outgoing edges", self.current_node_id, node_type, len(edges))

            # ── Bot Says ────────────────────────────────────────────────────────
            if node_type == "speech":
                data = node.get("data") or {}
                mode = data.get("mode", "direct") # direct | llm
                text = _node_speech(node)

                if mode == "llm":
                    text = await self._generate_dynamic_speech(node, user_text)

                if text:
                    await self.brain._generate_and_speak(text)
                else:
                    logger.warning("[WorkflowEngine] Speech node %s has no text configured.", self.current_node_id)
                    await self.brain._generate_and_speak("...")
                _spoke = True

                # Record visit in history
                if self.current_node_id not in self.history:
                    self.history.append(self.current_node_id)

                if edges:
                    target_id = edges[0].get("target")
                    next_node = self.nodes.get(target_id)
                    # If the next node is a userInput, move there and pause
                    if next_node and _norm_type(next_node.get("type", "")) == "userInput":
                        self.current_node_id = target_id
                        break
                    self.current_node_id = target_id
                    # Continue loop to execute next node immediately
                else:
                    self.current_node_id = None
                    break

            # ── User Input (wait for next turn) ─────────────────────────────────
            elif node_type == "userInput":
                break  # Pause here — will resume on next evaluate() call

            # ── Smart Branch / Logic ─────────────────────────────────────────────
            elif node_type == "logic":
                if not edges:
                    logger.warning("[WorkflowEngine] Logic node %s has no outgoing edges. Falling back to LLM.", self.current_node_id)
                    self.current_node_id = None
                    return True # Yield to LLM so the turn doesn't die silently
                # Use edge labels (Yes/No) or classify with LLM
                intents = _node_intents(node)
                edge_labels = [e.get("label") or e.get("sourceHandle") or "" for e in edges]
                all_options = list(set([l for l in edge_labels + intents if l]))

                if all_options:
                    selected = await self._classify_intent(user_text, all_options)
                    await self._log("[WORKFLOW]", f"Logic branch → {selected}", "text-primary")
                else:
                    selected = None

                # Find matching target edge
                target_id = None
                for e in edges:
                    lbl = (e.get("label") or e.get("sourceHandle") or "").lower()
                    if selected and lbl and lbl in selected.lower():
                        target_id = e.get("target")
                        break
                if not target_id:
                    target_id = edges[0].get("target")  # fallback

                self.current_node_id = target_id

            # ── Sentiment Analysis ───────────────────────────────────────────────
            elif node_type == "sentiment":
                if not edges:
                    logger.warning("[WorkflowEngine] Sentiment node %s has no outgoing edges. Falling back to LLM.", self.current_node_id)
                    self.current_node_id = None
                    return True
                sentiment = await self._classify_sentiment(user_text)
                await self._log("[WORKFLOW]", f"Sentiment detected: {sentiment}", "text-emerald-400")

                # Route based on positive/neutral/negative handle IDs
                target_id = None
                for e in edges:
                    handle = (e.get("sourceHandle") or e.get("label") or "").lower()
                    if handle and handle in sentiment.lower():
                        target_id = e.get("target")
                        break
                if not target_id:
                    # Pick neutral by preference, otherwise fallback to first
                    for e in edges:
                        if "neutral" in (e.get("sourceHandle") or "").lower():
                            target_id = e.get("target")
                            break
                    if not target_id:
                        target_id = edges[0].get("target")

                self.current_node_id = target_id

            # ── Language Detection ───────────────────────────────────────────────
            elif node_type == "language":
                language = await self._detect_language(user_text)
                await self._log("[WORKFLOW]", f"Language detected: {language}", "text-blue-400")
                # Just pass through to the next node for now
                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    logger.warning("[WorkflowEngine] Language node %s has no outgoing edges. Falling back to LLM.", self.current_node_id)
                    self.current_node_id = None
                    return True

            # ── Backtrack ────────────────────────────────────────────────────────
            elif node_type == "backtrack":
                await self._log("[WORKFLOW]", "Backtracking in conversation flow.", "text-purple-300")
                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                break

            # ── System Action (SMS / Email / Webhook) ────────────────────────────
            elif node_type == "action":
                action_type = _node_action_type(node)
                data = node.get("data") or node.get("config") or {}
                label = (node.get("data") or {}).get("label") or action_type

                await self._log("[WORKFLOW]", f"Executing action: {action_type} — {label}", "text-amber-400")
                logger.info("[WorkflowEngine] Action node fired: type=%s data=%s", action_type, data)

                bot_config = getattr(self.brain, "_bot_config", {})
                session_id = self.brain.session.session_id

                if action_type == "webhook":
                    # Real HTTP POST to configured webhook URL
                    webhook_url = (
                        data.get("webhookUrl")
                        or data.get("url")
                        or bot_config.get("actions_webhook_url", "")
                    )
                    if webhook_url:
                        try:
                            import httpx
                            payload = {
                                "action": label,
                                "session_id": session_id,
                                "user_id": self.brain.session.user_id,
                                "data": data,
                            }
                            async with httpx.AsyncClient(timeout=8.0) as _hc:
                                resp = await _hc.post(webhook_url, json=payload)
                            await self._log(
                                "[WORKFLOW]",
                                f"Webhook {webhook_url} → HTTP {resp.status_code}",
                                "text-amber-300",
                            )
                        except Exception as wh_err:
                            logger.warning("[WorkflowEngine] Webhook call failed: %s", wh_err)
                    else:
                        await self._log("[WORKFLOW]", "Webhook node: no URL configured.", "text-red-400")

                elif action_type in ("sms", "email"):
                    # Forward to a configured actions webhook (which owns the Twilio/SendGrid creds)
                    actions_url = bot_config.get("actions_webhook_url", "")
                    spoken_msg = data.get("speech") or data.get("message") or (
                        "I've sent a payment link to your registered mobile number. Please check your SMS."
                        if action_type == "sms"
                        else "I've sent a summary email to your registered email address."
                    )
                    if actions_url:
                        try:
                            import httpx
                            async with httpx.AsyncClient(timeout=8.0) as _hc:
                                await _hc.post(actions_url, json={
                                    "action_type": action_type,
                                    "session_id": session_id,
                                    "user_id": self.brain.session.user_id,
                                    "data": data,
                                })
                        except Exception as act_err:
                            logger.warning("[WorkflowEngine] Action webhook failed: %s", act_err)
                    await self.brain._generate_and_speak(spoken_msg)

                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                break  # Yield after action

            # ── Knowledge Base ───────────────────────────────────────────────────
            elif node_type == "knowledge":
                query = _node_knowledge_query(node)
                await self._log("[WORKFLOW]", f"RAG lookup: '{query}'", "text-indigo-400")

                try:
                    results = await self.brain.db.search_knowledge(query, limit=2)
                    if results:
                        answer = results[0].get("answer", "")
                        if answer:
                            await self.brain._generate_and_speak(answer)
                    else:
                        await self.brain._generate_and_speak(
                            "I don't have specific information about that, but I can connect you with our team."
                        )
                except Exception as e:
                    logger.warning("[WorkflowEngine] Knowledge lookup failed: %s", e)
                    await self.brain._generate_and_speak(
                        "Let me try to find that information. You can also visit our website for more details."
                    )

                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                break

            # ── LLM Fallback ─────────────────────────────────────────────────────
            elif node_type == _LLM_FALLBACK_TYPE:
                await self._log("[WORKFLOW]", "LLM fallback node reached — yielding to agentic LLM.", "text-indigo-400")
                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                return True  # Signal: hand off to the main LLM

            # ── Unknown — yield to LLM rather than silently skip ─────────────────
            else:
                logger.warning("[WorkflowEngine] Unhandled node type '%s' — yielding to LLM.", raw_type)
                if edges:
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                return True  # Unknown node type → let LLM handle it

        if hops >= max_hops:
            logger.error("[WorkflowEngine] Max hop limit reached — possible loop in graph.")

        # If the workflow ran (at least one hop) but never emitted any speech —
        # e.g. userInput → userInput with no speech node between them — fall
        # through to the main LLM so the user gets an audio response.
        if hops > 0 and not _spoke:
            logger.warning(
                "[WorkflowEngine] Chain ran %d hop(s) but generated no speech — yielding to LLM.",
                hops,
            )
            return True

        return False  # Workflow handled the turn fully

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
                self._classifier_llm = GroqStreamingProvider(model=_s.groq_model or "llama-3.3-70b-versatile")
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
        """
        Detect disconnect / escalation intent.

        Stage 1 — regex (free, ~0ms): catches 95%+ of cases.
        Stage 2 — cheap Groq classifier (only for ambiguous input).
        """
        if _DISCONNECT_RE.search(text):
            return "DISCONNECT"
        if _ESCALATE_RE.search(text):
            return "ESCALATE"

        # Short utterances (≤4 words) are almost never disconnect/escalate —
        # skip the LLM entirely.  For longer sentences, call the cheap Groq
        # classifier only when the regex gave no clear signal.
        if len(text.split()) <= 4:
            return "CONTINUE"

        try:
            prompt = (
                f'Does this voice transcript show:\n'
                f'- User wants to hang up / end the call? → reply: DISCONNECT\n'
                f'- User wants a human agent/manager? → reply: ESCALATE\n'
                f'- Normal response? → reply: CONTINUE\n\n'
                f'Reply STRICTLY with ONE word.\n\nTranscript: "{text}"'
            )
            response = await self._classifier_complete(
                "You are a strict intent classifier. Reply only with: DISCONNECT, ESCALATE, or CONTINUE.",
                prompt,
            )
            response = response.upper()
            if "DISCONNECT" in response:
                return "DISCONNECT"
            if "ESCALATE" in response:
                return "ESCALATE"
            return "CONTINUE"
        except Exception as e:
            logger.error("[WorkflowEngine] Global interceptor error: %s", e)
            return "CONTINUE"

    async def _classify_intent(self, text: str, options: List[str]) -> str:
        """
        Map user input to one of the provided workflow edge labels.

        Stage 1 — substring match (free): if the text contains an option label verbatim.
        Stage 2 — cheap Groq classifier.
        """
        text_lower = text.lower()
        for opt in options:
            if opt.lower() in text_lower:
                return opt

        ops_str = ", ".join([f'"{opt}"' for opt in options])
        try:
            prompt = (
                f'Classify the following user input into EXACTLY ONE of: [{ops_str}].\n'
                f'Reply with the exact label only.\n\n'
                f'User Input: "{text}"'
            )
            response = await self._classifier_complete(
                "You are an intent classifier. Output exactly the label and nothing else.",
                prompt,
            )
            for opt in options:
                if opt.lower() in response.lower():
                    return opt
            return options[0]
        except Exception as e:
            logger.error("[WorkflowEngine] Intent classification error: %s", e)
            return options[0]

    async def _classify_sentiment(self, text: str) -> str:
        """
        Detect sentiment: positive / neutral / negative.

        Stage 1 — keyword regex (free).
        Stage 2 — cheap Groq classifier for ambiguous input.
        """
        if _POSITIVE_RE.search(text) and not _NEGATIVE_RE.search(text):
            return "positive"
        if _NEGATIVE_RE.search(text) and not _POSITIVE_RE.search(text):
            return "negative"

        # Short texts with no signal → neutral (no LLM call)
        if len(text.split()) <= 3:
            return "neutral"

        try:
            prompt = (
                f'What is the sentiment of this response?\n'
                f'Reply with exactly one word: positive, neutral, or negative.\n\n'
                f'Text: "{text}"'
            )
            response = await self._classifier_complete(
                "You are a sentiment classifier. Reply only with: positive, neutral, or negative.",
                prompt,
            )
            response = response.lower()
            if "positive" in response:
                return "positive"
            if "negative" in response:
                return "negative"
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
        
        # Build context from previous turns
        context_str = ""
        try:
            turns = self.brain.session.get_context_window(max_turns=6)
            context_str = "\n".join([f"{t['role'].capitalize()}: {t['content']}" for t in turns])
        except Exception:
            pass

        prompt = (
            f"You are a sophisticated AI voice bot. Your current workflow step is: {label}.\n"
            f"Base Instruction: {base_text}\n\n"
            f"Context from conversation:\n{context_str}\n\n"
            f"Recent User Input: {last_user_text}\n\n"
            "Your Task: Generate a warm, professional response that fulfills the bridge between the conversation context and the workflow goal.\n"
            "Keep it concise (1-2 sentences) and suitable for high-quality voice synthesis.\n"
            "If the user mentioned specific details (e.g., their name, a date), acknowledge them naturally."
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

    async def _detect_navigational_intent(self, text: str) -> Optional[dict]:
        """
        Detect if user wants to jump back, skip, or restart.

        Stage 1 — fast-path: if the text is short or contains no navigation
        keywords at all, return None immediately with zero LLM cost.
        Stage 2 — cheap classifier (Groq via _classifier_complete), NOT the main LLM.
        """
        if not text or len(text.split()) < 3:
            return None

        # Skip the LLM entirely when there are no navigation-flavoured words.
        # This saves a main-LLM call on every normal conversational turn.
        if not _NAV_RE.search(text):
            return None

        # Require at least 6 words to avoid short phrases like "wapas" alone
        # triggering a JSON classification call.
        if len(text.split()) < 6:
            return None

        prompt = (
            "Analyze the user's voice transcript for 'navigational' intent.\n"
            "Does the user want to:\n"
            "1. Go back to a previous topic or step? (e.g., 'Wait, go back to the start', 'Can we change the payment date?')\n"
            "2. Skip a step?\n"
            "3. Restart the call?\n\n"
            "Reply with a JSON object:\n"
            '{"action": "BACKTRACK" | "SKIP" | "RESTART" | "CONTINUE", "target_label": "the name of the step or topic mentioned", "reason": "..."}'
            f'\n\nTranscript: "{text}"'
        )

        try:
            resp = await self._classifier_complete(
                "You are a navigation intent detector. Reply ONLY with valid JSON.",
                prompt,
            )
            # Strip markdown fences if the model adds them
            if resp.startswith("```"):
                resp = resp.split("```")[1]
            if resp.startswith("json"):
                resp = resp[4:]
            data = json.loads(resp)
            if data.get("action") == "CONTINUE":
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

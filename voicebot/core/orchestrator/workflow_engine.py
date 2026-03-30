import json
import asyncio
from typing import Dict, Any, Optional, List
import logging
from voicebot.shared.logging.logger import setup_logger

logger = setup_logger("workflow-engine")

# Node type used to signal "hand off to the main LLM" — any unknown type also falls through.
_LLM_FALLBACK_TYPE = "llm_fallback"

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

        # Auto-detect start node: node with no incoming edges
        if not self.current_node_id and self.nodes:
            targets = {e.get("target") for e in self.edges}
            root_candidates = [n for n in self.nodes.keys() if n not in targets]
            self.current_node_id = root_candidates[0] if root_candidates else list(self.nodes.keys())[0]

        logger.info("[WorkflowEngine] Initialized. Start node: %s | Total nodes: %d | Total edges: %d",
                    self.current_node_id, len(self.nodes), len(self.edges))

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
                self.brain.request_voice_session_end("user_disconnect")
                await self.brain._generate_and_speak("I understand. Hanging up now. Goodbye.")
                return False
            elif global_intent == "ESCALATE":
                await self._log("[GLOBAL]", "User requested escalation to human.", "text-orange-400")
                await self._handle_escalation()
                return False

        # ─── If we're paused on a userInput node, advance past it first ────────
        node = self.nodes[self.current_node_id]
        node_type = _norm_type(node.get("type", ""))
        logger.info("[WorkflowEngine] Current node: %s (%s → %s)", self.current_node_id, node.get("type"), node_type)

        if user_text and node_type == "userInput":
            edges = self._get_outgoing_edges(self.current_node_id)
            if not edges:
                logger.warning("[WorkflowEngine] userInput node %s has no outgoing edges.", self.current_node_id)
                self.current_node_id = None
                return True
            # Move to next node; the chain will handle routing/classification
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

        await self.brain._generate_and_speak(
            "Please wait while I connect you with a team member who can assist you."
        )
        self.brain.request_voice_session_end("escalated")

    async def _execute_node_chain(self, user_text: str = "") -> bool:
        """
        Walk the graph executing deterministic nodes until a blocking point.
        Returns True if the caller should yield to the main LLM (free-form fallback).
        Returns False if the workflow fully handled the turn.
        """
        max_hops = 20  # Safety guard against infinite loops
        hops = 0

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
                text = _node_speech(node)
                if text:
                    await self.brain._generate_and_speak(text)
                else:
                    logger.warning("[WorkflowEngine] Speech node %s has no text configured.", self.current_node_id)
                    await self.brain._generate_and_speak("...")

                if edges:
                    next_node = self.nodes.get(edges[0].get("target"))
                    # If the next node is a userInput, move there and pause
                    if next_node and _norm_type(next_node.get("type", "")) == "userInput":
                        self.current_node_id = edges[0].get("target")
                        break
                    self.current_node_id = edges[0].get("target")
                else:
                    self.current_node_id = None
                break  # Yield after bot speaks

            # ── User Input (wait for next turn) ─────────────────────────────────
            elif node_type == "userInput":
                break  # Pause here — will resume on next evaluate() call

            # ── Smart Branch / Logic ─────────────────────────────────────────────
            elif node_type == "logic":
                if not edges:
                    logger.warning("[WorkflowEngine] Logic node %s has no outgoing edges.", self.current_node_id)
                    self.current_node_id = None
                    break
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
                    self.current_node_id = None
                    break
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
                    self.current_node_id = None

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

        return False  # Workflow handled the turn fully

    async def _log(self, tag: str, msg: str, color: str = "text-outline"):
        try:
            await self.brain._log_event(tag, msg, color)
        except Exception:
            pass

    async def _check_global_interceptor(self, text: str) -> str:
        """Fast LLM pre-flight: detect disconnect or escalation intent."""
        prompt = (
            f'Does this voice transcript show:\n'
            f'- User wants to hang up / end the call? → reply: DISCONNECT\n'
            f'- User wants a human agent/manager? → reply: ESCALATE\n'
            f'- Normal response? → reply: CONTINUE\n\n'
            f'Reply STRICTLY with ONE word.\n\nTranscript: "{text}"'
        )
        try:
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are a strict intent classifier. Reply only with: DISCONNECT, ESCALATE, or CONTINUE.",
                messages=[{"role": "user", "content": prompt}]
            ):
                chunks.append(chunk.content or "")
            response = "".join(chunks).strip().upper()
            if "DISCONNECT" in response:
                return "DISCONNECT"
            if "ESCALATE" in response:
                return "ESCALATE"
            return "CONTINUE"
        except Exception as e:
            logger.error("[WorkflowEngine] Global interceptor error: %s", e)
            return "CONTINUE"

    async def _classify_intent(self, text: str, options: List[str]) -> str:
        """LLM intent classifier — returns one of the provided option labels."""
        ops_str = ", ".join([f'"{opt}"' for opt in options])
        prompt = (
            f'Classify the following user input into EXACTLY ONE of: [{ops_str}].\n'
            f'Reply with the exact label only.\n\n'
            f'User Input: "{text}"'
        )
        try:
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are an intent classifier. Output exactly the label and nothing else.",
                messages=[{"role": "user", "content": prompt}]
            ):
                chunks.append(chunk.content or "")
            response = "".join(chunks).strip()
            for opt in options:
                if opt.lower() in response.lower():
                    return opt
            return options[0]
        except Exception as e:
            logger.error("[WorkflowEngine] Intent classification error: %s", e)
            return options[0]

    async def _classify_sentiment(self, text: str) -> str:
        """Fast sentiment detection → positive / neutral / negative."""
        prompt = (
            f'What is the sentiment of this response?\n'
            f'Reply with exactly one word: positive, neutral, or negative.\n\n'
            f'Text: "{text}"'
        )
        try:
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are a sentiment classifier. Reply only with: positive, neutral, or negative.",
                messages=[{"role": "user", "content": prompt}]
            ):
                chunks.append(chunk.content or "")
            response = "".join(chunks).strip().lower()
            if "positive" in response:
                return "positive"
            if "negative" in response:
                return "negative"
            return "neutral"
        except Exception as e:
            logger.error("[WorkflowEngine] Sentiment classification error: %s", e)
            return "neutral"

    async def _detect_language(self, text: str) -> str:
        """Detect language of user text (lightweight LLM call)."""
        if not text or len(text.strip()) < 3:
            return "en"
        prompt = (
            f'What language is this text written in?\n'
            f'Reply with a 2-letter ISO 639-1 code only (e.g. en, es, fr, hi, ta).\n\n'
            f'Text: "{text}"'
        )
        try:
            chunks = []
            async for chunk in self.brain.llm.stream_completion(
                system_prompt="You are a language detector. Reply with a 2-letter ISO code only.",
                messages=[{"role": "user", "content": prompt}]
            ):
                chunks.append(chunk.content or "")
            return "".join(chunks).strip().lower()[:2] or "en"
        except Exception as e:
            logger.error("[WorkflowEngine] Language detection error: %s", e)
            return "en"

import hashlib
from typing import Any, Dict, List
from voicebot.core.tools.base import BaseTool

class SearchKnowledgeTool(BaseTool):
    """
    Tool to search the SQL-based knowledge store.
    """
    @property
    def name(self) -> str:
        return "search_knowledge"

    @property
    def description(self) -> str:
        return "Search the knowledge base to answer questions about the business, services, hours, or policies."

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The question or topic to search for"}
            },
            "required": ["query"]
        }

    async def execute(self, query: str = "", **kwargs) -> str:
        if not self.db:
            return "Knowledge base is not available right now."

        bot_id = kwargs.get("bot_id")
        da = kwargs.get("data_access") or self.data_access_policy

        # ── Redis tool-result cache (24h TTL) ─────────────────────────────────
        # FAQ answers (branch hours, interest rates, policies) are stable for
        # a full day — skip all DB/Chroma/web round-trips on cache hits.
        _redis = getattr(self.brain, "memory", None) if self.brain else None
        _cache_key = (
            f"knowledge:{bot_id}:{hashlib.md5(query.lower().strip().encode()).hexdigest()}"
        )
        if _redis:
            try:
                _hit = await _redis.get_cache(_cache_key)
                if _hit:
                    import logging as _log
                    _log.getLogger("knowledge-search").debug(
                        "knowledge_search Redis cache HIT: bot=%s q='%s'", bot_id, query[:60]
                    )
                    return _hit
            except Exception:
                pass

        # 1. Search SQLite Knowledge Base
        hits = await self.db.search_knowledge(query, bot_id=bot_id, data_access=da)
        local_context = " | ".join(f"{h['topic']}: {h['answer']}" for h in hits) if hits else ""

        # 2. Search Vector Memory (ChromaDB)
        vector_context = ""
        if self.brain and hasattr(self.brain, "_vector_memory") and self.brain._vector_memory:
            v_hits = await self.brain._vector_memory.search_knowledge(query, bot_id=bot_id)
            if v_hits:
                vector_context = " | ".join(h["content"] for h in v_hits)

        combined_context = f"{local_context} {vector_context}".strip()
        if combined_context:
            await self.log_call({"query": query}, combined_context[:200])
            # Write to Redis cache (24h) so future sessions skip DB+Chroma queries.
            if _redis:
                try:
                    await _redis.set_cache(_cache_key, combined_context, ttl=86400)
                except Exception:
                    pass
            return combined_context

        # 3. Web Search Fallback (Self-Driving Mode)
        # Only if on-topic and search provider is available
        if self.brain and self.brain._topic_restriction:
            from voicebot.services.memory.search_provider import SearchProvider
            sp = SearchProvider()

            web_results = await sp.get_web_results(query)
            if web_results:
                summary = await self._summarize_web_results(query, web_results)
                if summary and "no relevant" not in summary.lower():
                    # Store for future use in vector memory and Redis cache
                    if self.brain._vector_memory:
                        await self.brain._vector_memory.store_fact(
                            bot_id=bot_id,
                            fact=summary,
                            source="google_search",
                            category="learned_web"
                        )
                    web_result = f"Based on my latest search: {summary}"
                    if _redis:
                        try:
                            await _redis.set_cache(_cache_key, web_result, ttl=86400)
                        except Exception:
                            pass
                    await self.log_call({"query": query, "source": "web"}, summary[:200])
                    return web_result

        result = "No relevant information found in the knowledge base."
        await self.log_call({"query": query}, result)
        return result

    async def _summarize_web_results(self, query: str, results: list) -> str:
        """Use the brain's LLM to summarize search results."""
        if not self.brain or not self.brain.llm:
            return ""
        
        context = "\n".join([f"- {r['snippet']} (Source: {r['link']})" for r in results])
        prompt = (
            f"User Query: {query}\n\n"
            f"Web Search Results:\n{context}\n\n"
            "Summarize the most relevant information from these results to answer the user's query perfectly. "
            "Be concise, professional, and factual. Use 2-3 sentences max. "
            "If no information is relevant, say 'No relevant information found'."
        )
        
        full_text = ""
        async for chunk in self.brain.llm.stream_completion(
            system_prompt="You are a data summarizer. Extract real facts.",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200
        ):
            full_text += chunk.content or ""
        
        return full_text.strip()

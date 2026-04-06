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
        
        import logging as _log
        _logger = _log.getLogger("knowledge-search")
        _logger.info("\ud83d\udd0e Knowledge Search initiated: query='%s', bot=%s", query, bot_id)
        
        if self.brain and hasattr(self.brain, "_log_event"):
            await self.brain._log_event("[KNOWLEDGE]", f"Searching for: \"{query}\"", "text-blue-400")

        # \u2500\u2500 Redis tool-result cache (24h TTL) \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
        # FAQ answers (branch hours, interest rates, policies) are stable for
        # a full day \u2014 skip all DB/Chroma/web round-trips on cache hits.
        _redis = getattr(self.brain, "memory", None) if self.brain else None
        _cache_key = (
            f"knowledge:{bot_id}:{hashlib.md5(query.lower().strip().encode()).hexdigest()}"
        )
        if _redis:
            try:
                _hit = await _redis.get_cache(_cache_key)
                if _hit:
                    _logger.info("\u2705 Redis cache HIT: bot=%s query='%s'", bot_id, query[:60])
                    if self.brain and hasattr(self.brain, "_log_event"):
                        await self.brain._log_event("[KNOWLEDGE]", "Cache hit \u2014 returning stored answer.", "text-green-400")
                    return _hit
            except Exception:
                pass

        # 1. Search SQLite Knowledge Base (FAQs)
        _logger.info("\ud83d\udcc1 Searching SQLite FAQ table...")
        hits = await self.db.search_knowledge(query, bot_id=bot_id, data_access=da)
        local_context = " | ".join(f"{h['topic']}: {h['answer']} [Source: FAQ]" for h in hits) if hits else ""
        if hits:
            _logger.info("  \u2705 Found %d FAQ matches in SQLite", len(hits))

        # 2. Search Vector Memory (ChromaDB - PDFs, Web, Learned)
        vector_context = ""
        if self.brain and hasattr(self.brain, "_vector_memory") and self.brain._vector_memory:
            _logger.info("\ud83e\udde0 Searching Vector Memory (ChromaDB)...")
            v_hits = await self.brain._vector_memory.search_knowledge(query, bot_id=bot_id)
            if v_hits:
                _logger.info("  \u2705 Found %d semantic matches in Vector DB", len(v_hits))
                # Format: "content [Source: type:filename]"
                parts = []
                for h in v_hits:
                    src = h.get("source", "system")
                    parts.append(f"{h['content']} [Source: {src}]")
                vector_context = " | ".join(parts)
        
        combined_context = f"{local_context} {vector_context}".strip()
        
        if combined_context:
            _logger.info("\ud83c\udfaf Knowledge found. Fetching %d chars of context.", len(combined_context))
            if self.brain and hasattr(self.brain, "_log_event"):
                sources = []
                if local_context: sources.append("FAQ")
                if vector_context: sources.append("Vector DB")
                await self.brain._log_event("[KNOWLEDGE]", f"Sources: {', '.join(sources)}", "text-cyan-400")

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
            _logger.info("\ud83c\udf10 No local info found. Falling back to Web Search...")
            if self.brain and hasattr(self.brain, "_log_event"):
                await self.brain._log_event("[KNOWLEDGE]", "No local info \u2014 performing web search...", "text-yellow-400")

            from voicebot.services.memory.search_provider import SearchProvider
            sp = SearchProvider()

            web_results = await sp.get_web_results(query)
            if web_results:
                summary = await self._summarize_web_results(query, web_results)
                if summary and "no relevant" not in summary.lower():
                    _logger.info("\u2705 Web search successful. Storing fact.")
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

        _logger.warning("\u274c No information found for: %s", query)
        if self.brain and hasattr(self.brain, "_log_event"):
            await self.brain._log_event("[KNOWLEDGE]", "No information found.", "text-red-400")

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

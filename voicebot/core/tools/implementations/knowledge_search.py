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
        hits = await self.db.search_knowledge(query, bot_id=bot_id, data_access=da)
        if hits:
            result = " | ".join(f"{h['topic']}: {h['answer']}" for h in hits)
        else:
            result = "No relevant information found in the knowledge base."
            
        await self.log_call({"query": query}, result)
        return result

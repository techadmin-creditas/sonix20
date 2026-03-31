import httpx
import logging
from typing import List, Dict, Any, Optional
from voicebot.shared.config import get_settings

logger = logging.getLogger("search-provider")
settings = get_settings()

class SerperSearchProvider:
    """
    Search provider using Serper.dev API.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.serper_api_key
        self.url = "https://google.serper.dev/search"

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Execute a search query on Google via Serper.
        Returns a list of results: [{"title": str, "link": str, "snippet": str}, ...]
        """
        if not self.api_key:
            logger.warning("Serper API key not set. Search unavailable.")
            return []

        payload = {
            "q": query,
            "num": limit
        }
        headers = {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json'
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.url, headers=headers, json=payload, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                results = []
                # Organic results
                for result in data.get("organic", []):
                    results.append({
                        "title": result.get("title"),
                        "link": result.get("link"),
                        "snippet": result.get("snippet")
                    })
                
                # Answer box (often highly relevant)
                if data.get("answerBox"):
                    ab = data["answerBox"]
                    results.insert(0, {
                        "title": ab.get("title", "Answer Box"),
                        "link": ab.get("link"),
                        "snippet": ab.get("answer") or ab.get("snippet")
                    })
                
                return results[:limit]
        except Exception as e:
            logger.error("Serper search failed: %s", e)
            return []

class SearchProvider:
    """
    Unified search provider that can switch between different backends.
    """
    def __init__(self):
        self.provider = SerperSearchProvider()

    async def get_web_results(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        return await self.provider.search(query, limit=limit)

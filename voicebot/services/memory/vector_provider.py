"""
Vector DB Provider — Long-term semantic memory for conversation context retrieval.

Uses ChromaDB (local, zero-infra) with sentence-transformers for embeddings.
Falls back gracefully when chromadb is not installed.

Stores conversation summaries and knowledge snippets as embeddings,
enabling semantic (fuzzy) retrieval beyond exact keyword matching.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Optional

from voicebot.shared.config import get_settings

logger = logging.getLogger("memory-vector")
settings = get_settings()

_CHROMA_COLLECTION = "voicebot_memory"
_CHROMA_DB_PATH = "./data/chroma_db"


class VectorMemoryProvider:
    """
    ChromaDB-backed semantic memory for the voicebot.

    Uses the built-in chromadb sentence-transformers embedding function
    (all-MiniLM-L6-v2 by default) — no external embedding API needed.

    Falls back to no-op when chromadb is not installed so the server
    starts cleanly in environments without the library.
    """

    def __init__(self):
        self._client = None
        self._collection = None
        self._available = False

    async def connect(self) -> None:
        """Initialize the ChromaDB persistent client and collection."""
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            self._client = chromadb.PersistentClient(path=_CHROMA_DB_PATH)
            ef = embedding_functions.DefaultEmbeddingFunction()
            self._collection = self._client.get_or_create_collection(
                name=_CHROMA_COLLECTION,
                embedding_function=ef,
                metadata={"hnsw:space": "cosine"},
            )
            self._available = True
            logger.info(
                "ChromaDB vector memory connected (path=%s, collection=%s, docs=%d)",
                _CHROMA_DB_PATH, _CHROMA_COLLECTION, self._collection.count(),
            )
        except ImportError:
            logger.warning(
                "chromadb not installed — vector memory unavailable. "
                "Install with: pip install chromadb"
            )
        except Exception as e:
            logger.warning("ChromaDB init failed: %s — vector memory disabled.", e)

    async def store_conversation(
        self,
        session_id: str,
        summary: str,
        user_id: Optional[str] = None,
    ) -> None:
        """
        Embed and store a conversation summary for future semantic retrieval.
        The document ID is a hash of session_id so re-storing the same session
        overwrites rather than duplicates.
        """
        if not self._available or not self._collection or not summary.strip():
            return
        try:
            doc_id = hashlib.md5(session_id.encode()).hexdigest()
            metadata: dict = {"session_id": session_id}
            if user_id:
                metadata["user_id"] = user_id

            self._collection.upsert(
                ids=[doc_id],
                documents=[summary],
                metadatas=[metadata],
            )
            logger.debug("Vector memory stored: session=%s (%d chars)", session_id[:8], len(summary))
        except Exception as e:
            logger.warning("Failed to store vector memory: %s", e)

    async def retrieve_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        top_k: int = 3,
    ) -> list[dict]:
        """
        Retrieve the most semantically similar stored conversation summaries.
        Optionally filter by user_id so retrieval is caller-specific.

        Returns a list of dicts: [{document, session_id, distance}, ...]
        """
        if not self._available or not self._collection or not query.strip():
            return []
        try:
            where_filter = {"user_id": user_id} if user_id else None
            results = self._collection.query(
                query_texts=[query],
                n_results=min(top_k, max(1, self._collection.count())),
                where=where_filter if where_filter else None,
                include=["documents", "metadatas", "distances"],
            )
            output = []
            docs = (results.get("documents") or [[]])[0]
            metas = (results.get("metadatas") or [[]])[0]
            dists = (results.get("distances") or [[]])[0]
            for doc, meta, dist in zip(docs, metas, dists):
                output.append({
                    "document": doc,
                    "session_id": meta.get("session_id", ""),
                    "user_id": meta.get("user_id", ""),
                    "distance": round(dist, 4),
                })
            logger.debug(
                "Vector memory retrieved %d results for query '%s'",
                len(output), query[:50],
            )
            return output
        except Exception as e:
            logger.warning("Vector memory retrieval failed: %s", e)
            return []

    async def disconnect(self) -> None:
        """ChromaDB persistent client does not need explicit close."""
        logger.info("Vector memory provider disconnected")

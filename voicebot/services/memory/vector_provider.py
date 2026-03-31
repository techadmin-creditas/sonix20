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

    async def store_fact(
        self,
        bot_id: str,
        fact: str,
        source: Optional[str] = None,
        category: str = "general",
    ) -> str:
        """
        Store a summarized knowledge fact from an external source (like Google)
        into the persistent vector store.
        Returns the unique fact_id (MD5 hash of the content).
        """
        if not self._available or not self._collection or not fact.strip():
            return ""
        try:
            fact_id = f"fact_{hashlib.md5(fact.encode()).hexdigest()}"
            metadata = {
                "bot_id": bot_id,
                "source": source or "google",
                "category": category,
                "type": "fact",
                "timestamp": str(logging.time.time()),
            }
            self._collection.upsert(
                ids=[fact_id],
                documents=[fact],
                metadatas=[metadata],
            )
            logger.info("Vector memory indexed new fact: id=%s (%d chars) from %s", fact_id[:12], len(fact), source or "internal")
            return fact_id
        except Exception as e:
            logger.warning("Failed to store knowledge fact: %s", e)
            return ""

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

    async def search_knowledge(
        self,
        query: str,
        bot_id: Optional[str] = None,
        limit: int = 5,
        min_score: float = 0.5,
    ) -> list[dict]:
        """
        Perform a semantic search across the knowledge store for a specific bot topic.
        Returns matched facts that meet the similarity threshold.
        """
        if not self._available or not self._collection or not query.strip():
            return []
        try:
            where_filter = {"bot_id": bot_id} if bot_id else None
            results = self._collection.query(
                query_texts=[query],
                n_results=limit,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
            output = []
            docs = (results.get("documents") or [[]])[0]
            metas = (results.get("metadatas") or [[]])[0]
            dists = (results.get("distances") or [[]])[0]
            
            for doc, meta, dist in zip(docs, metas, dists):
                # Chroma uses L2/Cosine. Cosine distance 0 means perfect match.
                # Score = 1.0 - distance (for cosine space)
                score = 1.0 - dist
                if score >= min_score:
                    output.append({
                        "content": doc,
                        "source": meta.get("source", "unknown"),
                        "score": round(score, 4),
                        "id": meta.get("id", ""),
                    })
            
            logger.debug("Search knowledge: '%s' -> %d matches above threshold %.2f", query[:50], len(output), min_score)
            return output
        except Exception as e:
            logger.warning("Search knowledge failed: %s", e)
            return []

    async def list_bot_knowledge(self, bot_id: str) -> list[dict]:
        """List all learned facts and knowledge for a specific bot."""
        if not self._available or not self._collection:
            return []
        try:
            results = self._collection.get(
                where={"bot_id": bot_id},
                include=["documents", "metadatas"],
            )
            output = []
            ids = results.get("ids") or []
            docs = results.get("documents") or []
            metas = results.get("metadatas") or []
            for i, doc, meta in zip(ids, docs, metas):
                output.append({
                    "id": i,
                    "content": doc,
                    "source": meta.get("source", ""),
                    "category": meta.get("category", ""),
                    "timestamp": meta.get("timestamp", ""),
                })
            return output
        except Exception as e:
            logger.warning("List knowledge failed: %s", e)
            return []

    async def delete_fact(self, fact_id: str) -> bool:
        """Delete a specific fact by its document ID."""
        if not self._available or not self._collection:
            return False
        try:
            self._collection.delete(ids=[fact_id])
            return True
        except Exception as e:
            logger.warning("Delete fact failed: %s", e)
            return False

    # ─── Semantic QA Cache ────────────────────────────────────────────────────
    # Stores LLM answers keyed by the *meaning* of the question (not exact text).
    # Works cross-session: session 1 trains the cache, session 2 hits it.
    # Uses a separate Chroma collection so QA cache and conversation summaries
    # don't pollute each other's cosine search space.

    _QA_COLLECTION = "voicebot_qa_cache"

    @property
    def _qa_collection(self):
        """Lazy-init the QA cache collection (same Chroma client)."""
        if not self._available or not self._client:
            return None
        if not hasattr(self, "_qa_coll") or self._qa_coll is None:
            try:
                from chromadb.utils import embedding_functions
                ef = embedding_functions.DefaultEmbeddingFunction()
                self._qa_coll = self._client.get_or_create_collection(
                    name=self._QA_COLLECTION,
                    embedding_function=ef,
                    metadata={"hnsw:space": "cosine"},
                )
            except Exception as e:
                logger.warning("QA cache collection init failed: %s", e)
                self._qa_coll = None
        return self._qa_coll

    async def cache_qa(
        self,
        bot_id: str,
        question: str,
        answer: str,
        ttl_hours: int = 24,
    ) -> None:
        """
        Store a question→answer pair in the semantic QA cache.

        The document ID is derived from bot_id + question so upserts naturally
        refresh existing entries and avoid duplicates.
        """
        coll = self._qa_collection
        if not coll or not question.strip() or not answer.strip():
            return
        try:
            doc_id = f"qa_{hashlib.md5((bot_id + question.lower().strip()).encode()).hexdigest()}"
            import time as _time
            coll.upsert(
                ids=[doc_id],
                documents=[question],
                metadatas=[{
                    "bot_id": bot_id,
                    "answer": answer,
                    "cached_at": str(_time.time()),
                    "ttl_hours": str(ttl_hours),
                }],
            )
            logger.debug("QA cache stored: bot=%s q='%s'", bot_id[:8], question[:60])
        except Exception as e:
            logger.warning("QA cache store failed: %s", e)

    async def lookup_qa(
        self,
        bot_id: str,
        question: str,
        min_score: float = 0.92,
    ) -> Optional[str]:
        """
        Look up a semantically similar cached answer for the given question.

        Returns the cached answer string if a match with similarity >= min_score
        is found, otherwise returns None (caller should fall through to LLM).
        """
        coll = self._qa_collection
        if not coll or not question.strip():
            return None
        try:
            count = coll.count()
            if count == 0:
                return None
            results = coll.query(
                query_texts=[question],
                n_results=min(1, count),
                where={"bot_id": bot_id},
                include=["documents", "metadatas", "distances"],
            )
            docs = (results.get("documents") or [[]])[0]
            metas = (results.get("metadatas") or [[]])[0]
            dists = (results.get("distances") or [[]])[0]

            if not docs:
                return None

            dist = dists[0]
            score = 1.0 - dist  # cosine space: 0 = identical, 1 = orthogonal
            if score >= min_score:
                answer = (metas[0] or {}).get("answer", "")
                if answer:
                    logger.info(
                        "QA cache HIT (score=%.3f, q='%s')", score, question[:60]
                    )
                    return answer
            return None
        except Exception as e:
            logger.warning("QA cache lookup failed: %s", e)
            return None

    async def disconnect(self) -> None:
        """ChromaDB persistent client does not need explicit close."""
        logger.info("Vector memory provider disconnected")

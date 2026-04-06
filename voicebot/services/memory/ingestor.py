import os
import hashlib
import uuid
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
import asyncio

logger = logging.getLogger("knowledge-ingestor")

class KnowledgeIngestor:
    """
    Service to ingest and process various data sources into the Vector Memory.
    Supports PDFs, Website URLs, and API endpoints.
    """
    
    def __init__(self, db=None, vector_memory=None):
        self.db = db
        self.vector_memory = vector_memory
        self._max_chunk_size = 750
        self._chunk_overlap = 75

    async def ingest_pdf(self, file_path: str, bot_id: str) -> Dict[str, Any]:
        """Extract text from PDF, chunk it, and store in vector memory."""
        try:
            import pypdf
            
            p = Path(file_path)
            if not p.exists():
                return {"error": f"File not found: {file_path}"}
                
            ingestion_id = str(uuid.uuid4())
            if self.db:
                await self.db.initialize() # Just in case
                # Simplified tracking
                # In a real app we'd use the table we just created

            reader = pypdf.PdfReader(file_path)
            all_text = []
            
            total_chunks = 0
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if not text:
                    continue
                
                # Chunking
                chunks = self._chunk_text(text)
                for chunk in chunks:
                    if self.vector_memory:
                        await self.vector_memory.store_fact(
                            bot_id=bot_id,
                            fact=chunk,
                            source=f"pdf:{p.name}:page_{i+1}",
                            category="documentation"
                        )
                    total_chunks += 1
            
            logger.info("PDF Ingested: %s, Chunks: %d", p.name, total_chunks)
            return {
                "status": "success",
                "ingestion_id": ingestion_id,
                "file": p.name,
                "chunks": total_chunks
            }
        except Exception as e:
            logger.error("PDF Ingestion failed: %s", e)
            return {"error": str(e)}

    async def ingest_url(self, url: str, bot_id: str) -> Dict[str, Any]:
        """Crawl a URL, extract content, and store in vector memory."""
        try:
            import httpx
            from bs4 import BeautifulSoup
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.get(url)
                r.raise_for_status()
                
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Remove scripts, styles, etc.
            for script in soup(["script", "style"]):
                script.decompose()
                
            text = soup.get_text(separator=' ', strip=True)
            chunks = self._chunk_text(text)
            
            total_chunks = 0
            for chunk in chunks:
                if self.vector_memory:
                    await self.vector_memory.store_fact(
                        bot_id=bot_id,
                        fact=chunk,
                        source=f"url:{url}",
                        category="website"
                    )
                total_chunks += 1
                
            logger.info("URL Ingested: %s, Chunks: %d", url, total_chunks)
            return {
                "status": "success",
                "url": url,
                "chunks": total_chunks
            }
        except Exception as e:
            logger.error("URL Ingestion failed: %s", e)
            return {"error": str(e)}

    def _chunk_text(self, text: str) -> List[str]:
        """Split text into manageable chunks with overlap."""
        if not text:
            return []
            
        chunks = []
        start = 0
        while start < len(text):
            end = start + self._max_chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += self._max_chunk_size - self._chunk_overlap
            
        return chunks

"""
Main orchestrator for thread ingestion.

This module handles the orchestration of ingesting Piazza posts,
processing them into chunks, and preparing them for storage.
"""

from typing import List, Dict, Any, Optional
from .helpers import ThreadIngestionService, PostChunk


class ThreadIngestionOrchestrator:
    """
    Orchestrator for managing thread ingestion workflow.
    
    Handles the complete pipeline:
    1. Authentication with Piazza
    2. Fetching posts
    3. Processing into chunks
    4. Preparing for storage/embedding
    """
    
    def __init__(self, cookie_string: str):
        """
        Initialize the orchestrator.
        
        Args:
            cookie_string: Cookie string containing session_id and piazza_session
            
        Raises:
            ValueError: If required cookies are missing
        """
        self.service = ThreadIngestionService.from_cookie_string(cookie_string)
    
    def ingest_by_thread_id(
        self,
        thread_id: str
    ) -> Dict[str, Any]:
        """
        Ingest using thread ID (can be "networkId@postNum" or just "networkId").
        
        Args:
            thread_id: Thread identifier
            
        Returns:
            Dictionary containing processed chunks and summary
        """
        try:

            offset = 0
            limit = 20
            posts_processed = set()
            while True:
                chunks = self.service.ingest_thread_by_id(thread_id, offset, limit)
                if len(chunks) == 0:
                    break

                posts_processed.update(chunk.metadata.post_number for chunk in chunks)
                offset += limit
            
            return {
                "success": True,
                "thread_id": thread_id,
                "total_chunks": len(posts_processed),
                "posts_processed": sorted(list(posts_processed)),
            }
        except Exception as e:
            return {
                "success": False,
                "thread_id": thread_id,
                "error": str(e),
            }

# Convenience function for quick access
def create_orchestrator(cookie_string: str) -> ThreadIngestionOrchestrator:
    """
    Create a new ThreadIngestionOrchestrator instance.
    
    Args:
        cookie_string: Cookie string from browser extension
        
    Returns:
        ThreadIngestionOrchestrator instance
    """
    return ThreadIngestionOrchestrator(cookie_string)

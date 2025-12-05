"""
Main orchestrator for thread ingestion.

This module handles the orchestration of ingesting Piazza posts,
processing them into chunks, and preparing them for storage.
"""

import os
from typing import Any, Dict

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

# LangChain & Database imports
from langchain_postgres import PGVector

from app.core.config import settings
from app.core.database import execute_statement

from .helpers import ThreadIngestionService


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

        # Initialize Embeddings
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY must be set")
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

        # Database Connection String for PGVector
        self.db_connection = settings.DATABASE_URL

    def ingest_by_thread_id(self, thread_id: str) -> Dict[str, Any]:
        """
        Ingest using thread ID (can be "networkId@postNum" or just "networkId").

        Args:
            thread_id: Thread identifier

        Returns:
            Dictionary containing processed chunks and summary
        """
        try:
            # 1. Insert/Update thread in database
            # We use the network_id (thread_id) as the unique identifier

            upsert_query = """
                INSERT INTO threads (piazza_course_id, thread_title, is_indexable, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (piazza_course_id)
                DO UPDATE SET updated_at = NOW()
                RETURNING last_ingested_post_id;
            """
            result = execute_statement(
                upsert_query,
                (thread_id, f"Course {thread_id}", True),
                fetch_result=True,
            )

            last_ingested_id = (
                result[0]["last_ingested_post_id"]
                if result and result[0]["last_ingested_post_id"] is not None
                else 0
            )

            # 2. Initialize PGVector store
            # Collection name is the thread_id
            vector_store = PGVector(
                collection_name=thread_id,
                connection=self.db_connection,
                embeddings=self.embeddings,
                use_jsonb=True,
            )

            # 3. Process posts (Paginated)
            offset = 0
            limit = 50
            posts_processed = set()
            total_chunks_ingested = 0
            max_ingested_post_id = last_ingested_id

            while True:
                # Fetch chunks from service
                chunks = self.service.ingest_thread_by_id(
                    thread_id,
                    offset=offset,
                    limit=limit,
                    last_ingested_id=last_ingested_id,
                )

                if not chunks:
                    break

                # Convert chunks to LangChain Documents
                documents = []
                current_batch_post_nums = set()

                for chunk in chunks:
                    post_num = chunk.metadata.post_number

                    # Skip if already ingested
                    if post_num <= last_ingested_id:
                        continue

                    metadata = chunk.metadata.to_dict()
                    # Add extra metadata if needed
                    metadata["chunk_id"] = chunk.chunk_id
                    metadata["chunk_type"] = chunk.chunk_type

                    doc = Document(page_content=chunk.text, metadata=metadata)
                    documents.append(doc)
                    current_batch_post_nums.add(post_num)

                # Insert into PGVector
                if documents:
                    vector_store.add_documents(documents)
                    total_chunks_ingested += len(documents)

                # Update processed set
                posts_processed.update(current_batch_post_nums)

                # Update max ingested post id
                if current_batch_post_nums:
                    batch_max = max(current_batch_post_nums)
                    max_ingested_post_id = max(max_ingested_post_id, batch_max)

                # Move to next page
                offset += limit

            # Update last_ingested_post_id in DB with the max ingested post id
            if max_ingested_post_id > last_ingested_id:
                update_query = """
                    UPDATE threads
                    SET last_ingested_post_id = %s
                    WHERE piazza_course_id = %s
                """
                execute_statement(update_query, (max_ingested_post_id, thread_id))

            return {
                "success": True,
                "thread_id": thread_id,
                "total_chunks": total_chunks_ingested,
                "posts_processed": list(posts_processed),
                "last_ingested_post_id": max_ingested_post_id,
            }

        except Exception as e:
            print(f"Ingestion error: {e}")
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

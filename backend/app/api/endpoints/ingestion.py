"""
Data ingestion API endpoint for Piazza threads.
"""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.threadIngestion import ThreadIngestionOrchestrator

logger = logging.getLogger(__name__)


class IngestRequest(BaseModel):
    """Request model for data ingestion."""

    thread_id: str = Field(..., description="Piazza thread/post ID")
    piazza_cookie: str = Field(..., description="Piazza session cookie")


class IngestResponse(BaseModel):
    """Response model for data ingestion."""

    message: str
    status: str
    thread_id: str
    chunks_processed: int = 0
    post_numbers: List[int] = []
    last_ingested_post_id: int = 0


class ChunkData(BaseModel):
    """Model for returning chunk data."""

    chunk_id: str
    text: str
    metadata: Dict[str, Any]
    chunk_type: str


router = APIRouter()


def run_ingestion_task(thread_id: str, piazza_cookie: str):
    """
    Background task to run the ingestion process.
    """
    try:
        orchestrator = ThreadIngestionOrchestrator(piazza_cookie)
        orchestrator.ingest_by_thread_id(thread_id=thread_id)
        logger.info(f"Successfully ingested thread {thread_id}")
    except Exception as e:
        logger.exception(f"Background ingestion failed for thread {thread_id}")


@router.post("/ingest", response_model=IngestResponse)
async def ingest_thread(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Start data ingestion for a Piazza thread in the background.

    Returns immediately with a status message.
    """
    try:
        # Add ingestion task to background queue
        background_tasks.add_task(
            run_ingestion_task,
            thread_id=request.thread_id,
            piazza_cookie=request.piazza_cookie,
        )

        return IngestResponse(
            message="Data ingestion started in background",
            status="started",
            thread_id=request.thread_id,
            chunks_processed=0,
            post_numbers=[],
            last_ingested_post_id=0,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start ingestion: {str(e)}",
        )


@router.post("/ingest/preview", response_model=List[ChunkData])
async def preview_ingestion(request: IngestRequest):
    """
    Preview what chunks would be generated without storing them.

    Each chunk contains:
    - Main Post content
    - All Instructor Responses
    - All Student Responses
    - All Follow-up Discussions with replies

    Args:
        request: IngestRequest containing thread_id and piazza_cookie

    Returns:
        List of unified chunks that would be generated
    """
    try:
        # Create orchestrator
        orchestrator = ThreadIngestionOrchestrator(request.piazza_cookie)

        # Ingest and get result
        result = orchestrator.ingest_by_thread_id(thread_id=request.thread_id)

        if not result["success"]:
            raise Exception(result.get("error", "Unknown error"))

        # Convert to response format
        chunk_data = [
            ChunkData(
                chunk_id=chunk["chunk_id"],
                text=chunk["text"],
                metadata=chunk["metadata"],
                chunk_type=chunk["chunk_type"],
            )
            for chunk in result["chunks"]
        ]

        return chunk_data
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid request: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to preview ingestion: {str(e)}",
        )


class IngestionStatusResponse(BaseModel):
    """Response model for ingestion status."""

    ingested_posts_count: int
    total_posts_count: int
    last_ingested_post_id: int
    status: str


@router.post("/ingest/status", response_model=IngestionStatusResponse)
async def get_ingestion_status(request: IngestRequest):
    """
    Get the ingestion status for a thread/course.

    Returns:
    - ingested_posts_count: Number of posts currently in the vector store
    - total_posts_count: Total number of posts in the Piazza feed
    - last_ingested_post_id: The ID of the last successfully ingested post
    """
    try:
        from app.core.database import execute_query
        from app.threadIngestion.helpers import User

        # 1. Get ingested posts count (count embeddings)
        # We count distinct documents (posts) in the collection
        # Table: langchain_pg_embedding
        # Join: langchain_pg_collection on collection_id
        try:
            count_query = """
                SELECT COUNT(DISTINCT (CAST(e.cmetadata->>'post_number' AS INTEGER)))
                FROM langchain_pg_embedding e
                JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                WHERE c.name = %s
            """
            result = execute_query(count_query, (request.thread_id,))
            ingested_count = (
                result[0].get("count", 0) if result and len(result) > 0 else 0
            )
        except Exception as e:
            logger.warning(f"Failed to get ingested count: {e}")
            ingested_count = 0

        # 2. Get total posts count from Piazza API
        # We need to parse the cookie string to get session_id and piazza_session
        # Expected format: "piazza_session=...; session_id=..."

        cookies = {}
        for cookie in request.piazza_cookie.split(";"):
            if "=" in cookie:
                key, value = cookie.strip().split("=", 1)
                cookies[key] = value

        user = User(
            csrf_token=cookies.get("session_id", ""),
            piazza_session=cookies.get("piazza_session", ""),
        )

        # Fetch total posts count using pagination to save RAM
        total_posts = 0
        offset = 0
        batch_size = 2000  # Safe batch size

        while True:
            feed_data = user.getPosts(offset, batch_size, request.thread_id)
            if not feed_data:
                break

            posts = feed_data.get("feed", [])
            if not posts:
                break

            total_posts += len(posts)

            # If we got fewer posts than requested, we've reached the end
            if len(posts) < batch_size:
                break

            offset += batch_size

        # 3. Get last ingested post ID from database
        db_query = """
            SELECT last_ingested_post_id
            FROM threads
            WHERE piazza_course_id = %s
        """
        db_result = execute_query(db_query, (request.thread_id,))
        last_id = 0
        if db_result and len(db_result) > 0:
            last_id = db_result[0].get("last_ingested_post_id") or 0

        return IngestionStatusResponse(
            ingested_posts_count=ingested_count,
            total_posts_count=total_posts,
            last_ingested_post_id=last_id,
            status="success",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get ingestion status: {str(e)}",
        )


@router.get("/health")
async def ingestion_health_check():
    """Check if the ingestion service is available."""
    return {
        "status": "healthy",
        "service": "data-ingestion",
    }

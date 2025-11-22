"""
Data ingestion API endpoint for Piazza threads.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from app.threadIngestion import ThreadIngestionOrchestrator


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


class ChunkData(BaseModel):
    """Model for returning chunk data."""
    
    chunk_id: str
    text: str
    metadata: Dict[str, Any]
    chunk_type: str


router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_thread(request: IngestRequest):
    """
    Start data ingestion for a Piazza thread.
    
    Each post is converted to a unified chunk with the format:
    - Main Post
    - Instructor Response(s)
    - Student Response(s)
    - Follow-up Discussion(s) with replies
    
    Args:
        request: IngestRequest containing thread_id and piazza_cookie
        
    Returns:
        IngestResponse with success message and processing details
    """
    try:
        # Create orchestrator from cookies
        orchestrator = ThreadIngestionOrchestrator(request.piazza_cookie)
        
        result = orchestrator.ingest_by_thread_id(thread_id=request.thread_id)
        
        if not result["success"]:
            raise Exception(result.get("error", "Unknown error"))
        
        
        return IngestResponse(
            message="Data ingestion completed successfully",
            status="success",
            thread_id=request.thread_id,
            chunks_processed=result["total_chunks"],
            post_numbers=result["posts_processed"],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid request: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest thread: {str(e)}",
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


@router.get("/health")
async def ingestion_health_check():
    """Check if the ingestion service is available."""
    return {
        "status": "healthy",
        "service": "data-ingestion",
    }

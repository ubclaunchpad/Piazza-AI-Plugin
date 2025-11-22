"""
Data ingestion API endpoint for Piazza threads.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    """Request model for data ingestion."""

    thread_id: str = Field(..., description="Piazza thread/post ID")
    piazza_cookie: str = Field(..., description="Piazza session cookie")


class IngestResponse(BaseModel):
    """Response model for data ingestion."""

    message: str
    status: str
    thread_id: str


router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_thread(request: IngestRequest):
    """
    Start data ingestion for a Piazza thread.
    
    Args:
        request: IngestRequest containing thread_id and piazza_cookie
        
    Returns:
        IngestResponse with success message
    """
    try:
        # TODO: Implement actual data ingestion logic
        # For now, just return a success message
        
        return IngestResponse(
            message="Data ingestion started",
            status="success",
            thread_id=request.thread_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start data ingestion: {str(e)}",
        )


@router.get("/health")
async def ingestion_health_check():
    """Check if the ingestion service is available."""
    return {
        "status": "healthy",
        "service": "data-ingestion",
    }

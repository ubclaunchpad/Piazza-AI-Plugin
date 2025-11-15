"""
API routes for Piazza AI backend.
"""

from fastapi import APIRouter
from pydantic import BaseModel

# Import endpoint routers
from app.api.endpoints import example, llm

# Create main API router
api_router = APIRouter()


class MessageResponse(BaseModel):
    """Simple message response model."""

    message: str
    status: str


# Include example endpoints
api_router.include_router(example.router, prefix="/example", tags=["users"])

# Include LLM endpoints
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])


@api_router.get("/health", response_model=MessageResponse)
def health_check():
    """Health check endpoint example."""
    return MessageResponse(message="Backend is running", status="healthy")

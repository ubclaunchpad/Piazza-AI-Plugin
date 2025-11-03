"""
API routes for Piazza AI backend.
"""

from fastapi import APIRouter
from pydantic import BaseModel

# Import endpoint routers
from app.api.endpoints import auth, example

# Create main API router
api_router = APIRouter()


class MessageResponse(BaseModel):
    """Simple message response model."""

    message: str
    status: str


# Include example endpoints
api_router.include_router(example.router, prefix="/example", tags=["users"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])


@api_router.get("/health", response_model=MessageResponse)
def health_check():
    """Health check endpoint example."""
    return MessageResponse(message="Backend is running", status="healthy")

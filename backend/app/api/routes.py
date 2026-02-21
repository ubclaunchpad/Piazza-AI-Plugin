"""
API routes for Piazza AI backend.
"""

from fastapi import APIRouter
from pydantic import BaseModel

# Import endpoint routers
from app.api.endpoints import auth, chat_sessions, documents, example, ingestion, llm, per_post_llm

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

# Include ingestion endpoints
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])

# Authentication endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Chat Session endpoints
api_router.include_router(chat_sessions.router, tags=["chat-sessions"])

# Include document endpoints
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])

# Include post assistant endpoints
api_router.include_router(per_post_llm.router, prefix="/per-post", tags=["post-assistant"])


@api_router.get("/health", response_model=MessageResponse)
def health_check():
    """Health check endpoint example."""
    return MessageResponse(message="Backend is running", status="healthy")

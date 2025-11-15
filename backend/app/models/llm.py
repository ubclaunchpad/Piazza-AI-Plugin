"""
LLM models.
"""

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    """Request model for LLM queries."""

    query: str = Field(..., min_length=1, max_length=5000)


class QueryResponse(BaseModel):
    """Response model for LLM queries."""

    query: str
    response: str
    model: str


__all__ = ["QueryRequest", "QueryResponse"]

"""
Search models.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

SearchType = Literal["semantic", "code", "formula"]


class SearchFilters(BaseModel):
    """Phase 1 filters supported by the current schema."""

    instructor_only: bool = False
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class SearchRequest(BaseModel):
    """Request payload for the unified search endpoint."""

    query: str = Field(..., min_length=1, max_length=1000)
    search_type: SearchType = "semantic"
    piazza_course_id: Optional[str] = Field(None, min_length=1, max_length=255)
    limit: int = Field(default=10, ge=1, le=25)
    similarity_threshold: float = Field(default=0.0, ge=-1.0, le=1.0)
    filters: SearchFilters = Field(default_factory=SearchFilters)


class SimilarSearchRequest(BaseModel):
    """Request payload for finding similar questions."""

    piazza_course_id: str = Field(..., min_length=1, max_length=255)
    piazza_post_id: str = Field(..., min_length=1, max_length=255)
    limit: int = Field(default=5, ge=1, le=25)
    similarity_threshold: float = Field(default=0.0, ge=-1.0, le=1.0)


class SavedSearchCreate(BaseModel):
    """Request payload for saving a search."""

    piazza_course_id: Optional[str] = Field(None, min_length=1, max_length=255)
    query: str = Field(..., min_length=1, max_length=1000)
    search_type: SearchType = "semantic"


class SearchResult(BaseModel):
    """Single search hit."""

    source_type: str
    source_id: str
    chunk_id: str
    external_id: Optional[str] = None
    title: Optional[str] = None
    excerpt: str
    score: float
    created_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Search response payload."""

    query: str
    search_type: SearchType
    results: List[SearchResult]


class SavedSearchResponse(BaseModel):
    """Saved search response payload."""

    id: UUID
    user_id: UUID
    piazza_course_id: Optional[str] = None
    query: str
    search_type: SearchType
    created_at: datetime

"""
Resource aggregator models.
Corresponds to the resource search API and the resource_library table.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ResourceSearchRequest(BaseModel):
    """Request body for POST /resources/search."""

    query: str = Field(..., description="Topic or query text")
    piazza_course_id: str = Field(..., description="Course identifier from Piazza URL")
    filters: Optional[List[str]] = Field(
        default=None,
        description="Optional list of providers to include (e.g. youtube, stackoverflow)",
    )
    limit: Optional[int] = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of resources to return",
    )


class ResourceSearchItem(BaseModel):
    """Single aggregated resource item."""

    title: str
    url: str
    resource_type: str
    description: str
    relevance_score: float


class ResourceSearchResponse(BaseModel):
    """Response body for POST /resources/search."""

    results: List[ResourceSearchItem]


class SavedResource(BaseModel):
    """Row from the resource_library table."""

    id: UUID
    topic: str
    title: str
    url: str
    resource_type: str
    description: Optional[str] = None
    relevance_score: Optional[float] = None
    piazza_course_id: str
    created_at: datetime


class SavedResourceListResponse(BaseModel):
    """Response body for GET /resources/library."""

    saved_resources: List[SavedResource]


class SaveResourceRequest(BaseModel):
    """Request body for POST /resources/library."""

    piazza_course_id: str
    topic: str
    resource_type: str
    title: str
    url: str
    description: str
    relevance_score: Optional[float] = None


class SaveResourceResponse(BaseModel):
    """Response body for POST /resources/library."""

    id: UUID
    message: str = "Resource saved successfully to library."


__all__ = [
    "ResourceSearchRequest",
    "ResourceSearchItem",
    "ResourceSearchResponse",
    "SavedResource",
    "SavedResourceListResponse",
    "SaveResourceRequest",
    "SaveResourceResponse",
]


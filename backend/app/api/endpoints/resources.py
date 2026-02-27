"""
Resource aggregator endpoints.

This module defines the API surface for the Smart Resource Aggregator feature.
Note: Implementations are currently stubbed with example data. 
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, status
from pydantic import BaseModel, Field


router = APIRouter()


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


@router.post(
    "/search",
    response_model=ResourceSearchResponse,
    summary="Search for external learning resources",
)
async def search_resources(payload: ResourceSearchRequest) -> ResourceSearchResponse:
    """
    Aggregate, rank, and summarize resources from external APIs based on a topic or query.

    Stub implementation: returns example data shaped according to the contract.
    """
    # Stubbed example data; to be replaced by real provider + LLM logic.
    dummy_results = [
        ResourceSearchItem(
            title=f"{payload.query} – YouTube overview",
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            resource_type="youtube",
            description=f"Introductory video explaining {payload.query}.",
            relevance_score=0.95,
        ),
        ResourceSearchItem(
            title=f"{payload.query} – StackOverflow Q&A",
            url="https://stackoverflow.com/questions/example",
            resource_type="stackoverflow",
            description=f"Popular StackOverflow discussion related to {payload.query}.",
            relevance_score=0.86,
        ),
    ]

    limit = payload.limit or 10
    return ResourceSearchResponse(results=dummy_results[:limit])


@router.get(
    "/library",
    response_model=SavedResourceListResponse,
    summary="Get saved resources for a user",
)
async def get_resource_library() -> SavedResourceListResponse:
    """
    Retrieve resources previously saved to the user's library.

    Stub implementation: returns a small, fixed example list.
    """
    now = datetime.now(timezone.utc)
    example_resource = SavedResource(
        id=uuid4(),
        topic="Example Topic",
        title="Example saved resource",
        url="https://example.com/resource",
        resource_type="wikipedia",
        description="Example saved resource from the library.",
        relevance_score=0.9,
        piazza_course_id="CPSC_###",
        created_at=now,
    )
    return SavedResourceListResponse(saved_resources=[example_resource])


@router.post(
    "/library",
    response_model=SaveResourceResponse,
    status_code=status.HTTP_200_OK,
    summary="Save a resource to the library",
)
async def save_resource_to_library(payload: SaveResourceRequest) -> SaveResourceResponse:
    """
    Save a specific resource item to the resource library.

    Stub implementation: returns a generated ID without persisting data.
    """
    # In the full implementation, this will insert into the resource_library table.
    new_id = uuid4()
    return SaveResourceResponse(id=new_id)


@router.delete(
    "/library/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a resource from the library",
)
async def delete_resource_from_library(id: UUID) -> None:
    """
    Delete a specific resource from the library by its ID.

    Stub implementation: assumes deletion succeeds and returns 204.
    """
    # Full implementation will validate ownership and delete from resource_library.
    return None


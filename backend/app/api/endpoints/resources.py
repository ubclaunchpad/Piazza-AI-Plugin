"""
Resource aggregator endpoints.

This module defines the API surface for the Smart Resource Aggregator feature.
"""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.models import (
    ResourceSearchItem,
    ResourceSearchRequest,
    ResourceSearchResponse,
    SaveResourceRequest,
    SaveResourceResponse,
    SavedResource,
    SavedResourceListResponse,
)
from app.services.resource_providers import (
    fetch_khan_academy_resources,
    fetch_stackoverflow_resources,
    fetch_wikipedia_resources,
    fetch_youtube_resources,
)
from app.textGeneration.resource_ranker import rank_resources

logger = logging.getLogger(__name__)

router = APIRouter()

# Map filter names (normalized lowercase) to async provider functions
PROVIDER_MAP = {
    "youtube": fetch_youtube_resources,
    "stackoverflow": fetch_stackoverflow_resources,
    "khan_academy": fetch_khan_academy_resources,
    "wikipedia": fetch_wikipedia_resources,
}


@router.post(
    "/search",
    response_model=ResourceSearchResponse,
    summary="Search for external learning resources",
)
async def search_resources(payload: ResourceSearchRequest) -> ResourceSearchResponse:
    """
    Aggregate, rank, and summarize resources from external APIs based on a topic or query.
    """
    query = (payload.query or "").strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="query is required and cannot be empty",
        )

    limit = payload.limit or 10
    # Normalize filters: default to all providers if empty/None
    raw_filters = payload.filters or []
    enabled = [
        name
        for name in (f.strip().lower() for f in raw_filters if isinstance(f, str))
        if name in PROVIDER_MAP
    ]
    if not enabled:
        enabled = list(PROVIDER_MAP.keys())

    async def fetch_safe(name: str, fetch_fn):
        try:
            return await fetch_fn(query, limit)
        except Exception as e:
            logger.warning("Resource provider %s failed: %s", name, e)
            return []

    tasks = [
        fetch_safe(name, fn)
        for name, fn in PROVIDER_MAP.items()
        if name in enabled
    ]
    results_per_provider = await asyncio.gather(*tasks)

    combined = []
    for lst in results_per_provider:
        combined.extend(lst)

    if not combined:
        return ResourceSearchResponse(results=[])

    ranked = rank_resources(
        combined,
        query,
        piazza_course_id=payload.piazza_course_id or None,
    )
    trimmed = ranked[:limit]

    results = [
        ResourceSearchItem(
            title=item.get("title", ""),
            url=item.get("url", ""),
            resource_type=item.get("resource_type", "other"),
            description=item.get("description", ""),
            relevance_score=float(item.get("relevance_score", 0.5)),
        )
        for item in trimmed
    ]
    return ResourceSearchResponse(results=results)


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


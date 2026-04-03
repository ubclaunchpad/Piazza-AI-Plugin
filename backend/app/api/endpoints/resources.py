"""
Resource aggregator endpoints.

This module defines the API surface for the Smart Resource Aggregator feature.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.database import execute_query, execute_statement
from app.core.supabase import supabase
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


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Validate Bearer token and return the current user (for library endpoints)."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )
    try:
        token = authorization.replace("Bearer ", "").strip()
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return user.user
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Resource library auth failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


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

    results = []
    for item in trimmed:
        raw_score = item.get("relevance_score")
        relevance_score = None
        if raw_score is not None:
            try:
                relevance_score = float(raw_score)
            except (TypeError, ValueError):
                relevance_score = None
        results.append(
            ResourceSearchItem(
                title=item.get("title", ""),
                url=item.get("url", ""),
                resource_type=item.get("resource_type", "other"),
                description=item.get("description", ""),
                relevance_score=relevance_score,
            )
        )
    return ResourceSearchResponse(results=results)


@router.get(
    "/library",
    response_model=SavedResourceListResponse,
    summary="Get saved resources for a user",
)
async def get_resource_library(
    user=Depends(get_current_user),
    piazza_course_id: Optional[str] = Query(None, description="Filter by Piazza course ID"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> SavedResourceListResponse:
    """
    Retrieve resources previously saved to the user's library.
    """
    try:
        base_sql = """
            SELECT id, user_id, piazza_course_id, topic, resource_type, title, url,
                   description, relevance_score, created_at
            FROM resource_library
            WHERE user_id = %s
        """
        count_sql = "SELECT COUNT(*) AS total FROM resource_library WHERE user_id = %s"
        params = [str(user.id)]
        if piazza_course_id and piazza_course_id.strip():
            base_sql += " AND piazza_course_id = %s"
            count_sql += " AND piazza_course_id = %s"
            params.append(piazza_course_id.strip())
        base_sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        offset = (page - 1) * per_page
        params.extend([per_page, offset])

        total_row = execute_query(count_sql, tuple(params[: len(params) - 2]), fetch_one=True)
        total = int(total_row["total"]) if total_row else 0

        rows = execute_query(base_sql, tuple(params))
        if not rows:
            return SavedResourceListResponse(saved_resources=[])

        saved = [
            SavedResource(
                id=row["id"],
                topic=row["topic"],
                title=row["title"],
                url=row["url"],
                resource_type=row["resource_type"] or "other",
                description=row["description"],
                relevance_score=float(row["relevance_score"]) if row["relevance_score"] is not None else None,
                piazza_course_id=row["piazza_course_id"] or "",
                created_at=row["created_at"],
            )
            for row in rows
        ]
        return SavedResourceListResponse(saved_resources=saved)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch resource library: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch resource library",
        )


@router.post(
    "/library",
    response_model=SaveResourceResponse,
    status_code=status.HTTP_200_OK,
    summary="Save a resource to the library",
)
async def save_resource_to_library(
    payload: SaveResourceRequest,
    user=Depends(get_current_user),
) -> SaveResourceResponse:
    """
    Save a specific resource item to the resource library.
    """
    try:
        url = (payload.url or "").strip()
        if not url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="url is required and cannot be empty",
            )
        topic = (payload.topic or "").strip()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="topic is required and cannot be empty",
            )
        title = (payload.title or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="title is required and cannot be empty",
            )

        insert_sql = """
            INSERT INTO resource_library
            (user_id, piazza_course_id, topic, resource_type, title, url, description, relevance_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        row = execute_query(
            insert_sql,
            (
                str(user.id),
                payload.piazza_course_id or None,
                topic,
                payload.resource_type or None,
                title,
                url,
                payload.description or None,
                payload.relevance_score,
            ),
            fetch_one=True,
        )
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save resource",
            )
        new_id = row["id"]
        return SaveResourceResponse(id=new_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to save resource: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save resource",
        )


@router.delete(
    "/library/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a resource from the library",
)
async def delete_resource_from_library(
    id: UUID,
    user=Depends(get_current_user),
) -> None:
    """
    Delete a specific resource from the library by its ID.
    """
    try:
        delete_sql = "DELETE FROM resource_library WHERE id = %s AND user_id = %s"
        affected = execute_statement(delete_sql, (str(id), str(user.id)))
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not authorized to delete",
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete resource: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete resource",
        )


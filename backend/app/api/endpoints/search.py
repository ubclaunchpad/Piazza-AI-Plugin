"""
Search API endpoints.
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from langchain_openai import OpenAIEmbeddings

from app.api.endpoints.chat_sessions import get_current_user
from app.core.database import execute_query, execute_statement
from app.models.search import (
    SavedSearchCreate,
    SavedSearchResponse,
    SearchRequest,
    SearchResponse,
    SimilarSearchRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)

CODE_PATTERN = re.compile(
    r"(?m)(```|^\s{4,}|class\s+\w+|def\s+\w+|function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+|=>|#include|SELECT\s)"
)
FORMULA_PATTERN = re.compile(r"(\\\(|\\\[|\$\$|\$[^$]+\$|=|\^|_|\\frac|\\sum|\\int)")
FORMULA_TOKEN_PATTERN = re.compile(
    r"\\[a-zA-Z]+|[A-Za-z]+(?:_[A-Za-z0-9]+)?|[0-9]+(?:\.[0-9]+)?|[+\-*/=^_(){}\[\]]"
)
FORMULA_NORMALIZATION_REPLACEMENTS = (
    (r"\\left", ""),
    (r"\\right", ""),
    (r"\\cdot", "*"),
    (r"\\times", "*"),
    (r"\\div", "/"),
    (r"\\geq", ">="),
    (r"\\leq", "<="),
    (r"\\neq", "!="),
    (r"\\approx", "~"),
    (r"\\,", ""),
    (r"\\!", ""),
    (r"\s+", ""),
)


def _vector_literal(values: List[float]) -> str:
    return "[" + ",".join(f"{value:.12g}" for value in values) + "]"


def _embed_query(query: str) -> str:
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        return _vector_literal(embeddings.embed_query(query))
    except Exception as exc:
        logger.error("Failed to embed search query: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Search embeddings are unavailable. Check OPENAI_API_KEY.",
        ) from exc


def _normalize_formula_text(text: str) -> str:
    normalized = text or ""
    for pattern, replacement in FORMULA_NORMALIZATION_REPLACEMENTS:
        normalized = re.sub(pattern, replacement, normalized)
    return normalized.strip().lower()


def _extract_formula_tokens(text: str) -> List[str]:
    return FORMULA_TOKEN_PATTERN.findall(_normalize_formula_text(text))


def _formula_match_score(query_text: str, candidate_text: str) -> tuple[float, dict]:
    normalized_query = _normalize_formula_text(query_text)
    normalized_candidate = _normalize_formula_text(candidate_text)
    query_tokens = _extract_formula_tokens(query_text)
    candidate_tokens = _extract_formula_tokens(candidate_text)

    if not normalized_query or not query_tokens:
        return 0.0, {
            "normalized_query": normalized_query,
            "normalized_formula_match": False,
            "formula_token_overlap": 0.0,
        }

    overlap = set(query_tokens) & set(candidate_tokens)
    overlap_ratio = len(overlap) / max(len(set(query_tokens)), 1)
    exact_match = normalized_query in normalized_candidate

    bonus = 0.0
    if exact_match:
        bonus += 0.35
    if overlap_ratio > 0:
        bonus += min(0.3, overlap_ratio * 0.3)

    return bonus, {
        "normalized_query": normalized_query,
        "normalized_formula_match": exact_match,
        "formula_token_overlap": round(overlap_ratio, 3),
        "formula_tokens": query_tokens[:12],
    }


def _apply_search_mode_scores(
    rows: List[dict], search_type: str, query_text: str
) -> List[dict]:
    if search_type == "semantic":
        return rows

    pattern = CODE_PATTERN if search_type == "code" else FORMULA_PATTERN
    for row in rows:
        excerpt = row.get("excerpt") or ""
        metadata = row.get("metadata") or {}
        metadata["search_mode"] = search_type

        if pattern.search(excerpt):
            row["score"] = float(row.get("score") or 0.0) + 0.15
            metadata["mode_match"] = True
        else:
            metadata["mode_match"] = False

        if search_type == "formula":
            formula_bonus, formula_metadata = _formula_match_score(
                query_text, excerpt
            )
            row["score"] = float(row.get("score") or 0.0) + formula_bonus
            metadata.update(formula_metadata)

        row["metadata"] = metadata

    return rows


def _created_at_expr() -> str:
    return """
        CASE
            WHEN COALESCE(e.cmetadata->>'created_at', '') ~ '^\\d+(\\.\\d+)?$'
                THEN to_timestamp((e.cmetadata->>'created_at')::double precision)
            WHEN COALESCE(e.cmetadata->>'created_at', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                THEN (e.cmetadata->>'created_at')::timestamptz
            ELSE NULL
        END
    """


def _search_post_chunks(
    vector: str,
    query_text: str,
    piazza_course_id: Optional[str],
    limit: int,
    threshold: float,
    instructor_only: bool = False,
    date_from=None,
    date_to=None,
    exclude_piazza_post_id: Optional[str] = None,
    search_type: str = "semantic",
) -> List[dict]:
    created_at_expr = _created_at_expr()
    clauses = ["TRUE"]
    params: List[object] = [vector]

    if piazza_course_id:
        clauses.append("c.name = %s")
        params.append(piazza_course_id)

    if instructor_only:
        clauses.append("COALESCE(e.cmetadata->>'author_role', '') = %s")
        params.append("instructor")

    if date_from:
        clauses.append(f"{created_at_expr} >= %s")
        params.append(date_from)

    if date_to:
        clauses.append(f"{created_at_expr} <= %s")
        params.append(date_to)

    if exclude_piazza_post_id:
        clauses.append(
            "COALESCE(e.cmetadata->>'post_id', '') <> %s"
        )
        params.append(exclude_piazza_post_id)
        clauses.append(
            "COALESCE(e.cmetadata->>'post_number', '') <> %s"
        )
        params.append(exclude_piazza_post_id)

    fetch_limit = min(limit * 4, 100)
    params.extend([vector, fetch_limit])

    sql = f"""
        SELECT
            'post_chunk' AS source_type,
            COALESCE(
                e.cmetadata->>'post_id',
                e.cmetadata->>'post_number',
                e.cmetadata->>'chunk_id',
                'unknown'
            ) AS source_id,
            COALESCE(
                e.cmetadata->>'chunk_id',
                e.cmetadata->>'post_id',
                e.cmetadata->>'post_number',
                'unknown'
            ) AS chunk_id,
            COALESCE(e.cmetadata->>'post_number', e.cmetadata->>'post_id') AS external_id,
            COALESCE(
                e.cmetadata->>'subject',
                'Post ' || COALESCE(e.cmetadata->>'post_number', e.cmetadata->>'post_id', 'unknown')
            ) AS title,
            e.document AS excerpt,
            (1 - (e.embedding <=> %s::vector))::float AS score,
            {created_at_expr} AS created_at,
            COALESCE(
                e.cmetadata,
                '{{}}'::jsonb
            ) || jsonb_build_object(
                'poster_role',
                e.cmetadata->>'author_role',
                'piazza_course_id',
                c.name
            ) AS metadata
        FROM langchain_pg_embedding e
        JOIN langchain_pg_collection c ON e.collection_id = c.uuid
        WHERE {' AND '.join(clauses)}
        ORDER BY e.embedding <=> %s::vector
        LIMIT %s
    """
    rows = execute_query(sql, tuple(params))
    rows = _apply_search_mode_scores(rows, search_type, query_text)
    filtered = [row for row in rows if float(row.get("score") or 0.0) >= threshold]
    return sorted(filtered, key=lambda row: row["score"], reverse=True)[:limit]


@router.post("/search", response_model=SearchResponse)
async def search_content(
    request: SearchRequest,
    user=Depends(get_current_user),
):
    """Run Phase 1 search across ingested Piazza posts."""
    del user  # authentication guard only

    vector = _embed_query(request.query)
    rows = _search_post_chunks(
        vector=vector,
        query_text=request.query,
        piazza_course_id=request.piazza_course_id,
        limit=request.limit,
        threshold=request.similarity_threshold,
        instructor_only=request.filters.instructor_only,
        date_from=request.filters.date_from,
        date_to=request.filters.date_to,
        search_type=request.search_type,
    )
    return SearchResponse(
        query=request.query,
        search_type=request.search_type,
        results=rows,
    )


@router.post("/search/similar", response_model=SearchResponse)
async def similar_questions(
    request: SimilarSearchRequest,
    user=Depends(get_current_user),
):
    """Find questions similar to an indexed Piazza post."""
    del user  # authentication guard only

    source = execute_query(
        """
        SELECT
            e.embedding::text AS embedding,
            e.document AS query_text
        FROM langchain_pg_embedding e
        JOIN langchain_pg_collection c ON e.collection_id = c.uuid
        WHERE c.name = %s
          AND (
              e.cmetadata->>'post_id' = %s
              OR e.cmetadata->>'post_number' = %s
          )
        ORDER BY
            CASE
                WHEN e.cmetadata->>'post_id' = %s THEN 0
                ELSE 1
            END,
            COALESCE(
                e.cmetadata->>'chunk_id',
                e.cmetadata->>'post_id',
                e.cmetadata->>'post_number',
                ''
            )
        LIMIT 1
        """,
        (
            request.piazza_course_id,
            request.piazza_post_id,
            request.piazza_post_id,
            request.piazza_post_id,
        ),
        fetch_one=True,
    )

    if not source:
        raise HTTPException(
            status_code=404,
            detail=f"No indexed content found for Piazza post {request.piazza_post_id}",
        )

    rows = _search_post_chunks(
        vector=source["embedding"],
        query_text=source["query_text"],
        piazza_course_id=request.piazza_course_id,
        limit=request.limit,
        threshold=request.similarity_threshold,
        exclude_piazza_post_id=request.piazza_post_id,
    )
    return SearchResponse(
        query=source["query_text"],
        search_type="semantic",
        results=rows,
    )


@router.get("/search/saved", response_model=List[SavedSearchResponse])
async def list_saved_searches(
    piazza_course_id: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    """List saved searches for the current user."""
    params: List[object] = [user.id]
    clauses = ["user_id = %s"]
    if piazza_course_id:
        clauses.append("piazza_course_id = %s")
        params.append(piazza_course_id)

    sql = f"""
        SELECT id, user_id, piazza_course_id, query, search_type, created_at
        FROM saved_searches
        WHERE {' AND '.join(clauses)}
        ORDER BY created_at DESC
    """
    return execute_query(sql, tuple(params))


@router.post(
    "/search/saved",
    response_model=SavedSearchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_search(
    payload: SavedSearchCreate,
    user=Depends(get_current_user),
):
    """Save a search for later reuse."""
    sql = """
        INSERT INTO saved_searches (user_id, piazza_course_id, query, search_type)
        VALUES (%s, %s, %s, %s)
        RETURNING id, user_id, piazza_course_id, query, search_type, created_at
    """
    return execute_query(
        sql,
        (user.id, payload.piazza_course_id, payload.query, payload.search_type),
        fetch_one=True,
    )


@router.delete("/search/saved/{saved_search_id}")
async def delete_saved_search(
    saved_search_id: UUID,
    user=Depends(get_current_user),
):
    """Delete a saved search if it belongs to the current user."""
    affected = execute_statement(
        "DELETE FROM saved_searches WHERE id = %s AND user_id = %s",
        (str(saved_search_id), user.id),
    )
    if affected == 0:
        raise HTTPException(
            status_code=404,
            detail="Saved search not found or not authorized",
        )
    return {"status": "success", "message": "Saved search deleted"}

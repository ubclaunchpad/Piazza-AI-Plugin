"""
LLM API endpoints for per-post AI assistant
"""

import logging

from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import StreamingResponse

from app.models import PostRequest, TranslatePostRequest
from app.textGeneration.post_assistant.shared import (
    PostAssistantContextError,
    get_exact_post_context,
)
from app.textGeneration.post_assistant.simplify import stream_llm_simplify_response
from app.textGeneration.post_assistant.solve import stream_llm_solve_response
from app.textGeneration.post_assistant.summarize import stream_llm_summary_response
from app.textGeneration.post_assistant.translate import stream_llm_translate_response

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_post_or_raise(request: PostRequest):
    """Resolve the exact post before starting a streaming response."""
    try:
        return get_exact_post_context(request.thread_id, request.post_num)
    except PostAssistantContextError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/simplify/{proficiency}")
async def generate_llm_simplify_response(
    request: PostRequest,
    proficiency: int = Path(..., ge=1, le=3),
):
    try:
        post_context = _resolve_post_or_raise(request)
        return StreamingResponse(
            stream_llm_simplify_response(
                post_context=post_context,
                session_id=request.session_id,
                proficiency=proficiency,
            ),
            media_type="application/x-ndjson",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate simplify response")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )


@router.post("/solve")
async def generate_llm_solution_response(request: PostRequest):
    try:
        post_context = _resolve_post_or_raise(request)
        return StreamingResponse(
            stream_llm_solve_response(
                post_context=post_context,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate solve response")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )


@router.post("/summarize")
async def generate_llm_summary_response(request: PostRequest):
    try:
        post_context = _resolve_post_or_raise(request)
        return StreamingResponse(
            stream_llm_summary_response(
                post_context=post_context,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate summarize response")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )


@router.post("/translate")
async def generate_llm_translation_response(request: TranslatePostRequest):
    try:
        post_context = _resolve_post_or_raise(request)
        return StreamingResponse(
            stream_llm_translate_response(
                post_context=post_context,
                session_id=request.session_id,
                language=request.language,
            ),
            media_type="application/x-ndjson",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate translate response")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )

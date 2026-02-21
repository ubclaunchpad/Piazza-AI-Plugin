"""
LLM API endpoints for per-post AI assistent, including:
    1. Explain/Simplify 
    2. Solve
    3. Summarize
    4. Translate
    5. Concept linking
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models import PostRequest, SimplifyPostRequest
from app.textGeneration.post_assistant.simplify import stream_llm_simplify_response
from app.textGeneration.post_assistant.solve import stream_llm_solve_response
from app.textGeneration.post_assistant.summarize import stream_llm_summary_response
from app.textGeneration.post_assistant.translate import stream_llm_translate_response
from app.textGeneration.post_assistant.concept_linking import stream_llm_concept_response

router = APIRouter()

@router.post("/simplify/{proficiency}")
async def generate_llm_simplify_response(request: SimplifyPostRequest, proficiency:int):
    try:
        return StreamingResponse(
            stream_llm_simplify_response(
                post_num=request.post_num,
                thread_id=request.thread_id,
                session_id=request.session_id,
                proficiency=proficiency
            ),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )


@router.post("/solve")
async def generate_llm_solution_response(request: PostRequest):
    try:
        return StreamingResponse(
            stream_llm_solve_response(
                post_num=request.post_num,
                thread_id=request.thread_id,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )
    

@router.post("/summarize")
async def generate_llm_summary_response(request: PostRequest):
    try:
        return StreamingResponse(
            stream_llm_summary_response(
                post_num=request.post_num,
                thread_id=request.thread_id,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )
    

@router.post("/translate")
async def generate_llm_translation_response(request: PostRequest):
    try:
        return StreamingResponse(
            stream_llm_translate_response(
                post_num=request.post_num,
                thread_id=request.thread_id,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )

@router.post("/link_concepts")
async def generate_llm_concept_linking_response(request: PostRequest):
    try:
        return StreamingResponse(
            stream_llm_concept_response(
                post_num=request.post_num,
                thread_id=request.thread_id,
                session_id=request.session_id,
            ),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate response: {str(e)}",
        )
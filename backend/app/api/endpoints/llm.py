"""
LLM API endpoint for text generation.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models import QueryRequest
from app.textGeneration import stream_llm_response

router = APIRouter()


@router.post("/query")
async def generate_llm_response(request: QueryRequest):
    """Generate an LLM response to a user query (Streaming)."""
    try:
        return StreamingResponse(
            stream_llm_response(
                query=request.query,
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


@router.get("/health")
async def llm_health_check():
    """Check if the LLM service is configured."""
    import os

    api_key = os.getenv("GROQ_API_KEY")
    return {
        "status": "healthy" if api_key else "unhealthy",
        "model": "openai/gpt-oss-120b",
        "configured": bool(api_key),
    }

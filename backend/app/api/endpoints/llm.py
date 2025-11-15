"""
LLM API endpoint for text generation.
"""

from fastapi import APIRouter, HTTPException

from app.models import QueryRequest, QueryResponse
from app.textGeneration import get_llm_response

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def generate_llm_response(request: QueryRequest):
    """Generate an LLM response to a user query."""
    try:
        response = get_llm_response(request.query)

        return QueryResponse(
            query=request.query,
            response=response.content,
            model=response.model,
        )
    except Exception as e:
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

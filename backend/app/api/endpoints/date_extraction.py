"""
Calendar date extraction endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from app.textGeneration.date_extractor import extract_dates_from_post

router = APIRouter()


class DateExtractionRequest(BaseModel):
    """Request model for date extraction."""
    post_text: str
    use_llm: bool = True


class DateExtractionResponse(BaseModel):
    """Response model for date extraction."""
    events: List[Dict]
    count: int


@router.post("/extract-dates", response_model=DateExtractionResponse)
def extract_dates(request: DateExtractionRequest):
    """
    Extract dates and events from a Piazza post.
    """
    if not request.post_text or not request.post_text.strip():
        raise HTTPException(status_code=400, detail="post_text cannot be empty")

    events = extract_dates_from_post(request.post_text, use_llm=request.use_llm)

    return DateExtractionResponse(events=events, count=len(events))
"""
Calendar date extraction endpoints.
"""

from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.textGeneration.date_extractor import ThreadInput, extract_dates_from_post

router = APIRouter()


class DateExtractionRequest(BaseModel):
    """Request model for date extraction."""

    input: "ThreadInput"
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
    if (
        not request.input.threadSummary.strip()
        and not request.input.threadContent.strip()
    ):
        raise HTTPException(
            status_code=400,
            detail="input.threadSummary or input.threadContent is required",
        )

    events = extract_dates_from_post(request.input, use_llm=request.use_llm)
    return DateExtractionResponse(events=events, count=len(events))

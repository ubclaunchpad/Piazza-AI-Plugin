"""
AI-powered date extraction from Piazza posts for calendar integration.

Uses ChatGroq with structured output to identify dates, event types, and titles.
Falls back to dateparser for additional date detection.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Dict, List

import dateparser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class ExtractedEvent(BaseModel):
    """ Schema for extracted event data. """
    title: str = Field(description="Brief title for the event.")
    date: str = Field(description="Event date in ISO format (YYYY-MM-DD)")
    event_type: str = Field(description="Type of the event: assignment, exam, office_hours, deadline, meeting, or other")
    confidence: float = Field(description="Confidence score for the extraction between 0 and 1")

class DateExtractionResult(BaseModel):
    """ Container for all extracted events. """
    events: List[ExtractedEvent] = Field(default_factory=list)

def extract_dates_with_llm(post_text: str) -> List[Dict]:
    """
    Extract dates and event details from post text using ChatGroq.

    Args:
        post_text (str): The text content of the Piazza post.

    Returns:
        List of extracted events with date, type, title, and confidence
    """

    try:

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.debug("GROQ_API_KEY not set - skipping LLM extraction")
            return []

        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            api_key=api_key
        )

        structured_llm = llm.with_structured_output(DateExtractionResult)

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at extracting academic event dates from text.
Your task is to identify all mentions of dates and their associated events in Piazza posts.

Event types to look for:
- assignment: homework, assignments, projects
- exam: midterms, finals, quizzes, tests
- office_hours: TA/professor office hours
- deadline: submission deadlines, project milestones
- meeting: study groups, team meetings
- other: any other time-sensitive event

For each date found:
1. Convert to ISO format (YYYY-MM-DD). If only day/month given, assume current or next year.
2. Identify the event type from the list above.
3. Create a brief, clear title (max 20 chars)
4. Assign confidence score (0-1) based on how clearly the date/event is mentioned.

Examples:
- "Assignment 3 is due next Friday" → date: (calculate date), type: assignment, title: "Assignment 3 Due"
- "Midterm on March 15th" → date: 2024-03-15, type: exam, title: "Midterm Exam"
- "Office hours this Thursday 2-4pm" → date: (calculate date), type: office_hours, title: "Office Hours"

Return an empty list if no dates are found."""),
            ("human", "Extract all dates and events from this Piazza post:\n\n{text}")
        ])

        # Run extraction
        chain = prompt | structured_llm
        result = chain.invoke({"text": post_text})

        # Convert to list of dicts
        events = [event.dict() for event in result.events]
        logger.info(f"Extracted {len(events)} events using LLM")
        return events

    except Exception as e:
        logger.error(f"LLM date extraction failed: {e}")
        return []

def extract_dates_with_dateparser(post_text: str) -> List[Dict]:
    """
    Fallback date extraction using dateparser and spacy.

    Args:
        post_text (str): The text content of the Piazza post.

    Returns:
        List of extracted events with date, type, title, and confidence
    """

    events = []

    try:
        # Try parsing the entire text first
        parsed_date = dateparser.parse(
            post_text,
            settings={
                "PREFER_DATES_FROM": "future",
                "RETURN_AS_TIMEZONE_AWARE": False
            }
        )

        if parsed_date:
            events.append({
                "date": parsed_date.strftime("%Y-%m-%d"),
                "event_type": "other",
                "title": post_text.strip()[:50],
                "confidence": 0.6
            })

        # Also try splitting by sentences and periods
        for separator in ['. ', '! ', '? ', '\n']:
            sentences = post_text.split(separator)

            for sentence in sentences:
                if not sentence.strip():
                    continue

                parsed_date = dateparser.parse(
                    sentence,
                    settings={
                        "PREFER_DATES_FROM": "future",
                        "RETURN_AS_TIMEZONE_AWARE": False
                    }
                )

                if parsed_date:
                    events.append({
                        "date": parsed_date.strftime("%Y-%m-%d"),
                        "event_type": "other",
                        "title": sentence.strip()[:50],
                        "confidence": 0.5
                    })

        logger.info(f"Extracted {len(events)} events using dateparser fallback")

    except Exception as e:
        logger.error(f"Dateparser extraction failed: {e}")

    return events

def extract_dates_from_post(post_text: str, use_llm: bool = True) -> List[Dict]:
    """
    Main function to extract dates from Piazza post text.

    Tries LLM-based extraction first, falls back to dateparser if needed.

    Args:
        post_text (str): The text content of the Piazza post.
        use_llm: Whether to use LLM (defaults to True)

    Returns:
        List of extracted events: [{"date": "2024-03-15", "event_type": "exam", "title": "Midterm", "confidence": 0.95}]
    """
    if not post_text or not post_text.strip():
        return []

    events = []

    # Try LLM extraction first
    if use_llm:
        events = extract_dates_with_llm(post_text)

    # Fallback to dateparser if LLM found nothing
    if not events:
        logger.info("Falling back to dateparser for date extraction")
        events = extract_dates_with_dateparser(post_text)

    # Remove duplicates and sort by confidence
    seen_dates = set()
    unique_events = []

    for event in sorted(events, key=lambda x: x["confidence"], reverse=True):
        if event["date"] not in seen_dates:
            seen_dates.add(event["date"])

            try:
                dt = datetime.fromisoformat(event["date"])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                event["date"] = dt.isoformat()
            except ValueError:
                pass
            unique_events.append(event)

    logger.info(f"Final result: {len(unique_events)} unique events extracted")
    return unique_events

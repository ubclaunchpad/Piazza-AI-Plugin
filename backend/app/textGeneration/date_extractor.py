"""
AI-powered date extraction from Piazza posts for calendar integration.

Uses ChatGroq with structured output to identify dates, event types, and titles.
Falls back to dateparser for additional date detection.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List
from zoneinfo import ZoneInfo

import dateparser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field, SecretStr

logger = logging.getLogger(__name__)
VANCOUVER_TZ = ZoneInfo("America/Vancouver")


def _format_time_label(iso_value: str) -> str:
    """Format ISO datetime into a user-friendly Vancouver time label."""
    dt = datetime.fromisoformat(iso_value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=VANCOUVER_TZ)
    else:
        dt = dt.astimezone(VANCOUVER_TZ)
    return dt.strftime("%b %d %I:%M %p")


def _compose_event_name(base_name: str, start_time: str, end_time: str) -> str:
    """
    Ensure event_name includes start/end time context when available.
    """
    base = (base_name or "Detected Event").strip()

    try:
        start_label = _format_time_label(start_time) if start_time else ""
    except Exception:
        start_label = ""

    try:
        end_label = _format_time_label(end_time) if end_time else ""
    except Exception:
        end_label = ""

    if start_label and end_label:
        return f"{base} ({start_label} - {end_label})"
    if start_label:
        return f"{base} ({start_label})"
    return base


class ExtractedEvent(BaseModel):
    """Schema for extracted event data."""

    event_name: str = Field(description="Brief title for the event.")
    event_type: str = Field(
        description="Type of the event: assignment, exam, office_hours, deadline, meeting, or other"
    )
    start_time: str = Field(
        description="Event start datetime in ISO 8601 format with timezone."
    )
    end_time: str = Field(
        description="Event end datetime in ISO 8601 format with timezone."
    )
    display_text: str = Field(description="Short user-facing event description.")
    confidence: float = Field(
        description="Confidence score for the extraction between 0 and 1"
    )


class DateExtractionResult(BaseModel):
    """Container for all extracted events."""

    events: List[ExtractedEvent] = Field(default_factory=list)


class ThreadInput(BaseModel):
    """Structured Piazza thread input."""

    threadId: str
    piazzaCourseId: str
    threadSummary: str
    threadUpdatedAt: str
    threadContent: str


def extract_dates_with_llm(post_text: str) -> List[Dict]:
    """
    Extract dates and event details from post text using ChatGroq.

    Args:
        post_text (str): The text content of the Piazza post.

    Returns:
        List of extracted events in calendar UI shape.
    """

    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.debug("GROQ_API_KEY not set - skipping LLM extraction")
            return []

        llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, api_key=SecretStr(api_key))

        structured_llm = llm.with_structured_output(DateExtractionResult)

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are an expert at extracting academic event dates from text.
Your task is to identify all mentions of dates and their associated events in Piazza posts.

Event types to look for:
- assignment: homework, assignments, projects
- exam: midterms, finals, quizzes, tests
- office_hours: TA/professor office hours
- deadline: submission deadlines, project milestones
- meeting: study groups, team meetings
- other: any other time-sensitive event

For each date found:
1. Return start_time and end_time in ISO 8601 (timezone-aware if possible).
2. If only a date is known, choose a reasonable default one-hour slot.
3. Use Vancouver timezone (America/Vancouver) for inferred/local times.
4. Identify the event type from the list above.
5. Create event_name (max 40 chars) and display_text (short, readable).
6. Assign confidence score (0-1) based on how clearly the date/event is mentioned.

Examples:
- "Assignment 3 is due next Friday" → start_time/end_time, type: assignment, event_name: "Assignment 3 Due"
- "Midterm on March 15th" → start_time/end_time, type: exam, event_name: "Midterm Exam"
- "Office hours this Thursday 2-4pm" → start_time/end_time, type: office_hours, event_name: "Office Hours"

Return an empty list if no dates are found.""",
                ),
                (
                    "human",
                    "Extract all dates and events from this Piazza post:\n\n{text}",
                ),
            ]
        )

        # Run extraction
        chain = prompt | structured_llm
        result = chain.invoke({"text": post_text})

        # Normalize model/dict output to a list of event dicts.
        if isinstance(result, DateExtractionResult):
            extracted_events = result.events
        elif isinstance(result, dict):
            raw_events = result.get("events", [])
            extracted_events = [
                event if isinstance(event, ExtractedEvent) else ExtractedEvent(**event)
                for event in raw_events
                if isinstance(event, (ExtractedEvent, dict))
            ]
        else:
            extracted_events = []

        events = [event.model_dump() for event in extracted_events]
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
        List of extracted events in calendar UI shape.
    """

    events = []

    try:
        # Try parsing the entire text first
        parsed_date = dateparser.parse(
            post_text,
            settings={"PREFER_DATES_FROM": "future", "RETURN_AS_TIMEZONE_AWARE": False},
        )

        if parsed_date:
            if parsed_date.tzinfo is None:
                parsed_date = parsed_date.replace(tzinfo=VANCOUVER_TZ)
            else:
                parsed_date = parsed_date.astimezone(VANCOUVER_TZ)
            end_dt = parsed_date + timedelta(hours=1)
            events.append(
                {
                    "event_name": "Detected Event",
                    "event_type": "other",
                    "start_time": parsed_date.isoformat(),
                    "end_time": end_dt.isoformat(),
                    "display_text": post_text.strip()[:80],
                    "confidence": 0.6,
                }
            )

        # Also try splitting by sentences and periods
        for separator in [". ", "! ", "? ", "\n"]:
            sentences = post_text.split(separator)

            for sentence in sentences:
                if not sentence.strip():
                    continue

                parsed_date = dateparser.parse(
                    sentence,
                    settings={
                        "PREFER_DATES_FROM": "future",
                        "RETURN_AS_TIMEZONE_AWARE": False,
                    },
                )

                if parsed_date:
                    if parsed_date.tzinfo is None:
                        parsed_date = parsed_date.replace(tzinfo=VANCOUVER_TZ)
                    else:
                        parsed_date = parsed_date.astimezone(VANCOUVER_TZ)
                    end_dt = parsed_date + timedelta(hours=1)
                    events.append(
                        {
                            "event_name": "Detected Event",
                            "event_type": "other",
                            "start_time": parsed_date.isoformat(),
                            "end_time": end_dt.isoformat(),
                            "display_text": sentence.strip()[:80],
                            "confidence": 0.5,
                        }
                    )

        logger.info(f"Extracted {len(events)} events using dateparser fallback")

    except Exception as e:
        logger.error(f"Dateparser extraction failed: {e}")

    return events


def extract_dates_from_post(thread_input: ThreadInput, use_llm: bool = True) -> List[Dict]:
    """
    Main function to extract dates from structured Piazza thread input.

    Tries LLM-based extraction first, falls back to dateparser if needed.

    Args:
        thread_input (ThreadInput): The structured thread input.
        use_llm: Whether to use LLM (defaults to True)

    Returns:
        List of extracted events:
        [{"event_name":"Midterm","event_type":"exam","start_time":"...","end_time":"...","display_text":"...","confidence":0.95}]
    """
    normalized_text = "\n".join(
        part
        for part in [
            thread_input.threadSummary.strip(),
            thread_input.threadContent.strip(),
            (
                f"Metadata: thread_id={thread_input.threadId}, "
                f"course_id={thread_input.piazzaCourseId}, "
                f"thread_updated_at={thread_input.threadUpdatedAt}"
            ),
        ]
        if part
    ).strip()

    if not normalized_text or not normalized_text.strip():
        return []

    events = []

    # Try LLM extraction first
    if use_llm:
        events = extract_dates_with_llm(normalized_text)

    # Fallback to dateparser if LLM found nothing
    if not events:
        logger.info("Falling back to dateparser for date extraction")
        events = extract_dates_with_dateparser(normalized_text)

    # Remove duplicates by start_time and sort by confidence
    seen_start_times = set()
    unique_events = []

    for event in sorted(events, key=lambda x: x["confidence"], reverse=True):
        start_time = event.get("start_time")
        if not start_time or start_time in seen_start_times:
            continue

        seen_start_times.add(start_time)

        try:
            start_dt = datetime.fromisoformat(event["start_time"])
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=VANCOUVER_TZ)
            else:
                start_dt = start_dt.astimezone(VANCOUVER_TZ)
            event["start_time"] = start_dt.isoformat()

            end_raw = event.get("end_time")
            if end_raw:
                end_dt = datetime.fromisoformat(end_raw)
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=VANCOUVER_TZ)
                else:
                    end_dt = end_dt.astimezone(VANCOUVER_TZ)
                event["end_time"] = end_dt.isoformat()
            else:
                event["end_time"] = (start_dt + timedelta(hours=1)).isoformat()
        except ValueError:
            # Ignore invalid datetime format from model/fallback output.
            continue

        event.setdefault("event_name", "Detected Event")
        event.setdefault("event_type", "other")
        event.setdefault("display_text", event["event_name"])
        event.setdefault("confidence", 0.5)
        event["event_name"] = _compose_event_name(
            event["event_name"],
            event.get("start_time", ""),
            event.get("end_time", ""),
        )
        unique_events.append(event)

    logger.info(f"Final result: {len(unique_events)} unique events extracted")
    return unique_events

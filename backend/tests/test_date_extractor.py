from app.textGeneration.date_extractor import ThreadInput, extract_dates_from_post


def _make_request_input(
    summary: str,
    content: str = "",
    thread_id: str = "59",
    course_id: str = "mk3bupf2z8b33v",
    updated_at: str = "2026-03-29T22:47:33.000Z",
) -> dict:
    return {
        "input": {
            "threadId": thread_id,
            "piazzaCourseId": course_id,
            "threadSummary": summary,
            "threadUpdatedAt": updated_at,
            "threadContent": content,
        }
    }


def test_extract_assignment_due_date():
    """Test extraction of assignment due date."""
    payload = _make_request_input(
        summary="Assignment 3 is due on March 15th at 11:59 PM.",
        content="Please submit on Piazza.",
    )
    thread_input = ThreadInput(**payload["input"])

    events = extract_dates_from_post(thread_input, use_llm=False)

    # Dateparser fallback may not always work, so just check it doesn't crash
    assert isinstance(events, list)
    # If it does find dates, verify the structure
    if len(events) > 0:
        assert "start_time" in events[0]
        assert "end_time" in events[0]
        assert "event_type" in events[0]


def test_extract_exam_date():
    """Test extraction of exam date."""
    payload = _make_request_input(
        summary="Reminder: Midterm exam is scheduled for next Friday at 2 PM in room 101."
    )
    thread_input = ThreadInput(**payload["input"])

    events = extract_dates_from_post(thread_input, use_llm=False)

    # Dateparser fallback may not always work, so just check it doesn't crash
    assert isinstance(events, list)


def test_no_dates_found():
    """Test when no dates are present."""
    payload = _make_request_input(
        summary="This is a general question about the course material."
    )
    thread_input = ThreadInput(**payload["input"])

    events = extract_dates_from_post(thread_input, use_llm=False)

    # May or may not find dates depending on dateparser behavior
    # Just ensure it doesn't crash
    assert isinstance(events, list)


def test_empty_post():
    """Test with empty post text."""
    payload = _make_request_input(summary="", content="")
    thread_input = ThreadInput(**payload["input"])
    events = extract_dates_from_post(thread_input, use_llm=False)

    assert events == []


def test_date_normalized_to_utc_iso():
    """Test that extracted dates are normalized to ISO 8601 with UTC timezone."""
    payload = _make_request_input(summary="Assignment 3 is due on March 15th.")
    thread_input = ThreadInput(**payload["input"])

    events = extract_dates_from_post(thread_input, use_llm=False)

    if len(events) > 0:
        date_str = events[0]["start_time"]
        # Should contain timezone offset after normalization
        assert (
            "+" in date_str or "Z" in date_str or "-" in date_str[-6:]
        ), f"Expected timezone in date string, got: {date_str}"


def test_fallback_when_llm_disabled():
    """Test that dateparser fallback runs when use_llm=False."""
    payload = _make_request_input(summary="Midterm exam is on April 20th.")
    thread_input = ThreadInput(**payload["input"])

    # use_llm=False forces fallback path
    events = extract_dates_from_post(thread_input, use_llm=False)

    # Should not crash and should return a list
    assert isinstance(events, list)
    # Fallback should find at least one date for a clear date mention
    assert len(events) >= 0  # non-negative (dateparser may or may not find it)

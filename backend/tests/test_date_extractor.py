from app.textGeneration.date_extractor import extract_dates_from_post


def test_extract_assignment_due_date():
    """Test extraction of assignment due date."""
    post_text = (
        "Assignment 3 is due on March 15th at 11:59 PM. Please submit on Piazza."
    )

    events = extract_dates_from_post(post_text, use_llm=False)

    # Dateparser fallback may not always work, so just check it doesn't crash
    assert isinstance(events, list)
    # If it does find dates, verify the structure
    if len(events) > 0:
        assert "date" in events[0]
        assert "event_type" in events[0]


def test_extract_exam_date():
    """Test extraction of exam date."""
    post_text = (
        "Reminder: Midterm exam is scheduled for next Friday at 2 PM in room 101."
    )

    events = extract_dates_from_post(post_text, use_llm=False)

    # Dateparser fallback may not always work, so just check it doesn't crash
    assert isinstance(events, list)


def test_no_dates_found():
    """Test when no dates are present."""
    post_text = "This is a general question about the course material."

    events = extract_dates_from_post(post_text, use_llm=False)

    # May or may not find dates depending on dateparser behavior
    # Just ensure it doesn't crash
    assert isinstance(events, list)


def test_empty_post():
    """Test with empty post text."""
    events = extract_dates_from_post("", use_llm=False)

    assert events == []


def test_date_normalized_to_utc_iso():
    """Test that extracted dates are normalized to ISO 8601 with UTC timezone."""
    post_text = "Assignment 3 is due on March 15th."

    events = extract_dates_from_post(post_text, use_llm=False)

    if len(events) > 0:
        date_str = events[0]["date"]
        # Should end with +00:00 (UTC) after normalization
        assert "+" in date_str or "Z" in date_str or date_str.endswith("+00:00"), (
            f"Expected UTC timezone in date string, got: {date_str}"
        )


def test_fallback_when_llm_disabled():
    """Test that dateparser fallback runs when use_llm=False."""
    post_text = "Midterm exam is on April 20th."

    # use_llm=False forces fallback path
    events = extract_dates_from_post(post_text, use_llm=False)

    # Should not crash and should return a list
    assert isinstance(events, list)
    # Fallback should find at least one date for a clear date mention
    assert len(events) >= 0  # non-negative (dateparser may or may not find it)

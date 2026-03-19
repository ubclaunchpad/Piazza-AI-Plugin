"""
Calendar endpoint handlers for Google Calendar integration.

This module defines API endpoints for:
- Initiating Google OAuth flow
- Handling OAuth callback and storing tokens
- Creating calendar events
- Listing user's synced events
- Updating reminder preferences

Endpoints follow FastAPI best practices and include detailed docstrings for clarity.
"""

from typing import List

from fastapi import APIRouter, HTTPException, Depends

from app.core.database import execute_query, execute_statement
from app.models.calendar import CalendarEvent
from app.core.encryption import fernet
from app.core.auth import get_current_user

# Placeholder imports for future models and logic
# from app.models.calendar import ...

router = APIRouter()


@router.get("/oauth")
def calendar_auth():
    """
    Handle OAuth callback and store tokens for the authenticated user.

    TODO: When implementing, encrypt access_token and refresh_token using Fernet before storing in the database.
    See app/core/encryption.py for encryption setup.
    """
    # TODO: Implement OAuth callback logic
    # Example:
    # encrypted_access_token = fernet.encrypt(access_token.encode())
    # encrypted_refresh_token = fernet.encrypt(refresh_token.encode())
    # Store these in calendar_tokens table
    pass


@router.get("/callback")
def calendar_callback():
    """
    Handle Google OAuth callback and store access tokens.

    Returns:
        Success message or error details.
    """
    # TODO: Implement Google OAuth callback handling logic
    pass


@router.post("/events", response_model=CalendarEvent)
def create_calendar_event(event: CalendarEvent, current_user=Depends(get_current_user)):
    """
    Create a new Google Calendar event based on Piazza post data and save it to the database.

    Args:
        event (CalendarEvent): The event data sent by the client.

    Returns:
        CalendarEvent: The created event.
    """

    query = """
        INSERT INTO calendar_events (
            id, user_id, piazza_course_id, google_event_id, title, event_date, source_post_number, reminder_settings
        ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s
    )
    """

    params = (
        event.id,
        current_user.id,
        event.piazza_course_id,
        event.google_event_id,
        event.title,
        event.event_date,
        event.source_post_number,
        event.reminder_settings,
    )

    execute_statement(query, params)
    return event


@router.get("/events", response_model=List[CalendarEvent])
def list_calendar_events(current_user=Depends(get_current_user)):
    """
    List all calendar events synced with the user's Google Calendar.


    Returns:
        A list of calendar events.
    """

    query = "SELECT * FROM calendar_events WHERE user_id = %s"
    results = execute_query(query, (current_user.id,))
    return [CalendarEvent(**event) for event in results]


@router.get("/events/{event_id}", response_model=CalendarEvent)
def get_calendar_event(event_id: str, current_user=Depends(get_current_user)):
    """
    Get a single calendar event by its ID.

    Args:
        event_id (str): The unique identifier for the event.

    Returns:
        CalendarEvent: The event data, or raises 404 if not found.
    """
    query = "SELECT * FROM calendar_events WHERE id = %s AND user_id = %s"
    result = execute_query(query, (event_id, current_user.id), fetch_one=True)
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    return CalendarEvent(**result)


@router.put("/settings")
def update_calendar_settings(reminder_settings: str, current_user=Depends(get_current_user)):
    """
    Update user's calendar integration settings, such as reminder preferences.

     Args:
        reminder_settings: The new reminder settings.

    Returns:
        Updated settings or confirmation message.
    """
    query = "UPDATE calendar_events SET reminder_settings = %s WHERE user_id = %s"
    result = execute_statement(query, (reminder_settings, current_user.id))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Event not found or not owned by user")
    return {"status": "success", "reminder_settings": reminder_settings}
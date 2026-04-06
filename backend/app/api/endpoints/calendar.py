"""
Calendar endpoint handlers for Google Calendar integration.

Features:
- Google OAuth flow (auth + callback)
- Token storage & refresh
- Create Google Calendar events + store in DB
- List and retrieve events
- Check user connection status
- Update reminder settings
"""

import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import google_auth_oauthlib.flow
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from psycopg2.extras import Json
from pydantic import BaseModel

from app.core.database import execute_query, execute_statement
from app.core.supabase import supabase

router = APIRouter()
logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
REDIRECT_URI = "http://localhost:8000/api/v1/calendar/callback"


# =====================================
# Auth - Supabase User
# =====================================
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)

        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user
    except Exception as e:
        logger.error("Authentication failed: %s", e)
        raise HTTPException(status_code=401, detail=str(e))


# =====================================
# Google OAuth Config
# =====================================
def get_google_client_config():
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": os.getenv("GOOGLE_CLIENT_PROJECT_ID"),
            "auth_uri": os.getenv("GOOGLE_CLIENT_AUTH_URI"),
            "token_uri": os.getenv("GOOGLE_CLIENT_TOKEN_URI"),
            "auth_provider_x509_cert_url": os.getenv(
                "GOOGLE_CLIENT_AUTH_PROVIDER_X509_CERT_URL"
            ),
            "client_secret": os.getenv("GOOGLE_CLIENT_CLIENT_SECRET"),
            "redirect_uris": os.getenv("GOOGLE_CLIENT_REDIRECT_URIS"),
        }
    }


# =====================================
# Step 1 - Start OAuth
# =====================================
@router.get("/auth")
async def calendar_auth(token: Optional[str] = Query(None)):
    user = await get_current_user(token)

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        get_google_client_config(),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    state = base64.urlsafe_b64encode(
        json.dumps({"user_id": str(user.id)}).encode()
    ).decode()

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )

    return RedirectResponse(auth_url)


# =====================================
# Step 2 - OAuth Callback
# =====================================
@router.get("/callback")
async def calendar_callback(state: str, code: str):
    try:
        decoded = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
        user_id = decoded["user_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        get_google_client_config(),
        scopes=SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI,
    )

    flow.fetch_token(code=code)
    creds = flow.credentials

    # Use update-then-insert instead of ON CONFLICT to support older schemas
    # where calendar_tokens.user_id may not yet be uniquely constrained.
    updated = execute_statement(
        """
        UPDATE calendar_tokens
        SET access_token = %s,
            refresh_token = %s,
            expires_at = %s,
            updated_at = NOW()
        WHERE user_id = %s
        """,
        (creds.token, creds.refresh_token, creds.expiry, user_id),
    )
    if updated == 0:
        execute_statement(
            """
            INSERT INTO calendar_tokens (
                user_id, access_token, refresh_token, expires_at
            )
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, creds.token, creds.refresh_token, creds.expiry),
        )

    return RedirectResponse("https://piazza.com")


# =====================================
# Helper - Get Valid Credentials
# =====================================
def get_valid_google_credentials(user_id: str):
    record = execute_query(
        """
        SELECT access_token, refresh_token, expires_at
        FROM calendar_tokens
        WHERE user_id = %s
        """,
        (user_id,),
        fetch_one=True,
    )

    if not record:
        return None

    creds = Credentials(
        token=record["access_token"],
        refresh_token=record["refresh_token"],
        token_uri=os.getenv("GOOGLE_CLIENT_TOKEN_URI"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_CLIENT_SECRET"),
        scopes=SCOPES,
    )

    expires_at = record["expires_at"]

    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= datetime.now(timezone.utc):
            creds.refresh(Request())

            execute_statement(
                """
                UPDATE calendar_tokens
                SET access_token = %s,
                    expires_at = %s,
                    updated_at = NOW()
                WHERE user_id = %s
                """,
                (creds.token, creds.expiry, user_id),
            )

    return creds


# =====================================
# User Status Endpoint
# =====================================
@router.get("/user/{user_id}")
async def get_calendar_status(
    user_id: str,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    if str(user.id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    creds = get_valid_google_credentials(user_id)
    if not creds:
        raise HTTPException(404, "Google Calendar not connected")

    expiry = creds.expiry.isoformat() if creds.expiry else None
    return {
        "connected": True,
        "expires_at": expiry,
        "token_expires_at": expiry,
        "has_refresh_token": bool(creds.refresh_token),
    }


# =====================================
# Request Models
# =====================================
class AddEventRequest(BaseModel):
    title: str
    start_time: str
    end_time: str
    piazza_course_id: Optional[str] = None
    source_post_number: Optional[str] = None
    reminder_settings: Optional[Dict[str, Any]] = None


# =====================================
# Create Event
# =====================================
@router.post("/events")
async def create_calendar_event(
    event: AddEventRequest,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    creds = get_valid_google_credentials(user.id)
    if not creds:
        raise HTTPException(401, "Google not connected")

    service = build("calendar", "v3", credentials=creds)

    google_event = (
        service.events()
        .insert(
            calendarId="primary",
            body={
                "summary": event.title,
                "start": {"dateTime": event.start_time, "timeZone": "UTC"},
                "end": {"dateTime": event.end_time, "timeZone": "UTC"},
            },
        )
        .execute()
    )

    try:
        execute_statement(
            """
            INSERT INTO calendar_events (
                user_id,
                piazza_course_id,
                google_event_id,
                title,
                event_start_at,
                event_end_at,
                source_post_number,
                reminder_settings
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(user.id),
                event.piazza_course_id,
                google_event["id"],
                event.title,
                event.start_time,
                event.end_time,
                event.source_post_number,
                Json(event.reminder_settings) if event.reminder_settings else None,
            ),
        )
    except Exception:
        logger.exception("DB insert failed after Google event creation")
        raise HTTPException(
            500,
            f"Google event created but DB failed. event_id={google_event['id']}",
        )

    return {
        "status": "created",
        "google_event_id": google_event["id"],
        "link": google_event.get("htmlLink"),
    }


# =====================================
# List Events
# =====================================
@router.get("/events", response_model=List[Dict[str, Any]])
async def list_calendar_events(
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    results = execute_query(
        "SELECT * FROM calendar_events WHERE user_id = %s",
        (str(user.id),),
    )

    return results


# =====================================
# Check Existing Event By Source Post
# =====================================
@router.get("/events/by-source")
async def get_event_by_source(
    source_post_number: str = Query(..., min_length=1),
    piazza_course_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    """
    Return whether a calendar event already exists for a post/course for the user.
    Also tries to return the Google Calendar HTML link for opening the event.
    """
    user = await get_current_user(authorization)

    course_id = piazza_course_id.strip() if piazza_course_id else None
    post_num = source_post_number.strip()

    if course_id:
        result = execute_query(
            """
            SELECT id, google_event_id
            FROM calendar_events
            WHERE user_id = %s
              AND source_post_number = %s
              AND piazza_course_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (str(user.id), post_num, course_id),
            fetch_one=True,
        )
    else:
        result = execute_query(
            """
            SELECT id, google_event_id
            FROM calendar_events
            WHERE user_id = %s
              AND source_post_number = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (str(user.id), post_num),
            fetch_one=True,
        )

    if not result:
        return {"exists": False}

    html_link = None
    google_event_id = result.get("google_event_id")
    if google_event_id:
        try:
            creds = get_valid_google_credentials(str(user.id))
            if creds:
                service = build("calendar", "v3", credentials=creds)
                event = (
                    service.events()
                    .get(calendarId="primary", eventId=google_event_id)
                    .execute()
                )
                html_link = event.get("htmlLink")
        except Exception as e:
            logger.warning(
                "Failed to resolve htmlLink for event_id=%s: %s", google_event_id, e
            )

    return {
        "exists": True,
        "event_id": result["id"],
        "google_event_id": google_event_id,
        "html_link": html_link,
    }


# =====================================
# Get Single Event
# =====================================
@router.get("/events/{event_id}")
async def get_calendar_event(
    event_id: str,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    result = execute_query(
        "SELECT * FROM calendar_events WHERE id = %s AND user_id = %s",
        (event_id, str(user.id)),
        fetch_one=True,
    )

    if not result:
        raise HTTPException(404, "Event not found")

    return result


# =====================================
# Update Reminder Settings
# =====================================
@router.put("/settings")
async def update_calendar_settings(
    reminder_settings: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    execute_statement(
        """
        UPDATE calendar_events
        SET reminder_settings = %s
        WHERE user_id = %s
        """,
        (Json(reminder_settings), str(user.id)),
    )

    return {"status": "updated"}


@router.post("/events/parse-thread")
async def parse_article_for_event(
    payload: str,
):
    """
    Temporary endpoint that pretends to parse the article content
    and returns a hard-coded example result.

    In the future this should run real NLP/date extraction on
    `payload.content` and return structured event information.
    """

    return {
        "status": "ok",
        "parsed_event": {
            "event_name": "Midterm 1 CPSC 340",
            "event_type": "exam",
            "start_time": "2026-02-28T11:00:00-08:00",
            "end_time": "2026-02-28T12:00:00-08:00",
            "display_text": "Midterm 1 (CPSC 340) on Feb 28, 2026 from 11:00 AM to 12:00 PM",
            "confidence": 0.9,
        },
    }

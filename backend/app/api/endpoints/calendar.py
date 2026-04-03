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

import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import google_auth_oauthlib.flow
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request  # IMPORTANT
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
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


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
# Step 1 - Start Google OAuth
# =====================================


@router.get("/auth")
async def calendar_auth(token: Optional[str] = Query(None)):
    """
    Handle OAuth callback and store tokens for the authenticated user.
    """
    user = await get_current_user(token)

    client_config = get_google_client_config()

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    state_data = base64.urlsafe_b64encode(
        json.dumps({"user_id": str(user.id)}).encode()
    ).decode()

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state_data,
    )

    return RedirectResponse(authorization_url)


# =====================================
# Step 2 - Google Callback
# =====================================


@router.get("/callback")
async def calendar_callback(state: str, code: str):
    """
    Handle Google OAuth callback and store access tokens.

    Returns:
        Success message or error details.
    """
    try:
        # Decode OAuth state
        decoded = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
        user_id = decoded["user_id"]

    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Recreate OAuth flow
    client_config = get_google_client_config()

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config, scopes=SCOPES, state=state, redirect_uri=REDIRECT_URI
    )

    # Exchange code for tokens
    flow.fetch_token(code=code)

    credentials = flow.credentials

    # Store tokens for this user
    execute_statement(
        """
        INSERT INTO calendar_tokens (
            user_id,
            access_token,
            refresh_token,
            expires_at
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW();
        """,
        (
            user_id,
            credentials.token,
            credentials.refresh_token,
            credentials.expiry,
        ),
    )

    # Redirect user back to Piazza
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

    access_token = record["access_token"]
    refresh_token = record["refresh_token"]
    expires_at = record["expires_at"]

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=os.getenv("GOOGLE_CLIENT_TOKEN_URI"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_CLIENT_SECRET"),
        scopes=SCOPES,
    )

    # Ensure timezone-aware expiry
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
# Google Calendar connection for a user
# =====================================


@router.get("/user/{user_id}")
async def get_calendar_google_status(
    user_id: str,
    authorization: Optional[str] = Header(None),
):
    """
    Check whether Google Calendar OAuth tokens exist and are valid for this user.

    Uses the same logic as ``get_valid_google_credentials`` (including refresh
    if the access token is expired). Does not return secrets.

    Full URL (typical): ``GET /api/v1/calendar/user/{user_id}``

    Returns **404** when no Google Calendar OAuth tokens exist for the user.

    The authenticated Supabase user must match ``user_id`` (prevents probing
    other accounts).
    """
    user = await get_current_user(authorization)
    if str(user.id) != user_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot access another user's calendar connection status",
        )

    creds = get_valid_google_credentials(user_id)
    if not creds:
        raise HTTPException(
            status_code=404,
            detail="Google Calendar is not linked for this user",
        )

    expiry = None
    if creds.expiry:
        exp = creds.expiry
        expiry = exp.isoformat() if hasattr(exp, "isoformat") else str(exp)

    return {
        "user_id": user_id,
        "google_calendar_connected": True,
        "token_expires_at": expiry,
        "has_refresh_token": bool(creds.refresh_token),
    }


# =====================================
# Add Event Endpoint
# =====================================


def _parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    v = str(value).strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


class PiazzaSourceContext(BaseModel):
    thread_summary: Optional[str] = None
    thread_updated_at: Optional[str] = None


class AddEventRequest(BaseModel):
    title: str
    start_time: str
    end_time: str
    piazza_course_id: Optional[str] = None
    source_post_number: Optional[str] = None
    source_context: Optional[PiazzaSourceContext] = None
    reminder_settings: Optional[Dict[str, Any]] = None


@router.post("/events")
async def create_calendar_event(
    event: AddEventRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Create the event in Google Calendar, then insert a matching row into ``calendar_events``.
    """
    user = await get_current_user(authorization)

    creds = get_valid_google_credentials(user.id)

    if not creds:
        raise HTTPException(status_code=401, detail="Google account not connected")

    service = build("calendar", "v3", credentials=creds)

    event_body = {
        "summary": event.title,
        "start": {
            "dateTime": event.start_time,
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": event.end_time,
            "timeZone": "UTC",
        },
    }

    created_event = (
        service.events()
        .insert(
            calendarId="primary",
            body=event_body,
        )
        .execute()
    )

    google_event_id = created_event["id"]
    start_dt = _parse_iso_datetime(event.start_time)
    end_dt = _parse_iso_datetime(event.end_time)

    merged_reminders: Dict[str, Any] = {}
    if event.reminder_settings:
        merged_reminders.update(event.reminder_settings)
    if event.source_context is not None:
        sc = event.source_context.model_dump(exclude_none=True)
        if sc:
            merged_reminders["piazza_source"] = sc

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
                google_event_id,
                event.title,
                start_dt,
                end_dt,
                event.source_post_number,
                Json(merged_reminders) if merged_reminders else None,
            ),
        )
    except Exception as e:
        logger.exception(
            "Google event created but calendar_events insert failed user=%s google_id=%s",
            user.id,
            google_event_id,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "Event was created in Google Calendar but could not be saved to the database. "
                f"google_event_id={google_event_id}. Error: {e!s}"
            ),
        )

    return {
        "status": "event_created",
        "event_id": google_event_id,
        "html_link": created_event.get("htmlLink"),
    }


class ParseArticleContentRequest(BaseModel):
    content: str


@router.post("/events/parse-thread")
async def parse_article_for_event(
    payload: ParseArticleContentRequest,
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
            "start_time": "2026-02-28T11:00:00",
            "end_time": "2026-02-28T12:00:00",
            "display_text": "Midterm 1 (CPSC 340) on Feb 28, 2026 from 11:00 AM to 12:00 PM",
            "confidence": 0.9,
        },
    }

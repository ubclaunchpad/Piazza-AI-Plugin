from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

import google_auth_oauthlib.flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request  # IMPORTANT

import os
import json
import base64
from datetime import datetime, timezone

from app.core.database import execute_statement, execute_query
from app.core.supabase import supabase

router = APIRouter()

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
        import logging

        logging.error(f"Authentication failed: {str(e)}")
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
    try:
        # Decode OAuth state
        decoded = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
        user_id = decoded["user_id"]

    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Recreate OAuth flow
    client_config = get_google_client_config()

    flow = google_auth_oauthlib.flow.Flow.from_client_config(client_config, scopes=SCOPES, state=state, redirect_uri=REDIRECT_URI)

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
# Add Event Endpoint
# =====================================

class AddEventRequest(BaseModel):
    title: str
    start_time: str
    end_time: str


@router.post("/events")
async def create_calendar_event(
    event: AddEventRequest,
    authorization: Optional[str] = Header(None),
):

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

    created_event = service.events().insert(
        calendarId="primary",
        body=event_body,
    ).execute()

    return {
        "status": "event_created",
        "event_id": created_event["id"],
        "html_link": created_event.get("htmlLink"),
    }
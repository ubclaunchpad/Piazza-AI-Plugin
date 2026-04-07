import base64
import json
import os
from datetime import datetime, timezone
from typing import Optional

import google_auth_oauthlib.flow
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.database import execute_statement, fetch_one
from app.core.supabase import supabase

router = APIRouter()

CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")

SCOPES = ["https://www.googleapis.com/auth/calendar"]

REDIRECT_URI = "http://localhost:8000/api/v1/calendar/callback"

PROVIDER = "google"


# =========================
# Supabase Auth
# =========================

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)

    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user.user


# =========================
# Step 1 - Start Google Linking
# =========================

@router.get("/auth")
async def calendar_auth(user=Depends(get_current_user)):

    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    # Encode user_id inside state
    state_data = base64.urlsafe_b64encode(
        json.dumps({"user_id": user.id}).encode()
    ).decode()

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state_data
    )

    return {"auth_url": authorization_url}


# =========================
# Step 2 - Google Callback
# =========================

@router.get("/callback")
async def calendar_callback(state: str, code: str):

    # Decode state
    decoded = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
    user_id = decoded["user_id"]

    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Save or update in DB
    execute_statement(
        """
        INSERT INTO oauth_accounts (
            user_id, provider, access_token, refresh_token, expires_at
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW();
        """,
        (
            user_id,
            PROVIDER,
            credentials.token,
            credentials.refresh_token,
            credentials.expiry,
        ),
    )

    # Redirect back to frontend
    return RedirectResponse("http://localhost:3000/calendar-linked")


# =========================
# Helper - Get Valid Credentials
# =========================

def get_valid_google_credentials(user_id: str):

    record = fetch_one(
        "SELECT access_token, refresh_token, expires_at FROM oauth_accounts WHERE user_id = %s AND provider = %s",
        (user_id, PROVIDER),
    )

    if not record:
        return None

    access_token, refresh_token, expires_at = record

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=None,
        client_secret=None,
        scopes=SCOPES,
    )

    # If expired -> refresh
    if expires_at <= datetime.now(timezone.utc):
        creds.refresh(Request())

        execute_statement(
            """
            UPDATE oauth_accounts
            SET access_token = %s,
                expires_at = %s,
                updated_at = NOW()
            WHERE user_id = %s AND provider = %s
            """,
            (creds.token, creds.expiry, user_id, PROVIDER),
        )

    return creds


# =========================
# Add Event Endpoint
# =========================

@router.post("/add-event")
async def add_calendar_event(
    title: str,
    start_time: str,
    end_time: str,
    user=Depends(get_current_user)
):

    creds = get_valid_google_credentials(user.id)

    if not creds:
        return {"action": "link_required"}

    service = build("calendar", "v3", credentials=creds)

    event = {
        "summary": title,
        "start": {"dateTime": start_time, "timeZone": "UTC"},
        "end": {"dateTime": end_time, "timeZone": "UTC"},
    }

    created_event = service.events().insert(
        calendarId="primary",
        body=event
    ).execute()

    return {
        "status": "event_created",
        "event_id": created_event["id"]
    }

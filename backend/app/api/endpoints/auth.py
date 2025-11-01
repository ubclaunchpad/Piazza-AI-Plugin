"""
Auth endpoint handler.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.database import execute_insert
from app.models.auth import SignUpRequest, SignUpResponse
from app.core.supabase import supabase

router = APIRouter()

@router.post("/signup", response_model=SignUpResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: SignUpRequest):
    """
    Create a new user account.

    Args:
        user_data: The user data for signup.

    Returns:
        User info and token

    Raises:
        HTTPException: 404 if missing required fields
        HTTPException: 409 if user already exists
        HTTPException: 422 for weak password
        HTTPException: 500 for Supabase or DB errors
    """
    try:
        # Create user in Supabase Auth
        # TODO: figure out why email confirmation is not working
        res = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {"display_name": user_data.display_name},
                # TODO: optional: where to land after clicking the confirm link
                # "email_redirect_to": "https://yourapp.com/auth/callback"
            }
        })
    except Exception as e:
        msg = str(e).lower()
        print(e)
        print(msg)
        # TODO: remove logs and improve error handling
        if "user already registered" in msg:
            raise HTTPException(status_code=409, detail=msg)
        if "password" in msg and ("weak" in msg or "invalid" in msg):
            raise HTTPException(status_code=422, detail="Weak password")
        raise HTTPException(status_code=500, detail=str(e))

    user = res.user
    session = res.session  # may be None if email confirmation required in GoTrue settings

    if not user or not getattr(user, "id", None):
        raise HTTPException(status_code=500, detail="Supabase did not return a user")

    # Store profile metadata (adjust table/columns to your schema)
    try:
        # TODO: test this part
        execute_insert(
            "INSERT INTO User (id, display_name, hashed_email) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (user.id, user_data.display_name, user_data.email)
        )
    except Exception as e:
        # Optional: you might want to delete the auth user on failure to keep consistency
        raise HTTPException(status_code=500, detail="Database error:" + str(e))

    # If email confirmation is ON, there's usually no session yet
    token = session.access_token if session else ""

    return SignUpResponse(
        user={"id": user.id, "name": user_data.display_name, "email": user_data.email},
        token=token
    )

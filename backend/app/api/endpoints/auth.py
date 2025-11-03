"""
Authentication endpoint handler for user registration.
"""

import logging
from hashlib import sha256

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.database import execute_insert
from app.core.supabase import supabase
from app.models.auth import SignUpRequest, SignUpResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/signup", response_model=SignUpResponse, status_code=status.HTTP_201_CREATED
)
def signup(user_data: SignUpRequest):
    """
    Register a new user via Supabase Auth and persist their profile to the local database.

    Workflow:
        1. Create a new user in Supabase Auth using the provided email and password.
        2. On success, hash the user's email and store profile metadata (id, display name, hashed email) in the `users` table.
        3. If database insertion fails, rollback the Supabase user to maintain consistency.

    Args:
        user_data (SignUpRequest): Contains the user's email, password, and display name.

    Returns:
        SignUpResponse: Basic user information (id, name, email).

    Raises:
        HTTPException:
            409 - if the email is already registered.
            422 - if the password is invalid or too weak.
            500 - if Supabase or database operations fail.
    """
    try:
        # Create a user in Supabase Auth.
        # The `email_redirect_to` defines where users land after confirming their email.
        res = supabase.auth.sign_up(
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {"display_name": user_data.display_name},
                    "email_redirect_to": settings.EMAIL_CONFIRM_REDIRECT_URL,
                },
            }
        )
    except Exception as e:
        msg = str(e).lower()
        # Handle common Supabase errors gracefully
        if "user already registered" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "password" in msg and ("invalid" in msg or "weak" in msg):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=msg
            )
        logger.exception("Supabase sign_up failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase signup failed: " + msg,
        )

    user = res.user
    if not user or not getattr(user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase did not return a valid user object",
        )

    try:
        # Store the user profile locally.
        # The email is hashed (lowercased, SHA-256) for privacy and consistency.
        email_hash = sha256(user_data.email.lower().encode("utf-8")).hexdigest()
        execute_insert(
            (
                "INSERT INTO users (id, display_name, hashed_email) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (id) DO NOTHING;"
            ),
            (user.id, user_data.display_name, email_hash),
            return_id=False,
        )
    except Exception:
        # If DB insertion fails, delete the Supabase Auth user to prevent orphaned records
        if user and getattr(user, "id", None):
            try:
                supabase.auth.admin.delete_user(user.id)
            except Exception:
                logger.exception("Failed to rollback Supabase user after DB error")
        logger.exception("Failed to persist user profile to database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating user profile",
        )

    return SignUpResponse(
        user={
            "id": user.id,
            "name": user_data.display_name,
            "email": user_data.email,
        }
    )

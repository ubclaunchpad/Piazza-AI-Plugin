"""
Authentication endpoint handler for user registration.
"""

import logging
from hashlib import sha256

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.database import execute_query, execute_statement
from app.core.supabase import supabase
from app.models.auth import (
    LoginRequest,
    LoginResponse,
    SignUpRequest,
    SignUpResponse,
)

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
        msg = str(e)
        msg_lc = msg.lower()
        # Handle common Supabase errors gracefully
        if "user already registered" in msg_lc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "password" in msg_lc and ("invalid" in msg_lc or "weak" in msg_lc):
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
        execute_statement(
            (
                "INSERT INTO users (id, display_name, hashed_email) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (id) DO NOTHING;"
            ),
            (user.id, user_data.display_name, email_hash),
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


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(credentials: LoginRequest):
    """
    Authenticate a user and return access tokens.

    Workflow:
        1. Authenticate with Supabase Auth using email and password.
        2. Check if the user's email is confirmed.
        3. Retrieve user profile from the local database.
        4. Return user data with access and refresh tokens.

    Args:
        credentials (LoginRequest): Contains the user's email and password.

    Returns:
        LoginResponse: User information, access token, refresh token, and expiry time.

    Raises:
        HTTPException:
            401 - if credentials are invalid or email is not confirmed.
            404 - if user profile is not found in database.
            500 - if Supabase or database operations fail.
    """
    try:
        # Authenticate with Supabase
        res = supabase.auth.sign_in_with_password(
            {"email": credentials.email, "password": credentials.password}
        )
    except Exception as e:
        msg = str(e)
        msg_lc = msg.lower()
        # Handle common authentication errors
        if "invalid" in msg_lc or "credentials" in msg_lc or "wrong" in msg_lc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if "email not confirmed" in msg_lc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please confirm your email before logging in. Check your inbox for the confirmation link.",
            )
        logger.exception("Supabase sign_in failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed: " + msg,
        )

    user = res.user
    session = res.session

    if not user or not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

    # Check if email is confirmed
    if not user.email_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please confirm your email before logging in. Check your inbox for the confirmation link.",
        )

    # Retrieve user profile from database
    try:
        user_profile = execute_query(
            "SELECT id, display_name, hashed_email FROM users WHERE id = %s",
            (user.id,),
            fetch_one=True,
        )
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve user profile from database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile",
        )

    return LoginResponse(
        user={
            "id": user.id,
            "name": user_profile["display_name"],
            "email": user.email,
        },
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in or 3600,
    )

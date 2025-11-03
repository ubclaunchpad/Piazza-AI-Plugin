"""
Auth endpoint handler.
"""
import logging
from hashlib import sha256

from fastapi import APIRouter, HTTPException, status

from app.core.database import execute_insert
from app.models.auth import SignUpRequest, SignUpResponse
from app.core.supabase import supabase
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/signup", response_model=SignUpResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: SignUpRequest):
    """
    Create a new user account.

    Args:
        user_data: The user data for signup (email, password, display_name).

    Returns:
        User info upon successful signup.

    Raises:
        HTTPException: 404 if missing required fields
        HTTPException: 409 if user already exists
        HTTPException: 422 for weak password (handled by emailStr)
        HTTPException: 500 for Supabase or DB errors
    """
    try:
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
        print(res.session)
    except Exception as e:
        msg = str(e).lower()
        if "user already registered" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "password" in msg and ("invalid" in msg or "weak" in msg):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=msg)
        logger.exception("Supabase sign_up failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)

    user = res.user
    session = res.session  # may be None if email confirmation required in GoTrue settings

    if not user or not getattr(user, "id", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase did not return a user")

    # Store profile metadata (adjust table/columns to your schema)
    try:
        # Store a privacy-preserving hash of the email rather than the raw email
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
    except Exception as e:
        # Optional: rollback auth user on failure to keep consistency
        if user and getattr(user, "id", None):
            try:
                supabase.auth.admin.delete_user(user.id)
            except Exception:
                logger.exception("Failed to rollback user creation in Supabase after DB error")
        logger.exception("Failed to persist user profile")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error while creating user")

    return SignUpResponse(
        user={"id": user.id, "name": user_data.display_name, "email": user_data.email}
    )

"""
Shared authentication dependencies for FastAPI endpoints.
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException

from app.core.supabase import supabase

logger = logging.getLogger(__name__)


async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Validate the Bearer token and return the authenticated Supabase user.

    Usage:
        @router.get("/protected")
        async def my_endpoint(user=Depends(get_current_user)):
            print(user.id)

    Raises:
        HTTPException 401: If the token is missing or invalid.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise HTTPException(
            status_code=401, detail=f"Authentication failed: {str(e)}"
        )

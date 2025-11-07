"""
models/piazza.py

Pydantic models for Piazza authentication and integration endpoints.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PiazzaLoginRequest(BaseModel):
    """
    Request body for /piazza/login.
    Represents a user's consent to link their Piazza account to ThreadSense.
    """
    user_id: str                      # ThreadSense user ID
    piazza_user_id: Optional[str] = None  # Optional Piazza account ID


class PiazzaLoginResponse(BaseModel):
    """
    Response returned after successful Piazza linkage.
    """
    status: str                       # e.g., "linked"
    message: str                      # Confirmation message
    linked_at: datetime               # Timestamp of linkage


class PiazzaLogoutRequest(BaseModel):
    """
    Request body for /piazza/logout.
    Usually empty, but may include optional metadata.
    """
    user_id: Optional[str] = None     # Optional explicit user ID (for admin/logging)


class PiazzaLogoutResponse(BaseModel):
    """
    Response returned after successful Piazza logout or revocation.
    """
    status: str                       # e.g., "disconnected"
    message: str                      # Confirmation message

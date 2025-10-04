"""
Pydantic models for request/response validation and database models.

This module contains all the data models used throughout the application.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class UserStatus(str, Enum):
    """User status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class UserBase(BaseModel):
    """Base user model with common fields."""

    name: str = Field(..., min_length=1, max_length=100, description="User's full name")
    email: str = Field(..., description="User's email address")
    age: Optional[int] = Field(None, ge=0, le=150, description="User's age")
    status: UserStatus = Field(
        default=UserStatus.ACTIVE, description="User's account status"
    )


class UserCreate(UserBase):
    """Model for creating a new user."""

    password: str = Field(..., min_length=6, description="User's password")


class UserResponse(UserBase):
    """Model for user responses (excludes sensitive data)."""

    id: int = Field(..., description="User's unique ID")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        # Allow the model to work with ORM objects
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class UserUpdate(BaseModel):
    """Model for updating user information."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=150)
    status: Optional[UserStatus] = None


# Export all models
__all__ = [
    "UserStatus",
    "UserBase",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
]

# TODO: Add SQLAlchemy database models when needed
# from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
# from sqlalchemy.orm import relationship
# from app.core.database import Base

# Example SQLAlchemy model:
# class User(Base):
#     __tablename__ = "users"
#
#     id = Column(Integer, primary_key=True)
#     email = Column(String, unique=True, nullable=False)
#     # Add more fields as needed

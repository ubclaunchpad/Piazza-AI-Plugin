"""
Example endpoint handler demonstrating FastAPI best practices.

This shows how to structure endpoints using models from the models module,
proper error handling, and API documentation.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException

# Import models from the models module
from app.models import UserCreate, UserResponse, UserStatus, UserUpdate

# Create router for this module
router = APIRouter()


# Mock data storage (replace with database later)
fake_users_db: List[dict] = [
    {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "age": 25,
        "status": UserStatus.ACTIVE,
        "created_at": datetime.now(),
        "updated_at": None,
    },
    {
        "id": 2,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "age": 30,
        "status": UserStatus.ACTIVE,
        "created_at": datetime.now(),
        "updated_at": None,
    },
]


# API Endpoints
@router.get("/users", response_model=List[UserResponse])
def get_users():
    """
    Get all users.

    Returns a list of all users in the system.
    """
    return fake_users_db


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    """
    Get a specific user by ID.

    Args:
        user_id: The unique identifier for the user

    Returns:
        User information

    Raises:
        HTTPException: 404 if user not found
    """
    user = next((user for user in fake_users_db if user["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users", response_model=UserResponse)
def create_user(user_data: UserCreate):
    """
    Create a new user.

    Args:
        user_data: User information for creation

    Returns:
        Created user information
    """
    # Check if email already exists
    if any(user["email"] == user_data.email for user in fake_users_db):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user (in a real app, you'd hash the password)
    new_user = {
        "id": len(fake_users_db) + 1,
        "name": user_data.name,
        "email": user_data.email,
        "age": user_data.age,
        "status": user_data.status,
        "created_at": datetime.now(),
        "updated_at": None,
    }

    fake_users_db.append(new_user)
    return new_user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_data: UserUpdate):
    """
    Update an existing user.

    Args:
        user_id: The unique identifier for the user
        user_data: Updated user information

    Returns:
        Updated user information

    Raises:
        HTTPException: 404 if user not found
    """
    user = next((user for user in fake_users_db if user["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update only provided fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        user[field] = value

    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int):
    """
    Delete a user.

    Args:
        user_id: The unique identifier for the user

    Returns:
        Success message

    Raises:
        HTTPException: 404 if user not found
    """
    user_index = next(
        (i for i, user in enumerate(fake_users_db) if user["id"] == user_id), None
    )
    if user_index is None:
        raise HTTPException(status_code=404, detail="User not found")

    deleted_user = fake_users_db.pop(user_index)
    return {"message": f"User '{deleted_user['name']}' deleted successfully"}


# Additional example endpoint with query parameters
@router.get("/users/search", response_model=List[UserResponse])
def search_users(
    name: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    status: Optional[UserStatus] = None,
    active_only: bool = True,
):
    """
    Search users with filters.

    Args:
        name: Filter by name (partial match)
        min_age: Minimum age filter
        max_age: Maximum age filter
        status: Filter by user status (active, inactive, suspended)
        active_only: Only return active users (overrides status filter)

    Returns:
        Filtered list of users
    """
    filtered_users = fake_users_db.copy()

    # Apply filters
    if active_only:
        filtered_users = [
            user for user in filtered_users if user["status"] == UserStatus.ACTIVE
        ]
    elif status:
        filtered_users = [user for user in filtered_users if user["status"] == status]

    if name:
        filtered_users = [
            user for user in filtered_users if name.lower() in user["name"].lower()
        ]

    if min_age is not None:
        filtered_users = [
            user
            for user in filtered_users
            if user.get("age") and user["age"] >= min_age
        ]

    if max_age is not None:
        filtered_users = [
            user
            for user in filtered_users
            if user.get("age") and user["age"] <= max_age
        ]

    return filtered_users

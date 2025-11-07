"""
Piazza authentication endpoints.

This module handles user authentication for Piazza integration,
including login and logout functionality with PostgreSQL/Supabase database integration.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import database connection utilities
from app.core.database import execute_query, execute_statement, execute_insert

# Import Piazza models
from app.models.piazza import (
    PiazzaLoginRequest,
    PiazzaLoginResponse,
    PiazzaLogoutRequest,
    PiazzaLogoutResponse,
)

# Create router for this module
router = APIRouter()

# Security scheme for Bearer token authentication
security = HTTPBearer()


def decode_token(token: str) -> str:
    """
    Decode JWT token to extract user_id.
    
    This is a stub implementation. In production, you would:
    - Verify JWT signature using your JWT library
    - Check token expiration
    - Extract user_id from payload
    
    Args:
        token: JWT token string
        
    Returns:
        user_id: ThreadSense user ID
        
    Raises:
        HTTPException: If token is invalid
    """
    if not token or len(token) < 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Mock user_id extraction (replace with actual JWT decoding)
    # For now, using a simple hash of the token
    import hashlib
    user_id = f"user_{hashlib.md5(token.encode()).hexdigest()[:8]}"
    return user_id


@router.post("/login", response_model=PiazzaLoginResponse)
async def login(request: PiazzaLoginRequest):
    """
    Link a ThreadSense user to a Piazza user account.
    
    This endpoint handles the consent handshake where a user agrees to link
    their ThreadSense account with their Piazza account for enhanced features.
    
    Args:
        request: PiazzaLoginRequest containing user_id and optional piazza_user_id
        
    Returns:
        PiazzaLoginResponse with status, message, and timestamp
        
    Raises:
        HTTPException: 400 for bad request, 500 for database errors
    """
    try:
        # Validate request
        if not request.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required"
            )
        
        current_time = datetime.now(timezone.utc)
        
        # Check if integration already exists for this user
        existing_query = """
            SELECT user_id, piazza_user_id, active, linked_at 
            FROM piazza_integrations 
            WHERE user_id = %s
        """
        
        existing = execute_query(
            existing_query, 
            (request.user_id,), 
            fetch_one=True
        )
        
        if existing:
            # Update existing record
            update_query = """
                UPDATE piazza_integrations 
                SET active = %s, linked_at = %s
            """
            params = [True, current_time]
            
            # Update piazza_user_id if provided
            if request.piazza_user_id:
                update_query += ", piazza_user_id = %s"
                params.append(request.piazza_user_id)
            
            update_query += " WHERE user_id = %s"
            params.append(request.user_id)
            
            affected_rows = execute_statement(update_query, tuple(params))
            
            if affected_rows == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update Piazza integration"
                )
            
            message = "Piazza integration reactivated successfully"
        else:
            # Insert new record
            insert_query = """
                INSERT INTO piazza_integrations (user_id, piazza_user_id, active, linked_at)
                VALUES (%s, %s, %s, %s)
            """
            
            execute_insert(
                insert_query,
                (request.user_id, request.piazza_user_id, True, current_time),
                return_id=False
            )
            
            message = "Piazza integration linked successfully"
        
        return PiazzaLoginResponse(
            status="linked",
            message=message,
            linked_at=current_time
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post("/logout", response_model=PiazzaLogoutResponse)
async def logout(
    request: PiazzaLogoutRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Revoke Piazza integration for a user.
    
    This endpoint deactivates the Piazza integration for the authenticated user,
    effectively revoking consent for the ThreadSense app to access Piazza data.
    
    Args:
        request: PiazzaLogoutRequest (may contain optional user_id for admin purposes)
        credentials: Bearer token credentials for authentication
        
    Returns:
        PiazzaLogoutResponse with status and confirmation message
        
    Raises:
        HTTPException: 401 for invalid token, 404 if integration not found, 500 for database errors
    """
    try:
        # Decode token to get user_id
        token = credentials.credentials
        user_id = decode_token(token)
        
        # Use user_id from token, or from request if provided (for admin purposes)
        target_user_id = request.user_id if request.user_id else user_id
        
        # Check if integration exists and is active
        check_query = """
            SELECT user_id, active 
            FROM piazza_integrations 
            WHERE user_id = %s AND active = true
        """
        
        existing = execute_query(
            check_query,
            (target_user_id,),
            fetch_one=True
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Piazza integration found for this user"
            )
        
        # Deactivate the integration
        deactivate_query = """
            UPDATE piazza_integrations 
            SET active = false 
            WHERE user_id = %s
        """
        
        affected_rows = execute_statement(deactivate_query, (target_user_id,))
        
        if affected_rows == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to deactivate Piazza integration"
            )
        
        return PiazzaLogoutResponse(
            status="disconnected",
            message=f"Piazza integration successfully disconnected for user {target_user_id}"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.get("/status")
async def get_integration_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get the current Piazza integration status for the authenticated user.
    
    Args:
        credentials: Bearer token credentials for authentication
        
    Returns:
        Integration status information
        
    Raises:
        HTTPException: 401 for invalid token, 500 for database errors
    """
    try:
        # Decode token to get user_id
        token = credentials.credentials
        user_id = decode_token(token)
        
        # Get integration status
        status_query = """
            SELECT user_id, piazza_user_id, active, linked_at
            FROM piazza_integrations 
            WHERE user_id = %s
        """
        
        integration = execute_query(
            status_query,
            (user_id,),
            fetch_one=True
        )
        
        if not integration:
            return {
                "user_id": user_id,
                "integrated": False,
                "active": False,
                "message": "No Piazza integration found"
            }
        
        return {
            "user_id": user_id,
            "integrated": True,
            "active": integration["active"],
            "piazza_user_id": integration["piazza_user_id"],
            "linked_at": integration["linked_at"],
            "message": "Integration found"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.get("/health")
async def piazza_health():
    """
    Health check endpoint for Piazza integration service.
    
    Returns:
        Service health status and statistics
    """
    try:
        # Get some basic statistics
        stats_query = """
            SELECT 
                COUNT(*) as total_integrations,
                COUNT(CASE WHEN active = true THEN 1 END) as active_integrations,
                COUNT(CASE WHEN active = false THEN 1 END) as inactive_integrations
            FROM piazza_integrations
        """
        
        stats = execute_query(stats_query, fetch_one=True)
        
        return {
            "status": "healthy",
            "service": "piazza_integration",
            # ✅ Use timezone-aware datetime instead of deprecated utcnow()
            "timestamp": datetime.now(timezone.utc),
            "statistics": {
                "total_integrations": stats["total_integrations"] if stats else 0,
                "active_integrations": stats["active_integrations"] if stats else 0,
                "inactive_integrations": stats["inactive_integrations"] if stats else 0
            }
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "piazza_integration",
            # ✅ Use timezone-aware datetime instead of deprecated utcnow()
            "timestamp": datetime.now(timezone.utc),
            "error": str(e)
        }
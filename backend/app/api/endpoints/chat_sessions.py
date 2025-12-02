from fastapi import APIRouter, HTTPException, Depends, Header, Query
from typing import List, Optional
from uuid import UUID

from app.core.database import execute_query, execute_insert, execute_statement
from app.models.chat_session import ChatSessionCreate, ChatSessionResponse, ChatSessionUpdate, ChatMessage
from app.core.supabase import supabase

router = APIRouter()

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception as e:
        import logging
        logging.error(f"Authentication failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@router.post("/chat-sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_data: ChatSessionCreate,
    user=Depends(get_current_user)
):
    """
    Create a new chat session.
    """
    try:
        # 1. Resolve thread_id from piazza_course_id
        # We need to find the UUID of the thread from the threads table
        thread_query = "SELECT id FROM threads WHERE piazza_course_id = %s"
        thread_result = execute_query(thread_query, (session_data.piazza_course_id,), fetch_one=True)
        
        if not thread_result:
            # If thread doesn't exist, we might want to create it or error.
            # For now, let's error as ingestion should have happened or at least the thread record should exist.
            # Actually, the ingestion flow creates the thread record.
            # If the user is on a page that hasn't been ingested, we might not have a record.
            # Let's try to insert a placeholder thread record if it doesn't exist.
            upsert_query = """
                INSERT INTO threads (piazza_course_id, thread_title, is_indexable, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (piazza_course_id) DO UPDATE SET updated_at = NOW()
                RETURNING id;
            """
            # We need to use execute_insert or execute_query with RETURNING
            # execute_insert is designed for this but returns ID.
            # Let's use execute_query to be safe with the RETURNING clause if execute_insert doesn't handle ON CONFLICT RETURNING perfectly in all cases (though it should).
            # Actually execute_insert implementation:
            # cursor.execute(query, params)
            # result = cursor.fetchone()
            # return result[0]
            
            thread_id = execute_insert(upsert_query, (
                session_data.piazza_course_id,
                f"Course {session_data.piazza_course_id}",
                True
            ))
        else:
            thread_id = thread_result['id']

        # 2. Create chat session
        insert_query = """
            INSERT INTO chat_sessions (user_id, thread_id, piazza_course_id, title)
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, thread_id, piazza_course_id, title, created_at, updated_at
        """
        
        # We use execute_query with fetch_one=True to get the full record back
        new_session = execute_query(insert_query, (
            user.id,
            thread_id,
            session_data.piazza_course_id,
            session_data.title
        ), fetch_one=True)
        
        return new_session

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")

@router.get("/chat-sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(
    piazza_course_id: str = Query(..., description="Filter by Piazza Course ID"),
    user=Depends(get_current_user)
):
    """
    Get all chat sessions for the current user and specific course.
    """
    try:
        query = """
            SELECT id, user_id, thread_id, piazza_course_id, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = %s AND piazza_course_id = %s
            ORDER BY updated_at DESC
        """
        sessions = execute_query(query, (user.id, piazza_course_id))
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chat sessions: {str(e)}")

@router.delete("/chat-sessions/{session_id}")
async def delete_chat_session(
    session_id: UUID,
    user=Depends(get_current_user)
):
    """
    Delete a chat session.
    """
    try:
        # Ensure the session belongs to the user
        query = "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s"
        affected = execute_statement(query, (str(session_id), user.id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Session not found or not authorized")
            
        return {"status": "success", "message": "Session deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@router.patch("/chat-sessions/{session_id}", response_model=ChatSessionResponse)
async def update_chat_session(
    session_id: UUID,
    update_data: ChatSessionUpdate,
    user=Depends(get_current_user)
):
    """
    Update a chat session (e.g. title).
    """
    try:
        query = """
            UPDATE chat_sessions
            SET title = %s, updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, thread_id, piazza_course_id, title, created_at, updated_at
        """
        updated_session = execute_query(query, (update_data.title, str(session_id), user.id), fetch_one=True)
        
        if not updated_session:
            raise HTTPException(status_code=404, detail="Session not found or not authorized")
            
        return updated_session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")

@router.get("/chat-sessions/{session_id}/messages", response_model=List[ChatMessage])
async def get_chat_session_messages(
    session_id: UUID,
    user=Depends(get_current_user)
):
    """
    Get messages for a specific chat session.
    """
    try:
        # Verify session ownership
        session_check = execute_query(
            "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s",
            (str(session_id), user.id),
            fetch_one=True
        )
        if not session_check:
            raise HTTPException(status_code=404, detail="Session not found or not authorized")

        # Fetch messages
        # The message column is JSONB, so we can return it directly
        query = """
            SELECT id, message, created_at
            FROM chat_messages
            WHERE session_id = %s
            ORDER BY created_at ASC
        """
        messages = execute_query(query, (str(session_id),))
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

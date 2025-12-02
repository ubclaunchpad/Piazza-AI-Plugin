from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class ChatSessionCreate(BaseModel):
    piazza_course_id: str
    title: Optional[str] = "New Chat"

class ChatSessionUpdate(BaseModel):
    title: str

class ChatSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    thread_id: UUID
    piazza_course_id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

class ChatMessage(BaseModel):
    id: UUID
    message: Dict[str, Any]
    created_at: datetime

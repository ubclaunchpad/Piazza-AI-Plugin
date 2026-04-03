from typing import Optional, Dict, Any  
from uuid import UUID  
from datetime import datetime  
from pydantic import BaseModel

class CalendarEvent(BaseModel):  
    id: UUID  
    user_id: UUID  
    piazza_course_id: UUID  
    google_event_id: Optional[str] = None  
    title: str  
    event_date: datetime  
    source_post_number: Optional[str] = None  
    reminder_settings: Optional[Dict[str, Any]] = None  
from pydantic import BaseModel
from typing import Optional

class CalendarEvent(BaseModel):
    id: str
    user_id: str
    piazza_course_id: str
    google_event_id: str
    title: str
    event_date: str
    source_post_number: Optional[str] = None
    reminder_settings: Optional[str] = None
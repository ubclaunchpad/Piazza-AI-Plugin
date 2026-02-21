"""
Models for the per-post-llm queries

"""

from pydantic import BaseModel, Field

class PostRequest(BaseModel):
    """Use for general per-post llm features"""
    thread_id: str = Field(..., description="Thread ID to retrieve context from")
    session_id: str = Field(None, description="Chat session ID for history")
    post_num: int

class SimplifyPostRequest(PostRequest):
    """Simplify/Explain inherits a general post request but includes
       the user's proficieny in the topic from (1-5)
    """
    proficiency: int = Field(min=1, max=5)

__all__ = ["PostRequest", "SimplifyPostRequest"]
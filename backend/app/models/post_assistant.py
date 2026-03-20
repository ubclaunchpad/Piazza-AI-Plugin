"""Models for per-post assistant requests."""

from typing import Literal

from pydantic import BaseModel, Field

TranslateLanguage = Literal[
    "English",
    "Chinese",
    "Korean",
    "French",
    "Russian",
    "Spanish",
]


class PostRequest(BaseModel):
    """Use for general per-post llm features"""

    thread_id: str = Field(..., description="Thread ID to retrieve context from")
    session_id: str | None = Field(None, description="Chat session ID for history")
    post_num: int


class SimplifyPostRequest(PostRequest):
    """Simplify/Explain inherits a general post request but includes
    the user's proficieny in the topic from (1-5)
    """

    proficiency: int = Field(min=1, max=5)


class TranslatePostRequest(PostRequest):
    """Translate request with the target language provided by the UI."""

    language: TranslateLanguage = Field(
        default="English",
        description="Target translation language.",
    )


__all__ = [
    "PostRequest",
    "SimplifyPostRequest",
    "TranslateLanguage",
    "TranslatePostRequest",
]

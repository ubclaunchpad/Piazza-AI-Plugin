from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID


class QuizQuestion(BaseModel):
    question: str
    type: Literal["multiple_choice", "multiple_select"]
    options: list[str]
    correct_answer: str | list[str]  # str for mc, list[str] for ms
    explanation: Optional[str] = None


class QuizGenerateRequest(BaseModel):
    piazza_course_id: str
    title: str = Field(..., min_length=1, max_length=255)
    difficulty: Literal["easy", "medium", "hard"]
    num_questions: int = Field(default=10, ge=1, le=50)
    source_posts: Optional[list[str]] = None


class QuizSubmitRequest(BaseModel):
    answers: list[str | list[str]]  # ordered, matching questionz by index


class QuizResponse(BaseModel):
    id: UUID
    title: str
    difficulty: str
    questions: list[QuizQuestion]
    source_posts: list[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuizResultResponse(BaseModel):
    quiz_id: UUID
    score: float
    correct_count: int
    total_count: int
    completed_at: datetime


class QuizDeleteResponse(BaseModel):
    id: UUID
    deleted: bool = True
    message: str = "Quiz deleted successfully"


# ------ Flashcards ------ #


class FlashcardCard(BaseModel):
    front: str
    back: str
    card_type: Literal["concept", "definition", "qa"]


class FlashcardRequestGenerate(BaseModel):
    piazza_course_id: str
    title: str = Field(..., min_length=1, max_length=255)
    tags: Optional[list[str]] = None
    source_posts: Optional[list[str]] = None


class FlashcardReviewRequest(BaseModel):
    quality: int = Field(..., ge=0, le=5)  # SM-2: 0=blackout, 5=perfect


class FlashcardResponse(BaseModel):
    id: UUID
    front: str
    back: str
    card_type: str
    ease_factor: float
    interval_days: int
    next_review: datetime
    review_count: int

    class Config:
        from_attributes = True


class FlashcardAllResponse(BaseModel):
    id: UUID
    title: str
    tags: Optional[list[str]] = None
    created_at: datetime
    cards: list[FlashcardResponse]

    class Config:
        from_attributes = True


class FlashcardDeleteResponse(BaseModel):
    id: UUID
    deleted: bool = True
    message: str = "Flashcard deck deleted successfully"


class SummaryGenerateRequest(BaseModel):
    piazza_course_id: str
    title: str = Field(..., min_length=1, max_length=255)
    summary_type: Literal["thread", "weekly", "exam_guide", "custom"]
    source_posts: Optional[list[str]] = None


class SummaryResponse(BaseModel):
    id: UUID
    title: str
    content: str
    summary_type: Optional[str]
    source_posts: Optional[list[str]]
    created_at: datetime

    class Config:
        from_attributes = True


class AllStudyMaterialsResponse(BaseModel):
    quizzes: list[QuizResponse]
    flashcard_decks: list[FlashcardAllResponse]
    summaries: list[SummaryResponse]

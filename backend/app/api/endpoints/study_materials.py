"""
Study Material API Endpoints
Generates quizzes, flashcards, etc
"""

from fastapi import APIRouter, HTTPException, status
import logging
from uuid import UUID

from app.models.study_materials import (
    QuizGenerateRequest, QuizResponse, QuizSubmitRequest, QuizResultResponse, QuizDeleteResponse,
    FlashcardRequestGenerate, FlashcardAllResponse, FlashcardReviewRequest, FlashcardResponse, FlashcardDeleteResponse,
    SummaryGenerateRequest, SummaryResponse, AllStudyMaterialsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# -------- QUIZ -------- #

@router.post("/quiz/generate", response_model=QuizResponse)
async def quiz_generate(quiz_info: QuizGenerateRequest) -> QuizResponse:
    pass

@router.get("/quiz/{id}", response_model=QuizResponse)
async def get_quiz(id: UUID) -> QuizResponse:
    pass

@router.post("/quiz/{id}/submit", response_model=QuizResultResponse)
async def submit_quiz_answer(id: UUID, submission: QuizSubmitRequest) -> QuizResultResponse:
    pass

@router.get("/quiz", response_model=list[QuizResponse])
async def get_all_quizzes() -> list[QuizResponse]:
    pass

@router.delete("/quiz/{id}", response_model=QuizDeleteResponse)
async def delete_quiz(id: UUID) -> QuizDeleteResponse:
    pass

# -------- FLASHCARDS -------- #

@router.post("/flashcards/generate", response_model=FlashcardAllResponse)
async def flashcards_generate(deck_info: FlashcardRequestGenerate) -> FlashcardAllResponse:
    pass

@router.get("/flashcards/{deck_id}", response_model=FlashcardAllResponse)
async def get_flashcards(deck_id: UUID) -> FlashcardAllResponse:
    pass

@router.put("/flashcards/{deck_id}/progress", response_model=FlashcardResponse)
async def update_flashcard_mastery(deck_id: UUID, review: FlashcardReviewRequest) -> FlashcardResponse:
    pass

@router.get("/flashcards", response_model=list[FlashcardAllResponse])
async def get_all_flashcards() -> list[FlashcardAllResponse]:
    pass

@router.delete("/flashcards/{deck_id}", response_model=FlashcardDeleteResponse)
async def delete_flashcard_deck(deck_id: UUID) -> FlashcardDeleteResponse:
    pass

# -------- SUMMARY -------- #

@router.post("/summary/generate", response_model=SummaryResponse)
async def generate_summary(summary_info: SummaryGenerateRequest) -> SummaryResponse:
    pass

@router.get("/materials", response_model=AllStudyMaterialsResponse)
async def list_all_study_materials() -> AllStudyMaterialsResponse:
    pass

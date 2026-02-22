"""
Study Material API Endpoints
Generates quizzes, flashcards, etc
"""

from fastapi import APIRouter, HTTPException, status
import logging


logger = logging.getLogger(__name__)

router = APIRouter()


# -------- QUIZ -------- #

@router.post("/quiz/generate")
async def quiz_generate():
    pass

@router.get("/quiz/{id}")
async def get_quiz():
    pass

@router.post("/quiz/{id}/submit")
async def submit_quiz_answer():
    pass

@router.get("/quiz")
async def get_all_quizzes():
    pass

@router.delete("/quiz/{id}")
async def delete_quiz():
    pass

# -------- FLASHCARDS -------- #

@router.post("/flashcards/generate")
async def flashcards_generate():
    pass
    
@router.get("/flashcards/{deck_id}")
async def get_flashcards():
    pass

@router.put("/flashcards/{deck_id}/progress")
async def update_flashcard_mastery():
    pass

@router.get("/flashcards")
async def get_all_flashcards():
    pass

@router.delete("/flashcards/{deck_id}", res)
async def delete_flashcard_deck():
    pass

@router.post("/summary/generate")
async def generate_summary():
    pass

@router.get("/materials")
async def list_all_study_materials():
    pass

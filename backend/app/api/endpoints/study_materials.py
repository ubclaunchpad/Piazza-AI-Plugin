"""
Study Material API Endpoints
Generates quizzes, flashcards, etc
"""

from fastapi import APIRouter, HTTPException, status
import logging
from uuid import UUID
from psycopg2.extras import Json

from app.core.database import execute_query, execute_statement
from app.models.study_materials import (
    QuizGenerateRequest, QuizResponse, QuizSubmitRequest, QuizResultResponse, QuizDeleteResponse,
    FlashcardRequestGenerate, FlashcardAllResponse, FlashcardReviewRequest, FlashcardResponse, FlashcardDeleteResponse,
    SummaryGenerateRequest, SummaryResponse, AllStudyMaterialsResponse,
)
from app.textGeneration import generate_quiz_questions

logger = logging.getLogger(__name__)

router = APIRouter()


# -------- QUIZ -------- #

@router.post("/quiz/generate", response_model=QuizResponse)
async def quiz_generate(quiz_info: QuizGenerateRequest) -> QuizResponse:
    try:
        generated = generate_quiz_questions(
            piazza_course_id=quiz_info.piazza_course_id,
            title=quiz_info.title,
            difficulty=quiz_info.difficulty,
            num_questions=quiz_info.num_questions,
            source_posts=quiz_info.source_posts,
        )

        insert_query = """
        INSERT INTO quizzes (
            piazza_course_id, title, difficulty, questions, source_posts
        )
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, title, difficulty, questions,
                  COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                  created_at
        """
        quiz_row = execute_query(
            insert_query,
            (
                quiz_info.piazza_course_id,
                quiz_info.title,
                quiz_info.difficulty,
                Json(generated["questions"]),
                generated["source_posts"],
            ),
            fetch_one=True,
        )

        if not quiz_row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist generated quiz",
            )

        return QuizResponse.model_validate(quiz_row)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate quiz")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}",
        )

@router.get("/quiz/{id}", response_model=QuizResponse)
async def get_quiz(id: UUID) -> QuizResponse:
    try:
        query = """
        SELECT id, title, difficulty, questions,
               COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
               created_at
        FROM quizzes
        WHERE id = %s
        """

        quiz = execute_query(query, (str(id),), fetch_one=True)

        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found"
            )
        
        return QuizResponse.model_validate(quiz)
    
    except HTTPException:
        raise

    except Exception as e:
        logger.exception("Failed to fetch quiz")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch quiz: {str(e)}",
        )


        



    

@router.post("/quiz/{id}/submit", response_model=QuizResultResponse)
async def submit_quiz_answer(id: UUID, submission: QuizSubmitRequest) -> QuizResultResponse:
    pass

@router.get("/quiz", response_model=list[QuizResponse])
async def get_all_quizzes() -> list[QuizResponse]:
    """
    Get all quizzes
    """
    try:
        query = """
        SELECT id, title, difficulty, questions,
               COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
               created_at
        FROM quizzes
        ORDER BY created_at DESC;
        """
        quizzes = execute_query(query)

        return [QuizResponse.model_validate(q) for q in (quizzes or [])]

    except HTTPException:
        raise
    
    except Exception as e:
        logger.exception("Failed to fetch quizzes")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch quizzes: {str(e)}",
        )
    
    

@router.delete("/quiz/{id}", response_model=QuizDeleteResponse)
async def delete_quiz(id: UUID) -> QuizDeleteResponse:
    """
    Delete given quiz from quiz id 
    """
    try:
        query = """
        DELETE FROM quizzes 
        WHERE id = %s
        """
        affected = execute_statement(query, (str(id),))

        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found"
            )

        return QuizDeleteResponse(id=id, deleted=True, message="Quiz deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete quiz")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete quiz: {str(e)}",
        )

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

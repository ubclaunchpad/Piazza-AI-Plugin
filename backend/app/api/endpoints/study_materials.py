"""
Study Material API Endpoints
Generates quizzes, flashcards, etc
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from psycopg2.extras import Json

from app.core.database import execute_query, execute_statement
from app.core.supabase import supabase
from app.models.study_materials import (
    AllStudyMaterialsResponse,
    FlashcardAllResponse,
    FlashcardDeleteResponse,
    FlashcardRequestGenerate,
    FlashcardResponse,
    FlashcardReviewRequest,
    QuizDeleteResponse,
    QuizGenerateRequest,
    QuizResponse,
    QuizResultResponse,
    QuizSubmitRequest,
    SummaryGenerateRequest,
    SummaryResponse,
)
from app.textGeneration import (
    generate_flashcard_stream,
    generate_quiz_questions,
    generate_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_current_user(authorization: Optional[str] = Header(None)) -> Any:
    """Validate authorization token and return current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# -------- QUIZ -------- #


@router.post("/quiz/generate", response_model=QuizResponse)
async def quiz_generate(
    quiz_info: QuizGenerateRequest, user=Depends(get_current_user)
) -> QuizResponse:
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
            user_id, piazza_course_id, title, difficulty, questions, source_posts
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, title, difficulty, questions,
                  COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                  created_at
        """
        quiz_row = execute_query(
            insert_query,
            (
                str(user.id),
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
async def submit_quiz_answer(
    id: UUID, submission: QuizSubmitRequest
) -> QuizResultResponse:
    try:
        quiz = execute_query(
            "SELECT id, questions FROM quizzes WHERE id = %s",
            (str(id),),
            fetch_one=True,
        )
        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found"
            )

        questions = quiz["questions"]
        user_answers = submission.answers

        if len(user_answers) != len(questions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected {len(questions)} answers, got {len(user_answers)}",
            )

        correct_count = 0
        for q, user_ans in zip(questions, user_answers):
            correct = q["correct_answer"]
            if isinstance(correct, list):
                if isinstance(user_ans, list) and sorted(user_ans) == sorted(correct):
                    correct_count += 1
            else:
                if user_ans == correct:
                    correct_count += 1

        total = len(questions)
        score = round((correct_count / total) * 100, 2) if total else 0.0
        now = datetime.now(timezone.utc)

        execute_statement(
            """
            INSERT INTO quiz_attempts (quiz_id, answers, score, completed_at)
            VALUES (%s, %s, %s, %s)
            """,
            (str(id), Json(user_answers), score, now),
        )

        return QuizResultResponse(
            quiz_id=id,
            score=score,
            correct_count=correct_count,
            total_count=total,
            completed_at=now,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to submit quiz")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit quiz: {str(e)}",
        )


@router.get("/quiz", response_model=list[QuizResponse])
async def get_all_quizzes(
    piazza_course_id: Optional[str] = None,
    user=Depends(get_current_user),
) -> list[QuizResponse]:
    """
    Get all quizzes for the current user, optionally filtered by course.
    """
    try:
        if piazza_course_id:
            query = """
            SELECT id, title, difficulty, questions,
                   COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                   created_at
            FROM quizzes
            WHERE user_id = %s AND piazza_course_id = %s
            ORDER BY created_at DESC;
            """
            quizzes = execute_query(query, (str(user.id), piazza_course_id))
        else:
            query = """
            SELECT id, title, difficulty, questions,
                   COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                   created_at
            FROM quizzes
            WHERE user_id = %s
            ORDER BY created_at DESC;
            """
            quizzes = execute_query(query, (str(user.id),))

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

        return QuizDeleteResponse(
            id=id, deleted=True, message="Quiz deleted successfully"
        )
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
async def flashcards_generate(
    deck_info: FlashcardRequestGenerate, user=Depends(get_current_user)
) -> FlashcardAllResponse:
    try:
        generated = generate_flashcard_stream(
            piazza_course_id=deck_info.piazza_course_id,
            title=deck_info.title,
            tags=deck_info.tags,
            source_posts=deck_info.source_posts,
            num_cards=deck_info.num_cards,
        )

        deck_row = execute_query(
            """
            INSERT INTO flashcard_decks (user_id, piazza_course_id, title, tags)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, tags, created_at
            """,
            (str(user.id), deck_info.piazza_course_id, deck_info.title, deck_info.tags),
            fetch_one=True,
        )

        if not deck_row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist flashcard deck",
            )

        deck_id = deck_row["id"]

        if generated["cards"]:
            card_values = [
                (deck_id, c["front"], c["back"], c["card_type"])
                for c in generated["cards"]
            ]
            placeholders = ", ".join("(%s, %s, %s, %s)" for _ in card_values)
            flat_params = [v for row in card_values for v in row]
            cards_rows = execute_query(
                f"""
                INSERT INTO flashcards (deck_id, front, back, card_type)
                VALUES {placeholders}
                RETURNING id, front, back, card_type,
                          ease_factor, interval_days, next_review, review_count
                """,
                tuple(flat_params),
            )
        else:
            cards_rows = []

        return FlashcardAllResponse(
            id=deck_row["id"],
            title=deck_row["title"],
            tags=deck_row["tags"],
            created_at=deck_row["created_at"],
            cards=[FlashcardResponse.model_validate(r) for r in (cards_rows or [])],
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate flashcards")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate flashcards: {str(e)}",
        )


@router.get("/flashcards/{deck_id}", response_model=FlashcardAllResponse)
async def get_flashcards(deck_id: UUID) -> FlashcardAllResponse:
    try:
        deck_row = execute_query(
            "SELECT id, title, tags, created_at FROM flashcard_decks WHERE id = %s",
            (str(deck_id),),
            fetch_one=True,
        )

        if not deck_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard deck not found"
            )

        cards_rows = execute_query(
            """
            SELECT id, front, back, card_type,
                   ease_factor, interval_days, next_review, review_count
            FROM flashcards WHERE deck_id = %s ORDER BY id
            """,
            (str(deck_id),),
        )

        return FlashcardAllResponse(
            id=deck_row["id"],
            title=deck_row["title"],
            tags=deck_row["tags"],
            created_at=deck_row["created_at"],
            cards=[FlashcardResponse.model_validate(r) for r in (cards_rows or [])],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch flashcard deck")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch flashcard deck: {str(e)}",
        )


@router.put("/flashcards/{card_id}/progress", response_model=FlashcardResponse)
async def update_flashcard_mastery(
    card_id: UUID, review: FlashcardReviewRequest
) -> FlashcardResponse:
    """Apply one SM-2 review step to a single flashcard. quality 0-5."""
    try:
        card = execute_query(
            """
            SELECT id, ease_factor, interval_days, review_count
            FROM flashcards WHERE id = %s
            """,
            (str(card_id),),
            fetch_one=True,
        )

        if not card:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found"
            )

        q = review.quality
        ef = float(card["ease_factor"])
        interval = int(card["interval_days"])
        review_count = int(card["review_count"])

        # SM-2 algorithm
        if q < 3:
            interval = 0
            review_count = 0
        else:
            if review_count == 0:
                interval = 1
            elif review_count == 1:
                interval = 6
            else:
                interval = round(interval * ef)
            review_count += 1

        ef = max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

        updated = execute_query(
            """
            UPDATE flashcards
            SET ease_factor   = %s,
                interval_days = %s,
                next_review   = NOW() + (%s || ' days')::interval,
                review_count  = %s
            WHERE id = %s
            RETURNING id, front, back, card_type,
                      ease_factor, interval_days, next_review, review_count
            """,
            (round(ef, 2), interval, interval, review_count, str(card_id)),
            fetch_one=True,
        )

        return FlashcardResponse.model_validate(updated)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update flashcard progress")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update flashcard progress: {str(e)}",
        )


@router.get("/flashcards", response_model=list[FlashcardAllResponse])
async def get_all_flashcards(
    piazza_course_id: Optional[str] = None,
    user=Depends(get_current_user),
) -> list[FlashcardAllResponse]:
    try:
        if piazza_course_id:
            decks = execute_query(
                "SELECT id, title, tags, created_at FROM flashcard_decks WHERE user_id = %s AND piazza_course_id = %s ORDER BY created_at DESC",
                (str(user.id), piazza_course_id),
            )
        else:
            decks = execute_query(
                "SELECT id, title, tags, created_at FROM flashcard_decks WHERE user_id = %s ORDER BY created_at DESC",
                (str(user.id),),
            )

        result = []
        for deck in decks or []:
            cards_rows = execute_query(
                """
                SELECT id, front, back, card_type,
                       ease_factor, interval_days, next_review, review_count
                FROM flashcards WHERE deck_id = %s ORDER BY id
                """,
                (str(deck["id"]),),
            )
            result.append(
                FlashcardAllResponse(
                    id=deck["id"],
                    title=deck["title"],
                    tags=deck["tags"],
                    created_at=deck["created_at"],
                    cards=[
                        FlashcardResponse.model_validate(r) for r in (cards_rows or [])
                    ],
                )
            )

        return result

    except Exception as e:
        logger.exception("Failed to fetch flashcard decks")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch flashcard decks: {str(e)}",
        )


@router.delete("/flashcards/{deck_id}", response_model=FlashcardDeleteResponse)
async def delete_flashcard_deck(deck_id: UUID) -> FlashcardDeleteResponse:
    try:
        affected = execute_statement(
            "DELETE FROM flashcard_decks WHERE id = %s", (str(deck_id),)
        )

        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard deck not found"
            )

        return FlashcardDeleteResponse(id=deck_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete flashcard deck")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete flashcard deck: {str(e)}",
        )


# -------- SUMMARY -------- #


@router.post("/summary/generate", response_model=SummaryResponse)
async def summary_generate(
    summary_info: SummaryGenerateRequest, user=Depends(get_current_user)
) -> SummaryResponse:
    try:
        generated = generate_summary(
            piazza_course_id=summary_info.piazza_course_id,
            title=summary_info.title,
            summary_type=summary_info.summary_type,
            source_posts=summary_info.source_posts,
        )

        row = execute_query(
            """
            INSERT INTO summaries (user_id, piazza_course_id, title, content, summary_type, source_posts)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, title, content, summary_type,
                      COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                      created_at
            """,
            (
                str(user.id),
                summary_info.piazza_course_id,
                summary_info.title,
                generated["content"],
                summary_info.summary_type,
                generated["source_posts"],
            ),
            fetch_one=True,
        )

        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist generated summary",
            )

        return SummaryResponse.model_validate(row)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate summary")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}",
        )


@router.get("/materials", response_model=AllStudyMaterialsResponse)
async def list_all_study_materials(piazza_course_id: str) -> AllStudyMaterialsResponse:
    try:
        quiz_rows = execute_query(
            """
            SELECT id, title, difficulty, questions,
                   COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                   created_at
            FROM quizzes
            WHERE piazza_course_id = %s
            ORDER BY created_at DESC
            """,
            (piazza_course_id,),
        )

        deck_rows = execute_query(
            "SELECT id, title, tags, created_at FROM flashcard_decks WHERE piazza_course_id = %s ORDER BY created_at DESC",
            (piazza_course_id,),
        )

        flashcard_decks = []
        for deck in deck_rows or []:
            cards_rows = execute_query(
                """
                SELECT id, front, back, card_type,
                       ease_factor, interval_days, next_review, review_count
                FROM flashcards WHERE deck_id = %s ORDER BY id
                """,
                (str(deck["id"]),),
            )
            flashcard_decks.append(
                FlashcardAllResponse(
                    id=deck["id"],
                    title=deck["title"],
                    tags=deck["tags"],
                    created_at=deck["created_at"],
                    cards=[
                        FlashcardResponse.model_validate(r) for r in (cards_rows or [])
                    ],
                )
            )

        summary_rows = execute_query(
            """
            SELECT id, title, content, summary_type,
                   COALESCE(source_posts, ARRAY[]::text[]) AS source_posts,
                   created_at
            FROM summaries
            WHERE piazza_course_id = %s
            ORDER BY created_at DESC
            """,
            (piazza_course_id,),
        )

        return AllStudyMaterialsResponse(
            quizzes=[QuizResponse.model_validate(q) for q in (quiz_rows or [])],
            flashcard_decks=flashcard_decks,
            summaries=[SummaryResponse.model_validate(s) for s in (summary_rows or [])],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch all study materials")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch study materials: {str(e)}",
        )

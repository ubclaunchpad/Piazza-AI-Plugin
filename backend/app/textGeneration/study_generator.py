import json
import logging
from typing import Any, Optional

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, TypeAdapter, ValidationError

from app.core.database import execute_query
from app.models.study_materials import FlashcardCard, QuizQuestion

logger = logging.getLogger(__name__)

QUIZ_MODEL = "openai/gpt-oss-120b"

# ----------------------------- Quiz ------------------------------- #


class QuizGenerationPayload(BaseModel):
    questions: list[QuizQuestion]


_quiz_payload_adapter = TypeAdapter(QuizGenerationPayload)
_questions_schema_json = json.dumps(_quiz_payload_adapter.json_schema(), indent=2)


# ----------------------------- Flashcards ------------------------------- #


class FlashcardGenerationPayload(BaseModel):
    cards: list[FlashcardCard]


_flashcard_payload_adapter = TypeAdapter(FlashcardGenerationPayload)
_flashcard_schema_json = json.dumps(_flashcard_payload_adapter.json_schema(), indent=2)


def _extract_json_object(raw: str) -> dict[str, Any]:
    """Extract a JSON object from raw model output, including fenced blocks."""
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(cleaned[start : end + 1])

    raise ValueError("LLM did not return a valid JSON object.")


def _get_answered_chunks(
    piazza_course_id: str,
    source_posts: Optional[list[str]],
    limit: int,
) -> list[dict[str, Any]]:
    """
    Fetch ingested chunks for a course where answer metadata indicates a resolved post.
    Data comes from langchain_pg_embedding/cmetadata.
    """
    base_query = """
        SELECT e.document, e.cmetadata
        FROM langchain_pg_embedding e
        JOIN langchain_pg_collection c ON e.collection_id = c.uuid
        WHERE c.name = %s
          AND (
            COALESCE((e.cmetadata->>'has_instructor_answer')::boolean, false) = true
            OR COALESCE((e.cmetadata->>'has_student_answer')::boolean, false) = true
          )
    """
    params: list[Any] = [piazza_course_id]

    if source_posts:
        base_query += " AND (e.cmetadata->>'post_number') = ANY(%s)"
        params.append(source_posts)

    base_query += """
        ORDER BY
          CASE
            WHEN (e.cmetadata->>'post_number') ~ '^[0-9]+$'
              THEN (e.cmetadata->>'post_number')::int
            ELSE 0
          END DESC,
          e.id DESC
        LIMIT %s
    """
    params.append(limit)

    rows = execute_query(base_query, tuple(params))
    return rows or []


def _build_context(chunks: list[dict[str, Any]]) -> tuple[str, list[str]]:
    """Create LLM context text and source post list from embedding rows."""
    context_blocks: list[str] = []
    source_posts: list[str] = []
    seen_posts: set[str] = set()

    for idx, row in enumerate(chunks, 1):
        metadata = row.get("cmetadata") or {}
        post_number = metadata.get("post_number")
        post_str = str(post_number) if post_number is not None else "unknown"
        text = row.get("document") or ""

        if post_str not in seen_posts:
            seen_posts.add(post_str)
            source_posts.append(post_str)

        context_blocks.append(f"[Post {post_str} | Chunk {idx}]\n{text}")

    return "\n\n".join(context_blocks), source_posts


_MAX_CONTEXT_CHARS = 12_000  # ~3000 tokens, leaves room for system prompt + output


def _truncate_context(context: str, max_chars: int = _MAX_CONTEXT_CHARS) -> str:
    if len(context) <= max_chars:
        return context
    truncated = context[:max_chars]
    last_boundary = truncated.rfind("\n\n[Post ")
    if last_boundary > max_chars // 2:
        return truncated[:last_boundary]
    return truncated


def generate_quiz_questions(
    *,
    piazza_course_id: str,
    title: str,
    difficulty: str,
    num_questions: int,
    source_posts: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Generate quiz questions from ingested answered posts.

    Returns:
        {
            "questions": list[dict],
            "source_posts": list[str],
            "model": str
        }
    """
    chunks = _get_answered_chunks(
        piazza_course_id=piazza_course_id,
        source_posts=source_posts,
        limit=min(num_questions * 3, 30),
    )
    if not chunks:
        raise ValueError(
            "No answered ingested posts found for this course. Run ingestion first."
        )

    context, resolved_source_posts = _build_context(chunks)
    context = _truncate_context(context)

    llm = ChatGroq(
        model=QUIZ_MODEL,
        temperature=0.2,
        max_tokens=3000,
        max_retries=3,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a course professor creating curriculum quizzes from Piazza context.
Return strict JSON only. No markdown, no prose.
Your output must conform to this Pydantic JSON schema (for `questions` only):
{quiz_questions_schema}
Output envelope must be:
{{"questions": [...]}}
Rules:
- Generate exactly {num_questions} questions.
- Questions must be grounded in provided context.
- For multiple_choice, correct_answer must be a single string present in options.
- For multiple_select, correct_answer must be a non-empty list of strings all present in options.
- 4 options per question.
- Difficulty level: {difficulty}.
- Quiz title: {title}.
- Every question MUST include a non-empty explanation field (1-3 sentences) that explains why the correct answer is right, referencing the relevant concept from the context.
- Focus exclusively on course concepts, definitions, algorithms, theories, and technical subject matter.
- NEVER generate questions about: grade curves or curve amounts, score adjustments or extra credit, exam/assignment score averages or statistics, grading scales or cutoffs, rounding policies, late penalties or extensions, exam logistics (time, location, format, duration), regrade or grading dispute discussions, or any other administrative/logistical announcements.
- If a piece of context only contains administrative or grade-related information and no educational content, skip it entirely and draw from other context.
""",
            ),
            ("human", "Context:\n{context}"),
        ]
    )

    raw = (prompt | llm | StrOutputParser()).invoke(
        {
            "num_questions": num_questions,
            "difficulty": difficulty,
            "title": title,
            "context": context,
            "quiz_questions_schema": _questions_schema_json,
        }
    )

    parsed = _extract_json_object(raw)

    try:
        payload = _quiz_payload_adapter.validate_python(parsed)
        questions = payload.questions
    except ValidationError as e:
        logger.error("Quiz question validation failed: %s", e)
        raise ValueError("Generated quiz format is invalid.")

    if len(questions) != num_questions:
        raise ValueError(
            f"Generated {len(questions)} questions, expected {num_questions}."
        )

    return {
        "questions": [q.model_dump() for q in questions],
        "source_posts": resolved_source_posts,
        "model": QUIZ_MODEL,
    }


def generate_summary(
    *,
    piazza_course_id: str,
    title: str,
    summary_type: str,
    source_posts: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Generate a prose summary from ingested answered posts.

    Returns:
        {
            "content": str,
            "source_posts": list[str],
            "model": str
        }
    """
    chunks = _get_answered_chunks(
        piazza_course_id=piazza_course_id,
        source_posts=source_posts,
        limit=30,
    )
    if not chunks:
        raise ValueError(
            "No answered ingested posts found for this course. Run ingestion first."
        )

    context, resolved_source_posts = _build_context(chunks)
    context = _truncate_context(context)

    type_instructions = {
        "thread": (
            "Summarize the specific thread(s) provided. "
            "Use a concise Q&A format: state the question(s) raised and the key answer(s) given."
        ),
        "weekly": (
            "Write a weekly digest of all activity. "
            "Organize by topic/theme. Briefly describe the main questions and resolutions."
        ),
        "exam_guide": (
            "Create an exam study guide. "
            "List key concepts, important definitions, and common question patterns found in the posts."
        ),
        "custom": (
            "Write a comprehensive summary of the provided content. "
            "Cover all major topics and important points."
        ),
    }
    type_instruction = type_instructions.get(summary_type, type_instructions["custom"])

    llm = ChatGroq(
        model=QUIZ_MODEL,
        temperature=0.3,
        max_tokens=2500,
        max_retries=3,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are summarizing Piazza course discussion posts for students.
Write a clear, well-structured prose summary. Do not return JSON.
Summary type: {summary_type}
Instructions: {type_instruction}
Title: {title}
Focus only on course content and educational material. Ignore posts about grades, exam logistics, grading disputes, assignment deadlines, or software/homework bugs unrelated to learning.
""",
            ),
            ("human", "Context:\n{context}"),
        ]
    )

    content = (prompt | llm | StrOutputParser()).invoke(
        {
            "summary_type": summary_type,
            "type_instruction": type_instruction,
            "title": title,
            "context": context,
        }
    )

    if not content or not content.strip():
        raise ValueError("LLM returned an empty summary.")

    return {
        "content": content.strip(),
        "source_posts": resolved_source_posts,
        "model": QUIZ_MODEL,
    }


def generate_flashcard_stream(
    piazza_course_id: str,
    title: str,
    tags: Optional[list[str]],
    source_posts: Optional[list[str]] = None,
    num_cards: int = 15,
) -> dict[str, Any]:
    """
    Generate flashcards from ingested answered posts.

    Returns:
        {
            "cards": list[dict],
            "source_posts": list[str],
            "model": str
        }
    """
    chunks = _get_answered_chunks(
        piazza_course_id, source_posts, min(num_cards * 2, 40)
    )

    if not chunks:
        raise ValueError(
            "No answered ingested posts found for this course. Run ingestion first."
        )

    context, resolved_source_posts = _build_context(chunks)
    context = _truncate_context(context)

    llm = ChatGroq(
        model=QUIZ_MODEL,
        temperature=0.2,
        max_tokens=3000,
        max_retries=3,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are generating course flashcards from Piazza context.
Return strict JSON only. No markdown, no prose.
Your output must conform to this Pydantic JSON schema (for `cards` only):
{flashcard_schema}
Output envelope must be:
{{"cards": [...]}}
Rules:
- Generate exactly {num_cards} flashcards.
- Each card must be grounded in the provided context.
- card_type must be one of: "concept", "definition", "qa".
- front: a concise question or term.
- back: a clear, complete answer or explanation.
- Deck title: {title}.
- Focus exclusively on course concepts, definitions, algorithms, theories, and technical subject matter.
- NEVER create flashcards about: grade curves or curve amounts, score adjustments or extra credit, exam/assignment score averages or statistics, grading scales or cutoffs, rounding policies, late penalties or extensions, exam logistics (time, location, format, duration), regrade or grading dispute discussions, or any other administrative/logistical announcements.
- If a piece of context only contains administrative or grade-related information and no educational content, skip it entirely and draw from other context.
{tags_instruction}""",
            ),
            ("human", "Context:\n{context}"),
        ]
    )

    tags_instruction = (
        f"- Focus on these topic tags: {', '.join(tags)}." if tags else ""
    )

    raw = (prompt | llm | StrOutputParser()).invoke(
        {
            "flashcard_schema": _flashcard_schema_json,
            "title": title,
            "num_cards": num_cards,
            "tags_instruction": tags_instruction,
            "context": context,
        }
    )

    parsed = _extract_json_object(raw)

    try:
        payload = _flashcard_payload_adapter.validate_python(parsed)
        cards = payload.cards
    except ValidationError as e:
        logger.error("Flashcard validation failed: %s", e)
        raise ValueError("Generated flashcard format is invalid.")

    return {
        "cards": [c.model_dump() for c in cards],
        "source_posts": resolved_source_posts,
        "model": QUIZ_MODEL,
    }

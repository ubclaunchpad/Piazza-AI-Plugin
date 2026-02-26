import json
import logging
from typing import Any, Optional

from pydantic import BaseModel, TypeAdapter, ValidationError
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.database import execute_query
from app.models.study_materials import QuizQuestion

logger = logging.getLogger(__name__)

QUIZ_MODEL = "openai/gpt-oss-120b"


class QuizGenerationPayload(BaseModel):
    questions: list[QuizQuestion]


_quiz_payload_adapter = TypeAdapter(QuizGenerationPayload)
_questions_schema_json = json.dumps(_quiz_payload_adapter.json_schema(), indent=2)


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
        limit=max(num_questions * 6, 20),
    )
    if not chunks:
        raise ValueError(
            "No answered ingested posts found for this course. Run ingestion first."
        )

    context, resolved_source_posts = _build_context(chunks)

    llm = ChatGroq(
        model=QUIZ_MODEL,
        temperature=0.2,
        max_tokens=6000,
        max_retries=3,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are generating course quizzes from Piazza context.
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

"""Shared helpers for exact-post assistant generation and streaming."""

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

from langchain_core.messages import AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.database import execute_query, execute_statement

SYSTEM_PROMPT = "Shared helper utilities for exact per-post assistant generation."
MODEL = "openai/gpt-oss-120b"

logger = logging.getLogger(__name__)


class PostAssistantContextError(ValueError):
    """Raised when an exact post cannot be resolved from ingested content."""


@dataclass(slots=True)
class ResolvedPostContext:
    """Resolved exact-post context from the ingested PGVector store."""

    thread_id: str
    post_num: int
    content: str
    metadata: dict[str, Any]
    subject: str
    chunk_type: str


def get_exact_post_context(thread_id: str, post_num: int) -> ResolvedPostContext:
    """Fetch the exact post from PGVector, preferring the unified chunk."""
    query = """
        SELECT e.document, e.cmetadata
        FROM langchain_pg_embedding e
        JOIN langchain_pg_collection c ON e.collection_id = c.uuid
        WHERE c.name = %s
          AND (e.cmetadata->>'post_number') = %s
        ORDER BY
          CASE
            WHEN COALESCE(e.cmetadata->>'chunk_type', '') = 'unified' THEN 0
            ELSE 1
          END,
          e.id DESC
        LIMIT 1
    """
    row = execute_query(query, (thread_id, str(post_num)), fetch_one=True)

    if not row:
        raise PostAssistantContextError(
            f"Post {post_num} for course {thread_id} is not available in ingested "
            "course content. Run ingestion or refresh indexing for this course first."
        )

    content = (row.get("document") or "").strip()
    if not content:
        raise PostAssistantContextError(
            f"Post {post_num} for course {thread_id} was found, but its ingested "
            "content is empty. Re-run ingestion for this course."
        )

    metadata = row.get("cmetadata") or {}
    chunk_type = metadata.get("chunk_type") or "unknown"
    if chunk_type != "unified":
        logger.warning(
            "Using non-unified exact post chunk for course=%s post=%s chunk_type=%s",
            thread_id,
            post_num,
            chunk_type,
        )

    subject = metadata.get("subject") or f"Piazza Post {post_num}"
    return ResolvedPostContext(
        thread_id=thread_id,
        post_num=post_num,
        content=content,
        metadata=metadata,
        subject=subject,
        chunk_type=chunk_type,
    )


def format_post_context(post_context: ResolvedPostContext) -> str:
    """Format exact-post context for a single-post LLM prompt."""
    metadata = post_context.metadata
    tags = metadata.get("tags")
    folders = metadata.get("folders")

    def _format_list(values: Any) -> str:
        if isinstance(values, list) and values:
            return ", ".join(str(value) for value in values)
        return "None"

    lines = [
        f"Course ID: {post_context.thread_id}",
        f"Post Number: {post_context.post_num}",
        f"Subject: {post_context.subject}",
        f"Post Type: {metadata.get('post_type', 'unknown')}",
        f"Author Role: {metadata.get('author_role', 'unknown')}",
        f"Chunk Type: {post_context.chunk_type}",
        f"Tags: {_format_list(tags)}",
        f"Folders: {_format_list(folders)}",
        "",
        "Exact post content:",
        post_context.content,
    ]
    return "\n".join(lines)


def _build_chain(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
):
    """Create a string-streaming LLM chain."""
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError("GROQ_API_KEY must be set")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "{system_prompt}"),
            ("human", "{user_prompt}"),
        ]
    )
    llm = ChatGroq(
        model=MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        max_retries=3,
    )
    chain = prompt | llm | StrOutputParser()
    return chain, {"system_prompt": system_prompt, "user_prompt": user_prompt}


def _get_session_history(session_id: str):
    """Import the shared chat-history helper lazily to avoid import side effects."""
    from app.textGeneration.llm_service import get_session_history

    return get_session_history(session_id)


def _finalize_session(session_id: str | None) -> None:
    """Update the session title and timestamp after a successful response."""
    if not session_id:
        return

    try:
        from app.textGeneration.llm_service import update_session_title

        update_session_title(session_id)
    except Exception as exc:
        logger.error("Failed to update session title for %s: %s", session_id, exc)

    try:
        execute_statement(
            "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s",
            (session_id,),
        )
    except Exception as exc:
        logger.error("Failed to update session timestamp for %s: %s", session_id, exc)


def stream_post_assistant_response(
    *,
    action_name: str,
    post_context: ResolvedPostContext,
    session_id: str | None,
    system_prompt: str,
    user_prompt: str,
    history_user_message: str,
    temperature: float = 0.2,
    max_tokens: int = 3500,
):
    """Stream a per-post LLM response and persist it into chat history."""
    chain, chain_inputs = _build_chain(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    sources = [str(post_context.post_num)]

    def _event_stream():
        history = _get_session_history(session_id) if session_id else None
        full_answer = ""

        if history:
            history.add_user_message(history_user_message)

        try:
            for chunk in chain.stream(chain_inputs):
                text = str(chunk)
                if not text:
                    continue
                full_answer += text
                yield json.dumps({"type": "content", "content": text}) + "\n"

            if not full_answer.strip():
                raise ValueError("LLM returned an empty response.")

            yield json.dumps({"type": "sources", "sources": sources}) + "\n"

            if history:
                history.add_message(
                    AIMessage(
                        content=full_answer,
                        response_metadata={"sources": sources},
                    )
                )

            _finalize_session(session_id)
        except GeneratorExit:
            logger.info(
                "Stream disconnected for action=%s course=%s post=%s",
                action_name,
                post_context.thread_id,
                post_context.post_num,
            )
            if history and full_answer:
                history.add_message(
                    AIMessage(
                        content=full_answer + " [Interrupted]",
                        response_metadata={"sources": sources},
                    )
                )
        except Exception:
            logger.exception(
                "Failed during per-post stream for action=%s course=%s post=%s",
                action_name,
                post_context.thread_id,
                post_context.post_num,
            )
            if history and full_answer:
                history.add_message(
                    AIMessage(
                        content=full_answer + " [Error]",
                        response_metadata={"sources": sources},
                    )
                )
            raise

    return _event_stream()

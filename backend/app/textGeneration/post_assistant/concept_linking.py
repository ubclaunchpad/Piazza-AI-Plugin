"""Concept-linking placeholder service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    stream_placeholder_post_response,
)

SYSTEM_PROMPT = """Concept linking is intentionally left as a placeholder in this
branch. The exact post should still be resolved and the endpoint contract should stay
stable for the later implementation."""


def stream_llm_concept_response(
    *,
    post_context: ResolvedPostContext,
    session_id: str | None,
):
    """Stream a placeholder concept-linking response for one exact Piazza post."""
    message = (
        "Concept linking is not implemented yet.\n\n"
        f"Resolved exact post: {post_context.post_num}\n"
        f"Subject: {post_context.subject}\n\n"
        "The endpoint is wired to the exact ingested post and is ready for a future "
        "concept-linking implementation."
    )
    return stream_placeholder_post_response(
        action_name="concept-linking",
        post_context=post_context,
        session_id=session_id,
        history_user_message=(
            f"Link concepts for Piazza post {post_context.post_num}."
        ),
        placeholder_message=message,
    )

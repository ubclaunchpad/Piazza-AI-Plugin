"""Summarization LLM service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    format_post_context,
    stream_post_assistant_response,
)

SYSTEM_PROMPT = """You are a university teaching assistant summarizing a single Piazza post.
Produce a concise, well-structured summary that captures the main question, the key
answer or resolution, and any follow-up details that matter for students. Keep the
summary grounded in the exact post only."""


def _build_summary_user_prompt(post_context: ResolvedPostContext) -> str:
    """Build the one-shot user prompt for summarize."""
    return (
        "Task: Summarize the exact Piazza post below.\n"
        "Output requirements:\n"
        "- Lead with the main topic or question.\n"
        "- Capture the most important answer, resolution, or clarification.\n"
        "- Mention follow-ups or caveats only if they materially change understanding.\n"
        "- Use short bullets or short sections.\n\n"
        f"{format_post_context(post_context)}"
    )


def stream_llm_summary_response(
    *,
    post_context: ResolvedPostContext,
    session_id: str | None,
):
    """Stream a summary for one exact Piazza post."""
    return stream_post_assistant_response(
        action_name="summarize",
        post_context=post_context,
        session_id=session_id,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=_build_summary_user_prompt(post_context),
        history_user_message=f"Summarize Piazza post {post_context.post_num}.",
    )

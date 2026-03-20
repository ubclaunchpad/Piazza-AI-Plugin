"""Problem-solving LLM service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    format_post_context,
    stream_post_assistant_response,
)

SYSTEM_PROMPT = """You are a university teaching assistant solving or answering the
exact Piazza post provided. If the post contains a concrete problem, solve it step by
step. If it is conceptual, answer the question directly. If the post is missing
information needed for a confident solution, say what is missing and state any
minimal assumptions you make."""


def _build_solve_user_prompt(post_context: ResolvedPostContext) -> str:
    """Build the one-shot user prompt for solve."""
    return (
        "Task: Answer or solve the exact Piazza post below.\n"
        "Output requirements:\n"
        "- Provide the answer first, then the reasoning.\n"
        "- Use step-by-step structure when the post asks for a derivation, proof, or debugging help.\n"
        "- If the post is underspecified, state the gap clearly.\n"
        "- Keep the response grounded in the post rather than generic course advice.\n\n"
        f"{format_post_context(post_context)}"
    )


def stream_llm_solve_response(
    *,
    post_context: ResolvedPostContext,
    session_id: str | None,
):
    """Stream a solution-oriented answer for one exact Piazza post."""
    return stream_post_assistant_response(
        action_name="solve",
        post_context=post_context,
        session_id=session_id,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=_build_solve_user_prompt(post_context),
        history_user_message=f"Solve Piazza post {post_context.post_num}.",
        temperature=0.15,
    )

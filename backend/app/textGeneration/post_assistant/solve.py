"""Problem-solving LLM service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    format_post_context,
    stream_post_assistant_response,
)

SYSTEM_PROMPT = """You are an intelligent and helpful Teaching Assistant for a university course.
Your task is to help the student solve the problem presented in their Piazza post using the provided course context.

Please follow this Solution Chain:
Understand the Question: Begin by briefly clarifying the core problem or concept the student is asking about.
Provide a Step-by-Step Solution: Break down the solution into clear, logical, and easy-to-follow steps. Explain the reasoning behind each step to promote true understanding rather than just giving the final answer.
Include Relevant Context: Actively use the provided course context (previous Piazza posts) to ground your answer. Reference specific course concepts, definitions, or similar examples mentioned in the context.

If the provided context does not contain enough information to solve the problem, use your general knowledge but clearly state that you are doing so. Additionally, if the post content is not a 'problem' or contains non-academic
questions, then answer concisely that it is so."""


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

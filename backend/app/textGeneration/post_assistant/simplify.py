"""Simplification LLM service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    format_post_context,
    stream_post_assistant_response,
)

SYSTEM_PROMPT = """You are a patient university teaching assistant.
Simplify the exact Piazza post for the requested student proficiency without losing
technical correctness. Preserve important constraints, equations, code, and caveats.
Use short sections and bullets when helpful. Do not invent details that are not in
the post."""

PROFICIENCY_GUIDANCE = {
    1: (
        "Assume the student is a beginner. Define jargon, unpack assumptions, "
        "and explain the idea step by step in plain language."
    ),
    2: (
        "Assume the student knows the basics. Keep the explanation efficient, "
        "but clarify why each technical point matters."
    ),
    3: (
        "Assume the student is advanced. Stay concise and technically precise, "
        "focusing on the non-obvious ideas."
    ),
}


def _build_simplify_user_prompt(
    post_context: ResolvedPostContext,
    proficiency: int,
    proficiency_prompt_addon: str = "",
) -> str:
    """Build the one-shot user prompt for simplify."""
    proficiency_guidance = PROFICIENCY_GUIDANCE.get(proficiency)
    if not proficiency_guidance:
        raise ValueError(f"Unsupported simplify proficiency: {proficiency}")

    addon = proficiency_prompt_addon.strip()
    addon_block = f"\nAdditional guidance:\n{addon}\n" if addon else ""

    return (
        "Task: Rewrite the exact Piazza post below so it is easier for the student "
        "to understand.\n"
        f"Requested proficiency level: {proficiency}\n"
        f"{proficiency_guidance}"
        f"{addon_block}\n"
        "Output requirements:\n"
        "- Keep the explanation grounded in the exact post.\n"
        "- Preserve code, math, notation, and factual details.\n"
        "- Highlight the main takeaway first.\n\n"
        f"{format_post_context(post_context)}"
    )


def stream_llm_simplify_response(
    *,
    post_context: ResolvedPostContext,
    session_id: str | None,
    proficiency: int,
    proficiency_prompt_addon: str = "",
):
    """Stream a simplified explanation for one exact Piazza post."""
    return stream_post_assistant_response(
        action_name="simplify",
        post_context=post_context,
        session_id=session_id,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=_build_simplify_user_prompt(
            post_context=post_context,
            proficiency=proficiency,
            proficiency_prompt_addon=proficiency_prompt_addon,
        ),
        history_user_message=(
            f"Simplify Piazza post {post_context.post_num} "
            f"for proficiency level {proficiency}."
        ),
    )

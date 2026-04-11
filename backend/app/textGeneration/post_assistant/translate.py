"""Translation LLM service for a single exact Piazza post."""

from app.textGeneration.post_assistant.shared import (
    ResolvedPostContext,
    format_post_context,
    stream_post_assistant_response,
)

SYSTEM_PROMPT = """You are a precise university teaching assistant translating a single
Piazza post. Translate the prose faithfully into the requested language while keeping
code blocks, inline code, math notation, URLs, and technical identifiers intact unless
they should obviously remain unchanged."""


def _build_translate_user_prompt(
    post_context: ResolvedPostContext,
    language: str,
    language_prompt_addon: str = "",
) -> str:
    """Build the one-shot user prompt for translate."""
    addon = language_prompt_addon.strip()
    addon_block = f"\nAdditional translation guidance:\n{addon}\n" if addon else ""

    return (
        f"Task: Translate the exact Piazza post below into {language}.\n"
        "Output requirements:\n"
        "- Translate Accurately: Translate the entire post content (including the question, problem description, and explanations) clearly and naturally.\n"
        "- Preserve Technical Terms: Do NOT translate programming keywords, variables, function names, code blocks, mathematical formulas, or standard industry terminology. Leave them in their original language.\n"
        "- Maintain Tone and Format: Keep the original educational tone, and strictly preserve all markdown formatting, bullet points, and structures exactly as they appear.\n"
        "- Do not summarize or omit details.\n"
        "- If the target language is English, produce a natural English translation rather than commentary."
        f"{addon_block}\n\n"
        f"{format_post_context(post_context)}"
    )


def stream_llm_translate_response(
    *,
    post_context: ResolvedPostContext,
    session_id: str | None,
    language: str,
    language_prompt_addon: str = "",
):
    """Stream a translation for one exact Piazza post."""
    return stream_post_assistant_response(
        action_name="translate",
        post_context=post_context,
        session_id=session_id,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=_build_translate_user_prompt(
            post_context=post_context,
            language=language,
            language_prompt_addon=language_prompt_addon,
        ),
        history_user_message=(
            f"Translate Piazza post {post_context.post_num} into {language}."
        ),
    )

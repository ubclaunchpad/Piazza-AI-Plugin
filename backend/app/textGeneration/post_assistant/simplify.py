"""
Simplification LLM Service
"""

import json
import logging

from langchain_core.messages import AIMessage

from app.textGeneration.llm_service import get_session_history

logger = logging.getLogger(__name__)


def stream_llm_simplify_response(
    post_num: int, thread_id: str, session_id: str, proficiency: int
):
    """stream llm response in chunks"""
    message = (
        "Temporary simplify response placeholder.\n\n"
        f"Post: {post_num}\n"
        f"Course: {thread_id}\n"
        f"Session: {session_id}\n"
        f"Proficiency level: {proficiency}\n\n"
        "This endpoint is wired and streaming correctly. "
        "You can now continue with follow-up chat in the same session."
    )
    try:
        history = get_session_history(session_id)
        history.add_user_message(
            f"[simplify] Request for post {post_num} in course {thread_id} at proficiency {proficiency}."
        )
        history.add_message(
            AIMessage(content=message, response_metadata={"sources": [str(post_num)]})
        )
    except Exception as e:
        logger.error(f"Failed to persist simplify placeholder history: {e}")

    yield json.dumps({"type": "content", "content": message}) + "\n"
    yield json.dumps({"type": "sources", "sources": [str(post_num)]}) + "\n"

"""Tests for per-post assistant exact-post lookup, streaming, and request validation."""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.endpoints import per_post_llm
from app.textGeneration.post_assistant import shared
from app.textGeneration.post_assistant.shared import (
    PostAssistantContextError,
    ResolvedPostContext,
)
from app.textGeneration.post_assistant.simplify import _build_simplify_user_prompt
from app.textGeneration.post_assistant.translate import _build_translate_user_prompt


@pytest.fixture
def post_context() -> ResolvedPostContext:
    """Reusable exact-post fixture."""
    return ResolvedPostContext(
        thread_id="course-123",
        post_num=42,
        content="# Example Post\n\nThis is the ingested unified content.",
        metadata={
            "subject": "Example Subject",
            "chunk_type": "unified",
            "post_type": "question",
            "author_role": "student",
            "tags": ["hw1"],
            "folders": ["week1"],
        },
        subject="Example Subject",
        chunk_type="unified",
    )


@pytest.fixture
def client() -> TestClient:
    """Minimal app that only mounts the per-post router."""
    app = FastAPI()
    app.include_router(per_post_llm.router, prefix="/per-post")
    return TestClient(app)


def test_get_exact_post_context_returns_resolved_post(monkeypatch):
    """The exact lookup should map the DB row into a resolved context object."""

    def fake_execute_query(query, params, fetch_one=False):
        assert fetch_one is True
        assert params == ("course-123", "42")
        return {
            "document": "# Example Post\n\nUnified content",
            "cmetadata": {
                "subject": "Example Subject",
                "chunk_type": "unified",
                "post_type": "question",
            },
        }

    monkeypatch.setattr(shared, "execute_query", fake_execute_query)

    result = shared.get_exact_post_context("course-123", 42)

    assert result.thread_id == "course-123"
    assert result.post_num == 42
    assert result.subject == "Example Subject"
    assert result.chunk_type == "unified"
    assert result.content == "# Example Post\n\nUnified content"


def test_get_exact_post_context_raises_when_missing(monkeypatch):
    """Missing exact posts should produce a clear context error."""
    monkeypatch.setattr(shared, "execute_query", lambda *args, **kwargs: None)

    with pytest.raises(PostAssistantContextError) as exc_info:
        shared.get_exact_post_context("course-123", 42)

    assert "not available in ingested course content" in str(exc_info.value)


def test_stream_post_assistant_response_emits_ndjson_and_persists_history(
    monkeypatch,
    post_context,
):
    """Shared streaming should emit chunked content plus final sources."""

    class FakeChain:
        def stream(self, _inputs):
            yield "Hello"
            yield " world"

    class FakeHistory:
        def __init__(self):
            self.user_messages = []
            self.ai_messages = []

        def add_user_message(self, content):
            self.user_messages.append(content)

        def add_message(self, message):
            self.ai_messages.append(message)

    fake_history = FakeHistory()
    finalized = {}

    monkeypatch.setattr(shared, "_build_chain", lambda **kwargs: (FakeChain(), {}))
    monkeypatch.setattr(shared, "_get_session_history", lambda session_id: fake_history)
    monkeypatch.setattr(
        shared,
        "_finalize_session",
        lambda session_id: finalized.setdefault("session_id", session_id),
    )

    events = list(
        shared.stream_post_assistant_response(
            action_name="summarize",
            post_context=post_context,
            session_id="session-123",
            system_prompt="system",
            user_prompt="user",
            history_user_message="Summarize Piazza post 42.",
        )
    )

    parsed = [json.loads(event) for event in events]
    assert parsed == [
        {"type": "content", "content": "Hello"},
        {"type": "content", "content": " world"},
        {"type": "sources", "sources": ["42"]},
    ]
    assert fake_history.user_messages == ["Summarize Piazza post 42."]
    assert len(fake_history.ai_messages) == 1
    assert fake_history.ai_messages[0].content == "Hello world"
    assert fake_history.ai_messages[0].response_metadata == {"sources": ["42"]}
    assert finalized == {"session_id": "session-123"}


def test_simplify_prompt_supports_injectable_addon(post_context):
    """Simplify prompt assembly should include the proficiency add-on hook."""
    prompt = _build_simplify_user_prompt(
        post_context=post_context,
        proficiency=1,
        proficiency_prompt_addon="Prefer an analogy involving graph traversal.",
    )

    assert "Requested proficiency level: 1" in prompt
    assert "Prefer an analogy involving graph traversal." in prompt
    assert "Example Subject" in prompt


def test_translate_prompt_supports_injectable_addon(post_context):
    """Translate prompt assembly should include the language add-on hook."""
    prompt = _build_translate_user_prompt(
        post_context=post_context,
        language="French",
        language_prompt_addon="Prefer formal academic phrasing.",
    )

    assert "Translate the exact Piazza post below into French." in prompt
    assert "Prefer formal academic phrasing." in prompt
    assert "Example Subject" in prompt


def test_translate_endpoint_defaults_to_english(client, monkeypatch, post_context):
    """Translate should default to English when the frontend does not send a language."""
    captured = {}

    def fake_translate_stream(
        *, post_context, session_id, language, language_prompt_addon=""
    ):
        captured["post_num"] = post_context.post_num
        captured["session_id"] = session_id
        captured["language"] = language
        yield json.dumps({"type": "content", "content": "Translated text"}) + "\n"
        yield (
            json.dumps({"type": "sources", "sources": [str(post_context.post_num)]})
            + "\n"
        )

    monkeypatch.setattr(
        per_post_llm, "get_exact_post_context", lambda *_args: post_context
    )
    monkeypatch.setattr(
        per_post_llm, "stream_llm_translate_response", fake_translate_stream
    )

    response = client.post(
        "/per-post/translate",
        json={
            "thread_id": "course-123",
            "post_num": 42,
            "session_id": "session-123",
        },
    )

    assert response.status_code == 200
    parsed = [json.loads(line) for line in response.text.strip().splitlines()]
    assert parsed == [
        {"type": "content", "content": "Translated text"},
        {"type": "sources", "sources": ["42"]},
    ]
    assert captured == {
        "post_num": 42,
        "session_id": "session-123",
        "language": "English",
    }


def test_translate_endpoint_rejects_invalid_language(client):
    """Translate should validate against the fixed UI language list."""
    response = client.post(
        "/per-post/translate",
        json={
            "thread_id": "course-123",
            "post_num": 42,
            "session_id": "session-123",
            "language": "German",
        },
    )

    assert response.status_code == 422


def test_missing_exact_post_returns_clear_404(client, monkeypatch):
    """The endpoint should fail clearly when the exact post is missing."""
    monkeypatch.setattr(
        per_post_llm,
        "get_exact_post_context",
        lambda *_args: (_ for _ in ()).throw(
            PostAssistantContextError("Exact post missing from ingested content.")
        ),
    )

    response = client.post(
        "/per-post/summarize",
        json={
            "thread_id": "course-123",
            "post_num": 42,
            "session_id": "session-123",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Exact post missing from ingested content."


def test_simplify_endpoint_validates_supported_proficiency(client):
    """Only the 3 UI simplify levels should be accepted."""
    response = client.post(
        "/per-post/simplify/4",
        json={
            "thread_id": "course-123",
            "post_num": 42,
            "session_id": "session-123",
        },
    )

    assert response.status_code == 422

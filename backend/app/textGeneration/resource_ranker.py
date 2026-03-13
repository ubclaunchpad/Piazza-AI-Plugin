"""
Resource ranking and summarization for the Smart Resource Aggregator.

Uses an LLM (via ChatGroq) to refine relevance scores and optional summaries
for a small set of candidate resources. Falls back to a simple heuristic if
the LLM is unavailable or returns invalid output.
"""

import json
import logging
from typing import Any, Dict, List

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

logger = logging.getLogger(__name__)


def _heuristic_rank(resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fallback: ensure a relevance_score and sort descending by it."""
    ranked: List[Dict[str, Any]] = []
    for res in resources:
        item = dict(res)
        score = item.get("relevance_score")
        try:
            score = float(score) if score is not None else 0.5
        except (TypeError, ValueError):
            score = 0.5
        item["relevance_score"] = score
        ranked.append(item)
    ranked.sort(key=lambda r: r.get("relevance_score", 0.5), reverse=True)
    return ranked


def rank_resources(
    resources: List[Dict[str, Any]],
    query: str,
    piazza_course_id: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Rank and optionally filter a list of candidate resources using an LLM.

    Behavior:
    - Send a small subset of candidate resources and the user query to the LLM.
    - Ask the LLM to assign a relevance_score in [0, 1] and optionally
      refine the description.
    - Apply the new scores, sort descending, and return the updated list.
    - If anything goes wrong (missing keys, parse errors, LLM failure),
      fall back to a simple heuristic ranking.
    """
    if not resources:
        return []

    # Limit how many items we send to the LLM to keep prompts small
    max_for_llm = min(len(resources), 10)
    candidates = [
        {
            "index": idx,
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "resource_type": r.get("resource_type", "other"),
            "description": r.get("description", ""),
            # Let the LLM decide scores; start from a neutral baseline
            "relevance_score": 0.5,
        }
        for idx, r in enumerate(resources[:max_for_llm])
    ]

    try:
        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=512,
            max_retries=3,
        )

        system_prompt = (
            "You are ranking external learning resources for a university student.\n"
            "Given a query and a list of candidate resources, assign each resource a\n"
            "relevance_score between 0.0 and 1.0 (higher is more relevant) and, if\n"
            "helpful, improve the description to be concise and student-friendly.\n\n"
            "Return ONLY valid JSON: an array of objects with fields:\n"
            "  index (int, original index in the list),\n"
            "  relevance_score (float in [0,1]),\n"
            "  description (string, optional improved description).\n"
        )

        human_parts = {
            "query": query,
            "course": piazza_course_id or "",
            "candidates": json.dumps(candidates, ensure_ascii=False),
        }

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                (
                    "human",
                    "Query: {query}\n"
                    "Course (may be empty): {course}\n\n"
                    "Candidates (JSON):\n"
                    "{candidates}\n\n"
                    "Now respond with ONLY the JSON array as specified.",
                ),
            ]
        )

        chain = prompt | llm | StrOutputParser()
        raw = chain.invoke(human_parts)

        # Be tolerant of models that wrap JSON in backticks or extra text.
        text = raw.strip()
        if "```" in text:
            # Strip common markdown code fences like ```json ... ```
            text = text.replace("```json", "").replace("```", "").strip()

        # Try to isolate the JSON array portion
        start = text.find("[")
        end = text.rfind("]") + 1
        if start == -1 or end <= start:
            raise ValueError("LLM output did not contain a JSON array")

        json_str = text[start:end]
        ranked_specs = json.loads(json_str)
        if not isinstance(ranked_specs, list):
            raise ValueError("LLM output is not a list")

        # Build a mapping from index -> (score, new_description?)
        updates: Dict[int, Dict[str, Any]] = {}
        for spec in ranked_specs:
            if not isinstance(spec, dict):
                continue
            idx = spec.get("index")
            if idx is None or not isinstance(idx, int):
                continue
            score = spec.get("relevance_score")
            try:
                score_f = float(score)
            except (TypeError, ValueError):
                continue
            score_f = max(0.0, min(1.0, score_f))
            updates[idx] = {
                "relevance_score": score_f,
                "description": spec.get("description"),
            }

        if not updates:
            raise ValueError("LLM output did not contain usable ranking data")

        # Apply updates to a copy of the resources
        updated_resources: List[Dict[str, Any]] = []
        for idx, res in enumerate(resources):
            item = dict(res)
            if idx in updates:
                item["relevance_score"] = updates[idx]["relevance_score"]
                new_desc = updates[idx].get("description")
                if isinstance(new_desc, str) and new_desc.strip():
                    item["description"] = new_desc.strip()
            else:
                # Items not mentioned by the LLM are treated as low relevance
                item["relevance_score"] = 0.0
            updated_resources.append(item)

        # Sort by the new relevance_score, descending
        updated_resources.sort(
            key=lambda r: r.get("relevance_score", 0.5), reverse=True
        )
        return updated_resources
    except Exception as e:
        logger.warning("LLM ranking failed, falling back to heuristic: %s", e)
        return _heuristic_rank(resources)


__all__ = ["rank_resources"]


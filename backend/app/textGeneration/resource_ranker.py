"""
Resource ranking and summarization for the Smart Resource Aggregator.

To be implemented:call an LLM to filter, re-rank, and summarize resources. 
For now, this module provides a simple deterministic ranking function.
"""

from typing import Any, Dict, List


def rank_resources(
    resources: List[Dict[str, Any]],
    query: str,
    piazza_course_id: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Rank and optionally filter a list of candidate resources.

    Current behavior (stub):
    - Leaves the list order unchanged.
    - Ensures each resource has a relevance_score field (defaults to 0.5).
    - Returns the list as-is, ignoring query and piazza_course_id.
    """
    ranked: List[Dict[str, Any]] = []
    for res in resources:
        item = dict(res)
        item.setdefault("relevance_score", 0.5)
        ranked.append(item)
    return ranked


__all__ = ["rank_resources"]


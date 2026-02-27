"""
Resource provider interfaces for the Smart Resource Aggregator.
Returns stubbed data.
"""

from typing import Any, Dict, List


async def fetch_youtube_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from YouTube matching the given query.

    Stub implementation: returns a small fixed list in the unified resource shape.
    """
    return [
        {
            "title": f"{query} – YouTube overview",
            "url": "https://www.youtube.com/",
            "resource_type": "youtube",
            "description": f"Introductory YouTube video explaining {query}.",
            "relevance_score": 0.9,
        }
    ][:limit]


async def fetch_stackoverflow_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from StackOverflow matching the given query.

    Stub implementation: returns a small fixed list in the unified resource shape.
    """
    return [
        {
            "title": f"{query} – StackOverflow Q&A",
            "url": "https://stackoverflow.com/questions/example",
            "resource_type": "stackoverflow",
            "description": f"Popular StackOverflow discussion related to {query}.",
            "relevance_score": 0.85,
        }
    ][:limit]


async def fetch_khan_academy_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from Khan Academy matching the given query.

    Stub implementation: returns a small fixed list in the unified resource shape.
    """
    return [
        {
            "title": f"{query} – Khan Academy lesson",
            "url": "https://www.khanacademy.org/",
            "resource_type": "khan_academy",
            "description": f"Khan Academy lesson related to {query}.",
            "relevance_score": 0.8,
        }
    ][:limit]


async def fetch_wikipedia_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from Wikipedia matching the given query.

    Stub implementation: returns a small fixed list in the unified resource shape.
    """
    return [
        {
            "title": f"{query} – Wikipedia article",
            "url": "https://en.wikipedia.org/wiki/Example",
            "resource_type": "wikipedia",
            "description": f"Wikipedia article giving background on {query}.",
            "relevance_score": 0.75,
        }
    ][:limit]


__all__ = [
    "fetch_youtube_resources",
    "fetch_stackoverflow_resources",
    "fetch_khan_academy_resources",
    "fetch_wikipedia_resources",
]


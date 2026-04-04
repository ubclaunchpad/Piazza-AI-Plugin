"""
Resource provider interfaces for the Smart Resource Aggregator.

Each function hits an external API and returns a list of dicts shaped
for downstream consumption by the ranking layer and API models.

If a provider is misconfigured (e.g. missing API key) or an error occurs,
the function should raise or be caught by the caller; the /resources/search
endpoint wraps these calls.
"""

import logging
from typing import Any, Dict, List
from urllib.parse import urlencode

import requests
from googleapiclient.discovery import build

from app.core.config import settings

logger = logging.getLogger(__name__)


async def fetch_youtube_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from YouTube Data API v3.

    Requires:
      - settings.YOUTUBE_API_KEY to be set.
    """
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        logger.info("YOUTUBE_API_KEY not configured; skipping YouTube provider")
        return []

    try:
        youtube = build("youtube", "v3", developerKey=api_key)
        search_response = (
            youtube.search()
            .list(
                q=query,
                part="snippet",
                type="video",
                maxResults=min(limit, 10),
            )
            .execute()
        )

        items: List[Dict[str, Any]] = []
        for item in search_response.get("items", []):
            video_id = item["id"]["videoId"]
            snippet = item["snippet"]
            title = snippet.get("title", "")
            description = snippet.get("description", "")
            url = f"https://www.youtube.com/watch?v={video_id}"

            items.append(
                {
                    "title": title,
                    "url": url,
                    "resource_type": "youtube",
                    "description": description,
                }
            )

        return items[:limit]
    except Exception as e:
        logger.warning("YouTube provider failed: %s", e)
        return []


async def fetch_stackoverflow_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from Stack Exchange (StackOverflow) search API.

    Optionally uses:
      - settings.STACKEXCHANGE_API_KEY
      - settings.STACKEXCHANGE_SITE (default 'stackoverflow')
    """
    try:
        params = {
            "order": "desc",
            "sort": "relevance",
            "q": query,
            "site": settings.STACKEXCHANGE_SITE or "stackoverflow",
            "pagesize": min(limit, 10),
        }
        if settings.STACKEXCHANGE_API_KEY:
            params["key"] = settings.STACKEXCHANGE_API_KEY

        resp = requests.get("https://api.stackexchange.com/2.3/search/advanced", params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        items: List[Dict[str, Any]] = []
        for item in data.get("items", []):
            title = item.get("title", "")
            question_id = item.get("question_id")
            url = item.get("link") or (
                f"https://stackoverflow.com/questions/{question_id}" if question_id else ""
            )
            description = item.get("excerpt") or title

            items.append(
                {
                    "title": title,
                    "url": url,
                    "resource_type": "stackoverflow",
                    "description": description,
                }
            )
        return items[:limit]
    except Exception as e:
        logger.warning("StackOverflow provider failed: %s", e)
        return []


def _khan_academy_search_url(query: str) -> str:
    """Khan site search URL (stub provider does not call their API)."""
    q = (query or "").strip()
    params = {"referer": "/", "page_search_query": q}
    return f"https://www.khanacademy.org/search?{urlencode(params)}"


async def fetch_khan_academy_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Short‑term Khan Academy provider.

    Returns a single item linking to Khan Academy's on-site search for the
    query (no API; avoids brittle scraping until a stable integration exists).
    """
    q = (query or "").strip()
    return [
        {
            "title": f'Search Khan Academy for "{q}"',
            "url": _khan_academy_search_url(query),
            "resource_type": "khan_academy",
            "description": f"Open Khan Academy search results for {q}.",
        }
    ][:limit]


async def fetch_wikipedia_resources(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Fetch resources from Wikipedia using the opensearch API.
    """
    try:
        params = {
            "search": query,
            "limit": min(limit, 10),
            "namespace": 0,
        }
        headers = {
            # Use an explicit User-Agent to comply with Wikipedia API policies
            "User-Agent": "PiazzaAI-ResourceAggregator/0.1 (contact: change-me@example.com)",
        }
        resp = requests.get(
            "https://en.wikipedia.org/w/api.php?action=opensearch&format=json",
            params=params,
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        # opensearch returns [search term, titles[], descriptions[], links[]]
        titles = data[1] if len(data) > 1 else []
        descriptions = data[2] if len(data) > 2 else []
        links = data[3] if len(data) > 3 else []

        items: List[Dict[str, Any]] = []
        for title, desc, link in zip(titles, descriptions, links):
            items.append(
                {
                    "title": title,
                    "url": link,
                    "resource_type": "wikipedia",
                    "description": desc or title,
                    "relevance_score": 0.5,
                }
            )
        return items[:limit]
    except Exception as e:
        logger.warning("Wikipedia provider failed: %s", e)
        return []


__all__ = [
    "fetch_youtube_resources",
    "fetch_stackoverflow_resources",
    "fetch_khan_academy_resources",
    "fetch_wikipedia_resources",
]


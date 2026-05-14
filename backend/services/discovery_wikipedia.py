"""
Wikipedia enrichment — pulls a one-paragraph summary and a thumbnail image
for a place title. Free, no API key, generous public rate limits.

Usage pattern: pass the OSM-derived place name (e.g. "Eiffel Tower"), get
back the summary text and a thumbnail URL. Results are cached in-memory for
24 h so we don't hammer Wikipedia on a repeated suggestion list.

Failure mode: if Wikipedia has no matching article we return an empty dict
silently — call sites should treat the enrichment as a best-effort bonus,
not a required field.
"""

import asyncio
import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary"
DEFAULT_TIMEOUT_S = 6.0
CACHE_TTL_S = 24 * 60 * 60   # 24 h

# title (lowercased, trimmed) → (timestamp, summary_dict)
_summary_cache: dict[str, tuple[float, dict]] = {}


def _cache_get(title: str) -> Optional[dict]:
    key = title.strip().lower()
    entry = _summary_cache.get(key)
    if not entry:
        return None
    ts, data = entry
    if time.time() - ts > CACHE_TTL_S:
        _summary_cache.pop(key, None)
        return None
    return data


def _cache_put(title: str, data: dict) -> None:
    key = title.strip().lower()
    # Keep the cache from growing without bound — a simple cap, FIFO eviction.
    if len(_summary_cache) > 5000:
        oldest = next(iter(_summary_cache))
        _summary_cache.pop(oldest, None)
    _summary_cache[key] = (time.time(), data)


async def get_wikipedia_summary(title: str) -> dict:
    """Fetch a Wikipedia summary for `title`. Returns {} if not found.

    Returned shape on hit:
      {
        "title":    "Eiffel Tower",
        "extract":  "The Eiffel Tower is a wrought-iron lattice tower ...",
        "thumbnail": "https://upload.wikimedia.org/.../tower.jpg",
        "url":       "https://en.wikipedia.org/wiki/Eiffel_Tower",
      }
    """
    if not title or not title.strip():
        return {}

    cached = _cache_get(title)
    if cached is not None:
        return cached

    # Wikipedia expects the title with spaces replaced by underscores.
    safe_title = title.strip().replace(" ", "_")
    url = f"{WIKI_SUMMARY_URL}/{safe_title}"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            resp = await client.get(
                url,
                headers={
                    # Wikipedia asks API users to set a descriptive UA so they
                    # can contact us if our traffic looks abnormal.
                    "User-Agent": "TravelerHub/1.0 (https://travelhub.fozhan.dev)",
                    "Accept": "application/json",
                },
            )
    except httpx.HTTPError as e:
        logger.debug("Wikipedia fetch failed for %s: %s", title, e)
        _cache_put(title, {})
        return {}

    if resp.status_code == 404:
        _cache_put(title, {})
        return {}
    if resp.status_code >= 400:
        logger.debug("Wikipedia returned %s for %s", resp.status_code, title)
        return {}

    try:
        payload = resp.json()
    except Exception:
        return {}

    # `disambiguation` pages usually aren't useful for trip context.
    if payload.get("type") == "disambiguation":
        _cache_put(title, {})
        return {}

    summary = {
        "title": payload.get("title") or title,
        "extract": payload.get("extract") or "",
        "thumbnail": (payload.get("thumbnail") or {}).get("source"),
        "url": (payload.get("content_urls") or {}).get("desktop", {}).get("page"),
    }
    _cache_put(title, summary)
    return summary


async def enrich_with_wikipedia(items: list[dict], title_key: str = "name") -> list[dict]:
    """Add a `wikipedia` sub-dict to each item using its `title_key` field.

    Runs all lookups concurrently with a hard cap (asyncio.gather + semaphore)
    so a long list doesn't take 100 sequential round-trips.
    """
    if not items:
        return items

    sem = asyncio.Semaphore(8)

    async def _enrich_one(item: dict) -> None:
        # Items that already carry an OSM `wikipedia=Lang:Title` tag (rare but
        # gold-standard) get used directly; everything else falls back to the
        # name lookup.
        wiki_tag = item.get("wikipedia")
        title = None
        if isinstance(wiki_tag, str) and ":" in wiki_tag:
            # OSM convention: "en:Eiffel Tower"
            _lang, _, raw_title = wiki_tag.partition(":")
            title = raw_title.strip() or None
        if not title:
            title = item.get(title_key)
        if not title:
            return
        async with sem:
            data = await get_wikipedia_summary(title)
        if data:
            item["wikipedia"] = data

    await asyncio.gather(*[_enrich_one(it) for it in items])
    return items

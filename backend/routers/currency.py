from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import httpx

router = APIRouter(prefix="/api/currency", tags=["Currency"])

# In-memory cache: { "rates": {...}, "fetched_at": datetime }
_rates_cache: dict = {}
CACHE_TTL_SECONDS = 6 * 3600  # 6 hours

@router.get("/rates")
async def get_exchange_rates(base: str = "USD"):
    """
    Returns exchange rates relative to `base` currency.
    Cached for 6 hours to avoid hammering the free API.
    """
    cache_key = base.upper()
    cached = _rates_cache.get(cache_key)
    now = datetime.now(timezone.utc).timestamp()

    if cached and (now - cached["fetched_at"]) < CACHE_TTL_SECONDS:
        return {"base": cache_key, "rates": cached["rates"], "cached": True}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://open.er-api.com/v6/latest/{cache_key}")
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        if cached:  # return stale cache rather than failing
            return {"base": cache_key, "rates": cached["rates"], "cached": True, "stale": True}
        raise HTTPException(status_code=503, detail="Exchange rate service unavailable")

    rates = data.get("rates", {})
    _rates_cache[cache_key] = {"rates": rates, "fetched_at": now}
    return {"base": cache_key, "rates": rates, "cached": False}

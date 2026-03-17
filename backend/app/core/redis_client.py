"""Redis client — shared instance for rate limiting and caching"""
import redis.asyncio as aioredis
import redis as syncredis
from ..config import settings

# Async client (used by slowapi limiter)
redis_client = aioredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)

# Sync client (used for simple get/set operations if needed)
sync_redis = syncredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)

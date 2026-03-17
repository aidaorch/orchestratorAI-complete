from slowapi import Limiter as _Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import Request
from fastapi.responses import JSONResponse
from ..config import settings


def _get_real_ip(request: Request) -> str:
    """Get real client IP — respects X-Forwarded-For set by nginx."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


def _json_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}. Please try again later."},
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )


limiter = _Limiter(
    key_func=_get_real_ip,
    storage_uri=settings.REDIS_URL,
    default_limits=[],
)

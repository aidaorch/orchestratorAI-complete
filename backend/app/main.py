"""Main FastAPI application"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from .config import settings
from .database import init_db, get_db
from .api import auth, workflow, template, admin, learning
from .core.limiter import limiter, _json_rate_limit_handler
from .core.exceptions import (
    WorkflowNotFoundException,
    TemplateNotFoundException,
    UnauthorizedException,
    ValidationException,
    AIServiceException
)
import logging
import logging.handlers
import os
from datetime import datetime

# ── Logging setup ─────────────────────────────────────────────────────────────
# Ensure log directory exists
LOG_DIR = "/var/log/app"
os.makedirs(LOG_DIR, exist_ok=True)

# Root logger
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Server error log — ERROR and above only, rotates daily, keeps 30 days
_error_handler = logging.handlers.TimedRotatingFileHandler(
    filename=os.path.join(LOG_DIR, "error.log"),
    when="midnight",
    backupCount=30,
    encoding="utf-8",
)
_error_handler.setLevel(logging.ERROR)
_error_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

# Application log — INFO and above, rotates daily, keeps 14 days
_app_handler = logging.handlers.TimedRotatingFileHandler(
    filename=os.path.join(LOG_DIR, "app.log"),
    when="midnight",
    backupCount=14,
    encoding="utf-8",
)
_app_handler.setLevel(logging.INFO)
_app_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

# Attach handlers to root logger so all modules inherit them
root_logger = logging.getLogger()
root_logger.addHandler(_error_handler)
root_logger.addHandler(_app_handler)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS allowed origins: {_allowed_origins}")
    yield


# Docs always enabled — access is gated by admin auth in the frontend
_docs_url = f"{settings.API_V1_PREFIX}/docs"
_redoc_url = f"{settings.API_V1_PREFIX}/redoc"
_openapi_url = f"{settings.API_V1_PREFIX}/openapi.json"

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered workflow orchestration platform",
    version=settings.VERSION,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
    lifespan=lifespan
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _json_rate_limit_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
_allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(WorkflowNotFoundException)
async def workflow_not_found_handler(request: Request, exc: WorkflowNotFoundException):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Workflow not found"})


@app.exception_handler(TemplateNotFoundException)
async def template_not_found_handler(request: Request, exc: TemplateNotFoundException):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Template not found"})


@app.exception_handler(UnauthorizedException)
async def unauthorized_handler(request: Request, exc: UnauthorizedException):
    return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Unauthorized"})


@app.exception_handler(ValidationException)
async def validation_handler(request: Request, exc: ValidationException):
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": str(exc)})


@app.exception_handler(AIServiceException)
async def ai_service_handler(request: Request, exc: AIServiceException):
    logger.error(f"AI service error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": str(exc)})


@app.exception_handler(SQLAlchemyError)
async def database_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Database error occurred"})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"}
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(workflow.router, prefix=f"{settings.API_V1_PREFIX}/workflow", tags=["Workflows"])
app.include_router(template.router, prefix=f"{settings.API_V1_PREFIX}/template", tags=["Templates"])
app.include_router(admin.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin"])
app.include_router(learning.router, prefix=f"{settings.API_V1_PREFIX}/learning", tags=["Learning"])


# ── Root & Health ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message": f"{settings.PROJECT_NAME} API",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": f"{settings.API_V1_PREFIX}/docs"
    }


@app.get(f"{settings.API_V1_PREFIX}/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development"
    )

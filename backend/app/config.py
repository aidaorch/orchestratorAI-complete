"""Application configuration"""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import Literal, Optional


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenAI
    OPENAI_API_KEY: str = Field(..., min_length=10)

    # Security — SECRET_KEY must be at least 32 chars (256-bit)
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=1440)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=90)

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Environment
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # API
    API_V1_PREFIX: str = "/api"
    PROJECT_NAME: str = "Orchestrator AI"
    VERSION: str = "1.0.0"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_not_default(cls, v: str) -> str:
        insecure = {"secret", "changeme", "your-secret-key", "your-256-bit-secret-key"}
        if v.lower() in insecure:
            raise ValueError("SECRET_KEY must not be a default/placeholder value")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

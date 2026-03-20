"""Application configuration using pydantic-settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # Database
    DATABASE_URL: str = "sqlite:///./data/nexus.db"

    # JWT
    JWT_SECRET: str = "change-this-to-a-random-string"  # TODO: read from env in production
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # First-run admin
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "Admin@2026"

    # Gateway
    GATEWAY_WS_PORT: int = 8765
    GATEWAY_HEARTBEAT_INTERVAL: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"

    # LLM
    NEXUS_LLM_PROVIDERS: str = ""
    NEXUS_LLM_MODEL: str = "deepseek/deepseek-chat"
    NEXUS_LLM_TIMEOUT: int = 120

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

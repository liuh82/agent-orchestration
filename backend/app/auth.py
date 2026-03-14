"""Simple API Key authentication middleware for MVP"""
import os
import secrets
from typing import Optional
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

# 从环境变量读取 API Key，如果没有则生成一个默认值（仅用于开发环境）
API_KEYS = set()

# 从环境变量加载 API Keys（用逗号分隔）
env_api_keys = os.getenv("API_KEYS", "")
if env_api_keys:
    API_KEYS.update(key.strip() for key in env_api_keys.split(","))

# 如果没有配置任何 API Key，使用开发环境的默认 Key（生产环境必须配置）
if not API_KEYS:
    DEV_API_KEY = os.getenv("DEV_API_KEY", "dev-api-key-please-change-in-production")
    API_KEYS.add(DEV_API_KEY)
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("Using default dev API key. Please set API_KEYS or DEV_API_KEY in production!")


api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """Verify API Key from header"""
    if api_key is None or api_key not in API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key. Provide X-API-Key header.",
        )
    return api_key


def generate_api_key() -> str:
    """Generate a new API Key"""
    return secrets.token_urlsafe(32)


def add_api_key(key: str) -> None:
    """Add an API Key to the whitelist"""
    API_KEYS.add(key)


def is_auth_enabled() -> bool:
    """Check if authentication is enabled"""
    return bool(os.getenv("AUTH_ENABLED", "true").lower() == "true")


def verify_gateway_token(token: str) -> bool:
    """Verify Gateway WebSocket Token (reuses existing API Key)."""
    return token in API_KEYS

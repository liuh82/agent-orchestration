"""Simple API Key authentication middleware for MVP"""
import logging
import os
import secrets
from typing import Optional
from fastapi import Depends, Request, Security, HTTPException, status
from fastapi.security import APIKeyHeader

logger = logging.getLogger(__name__)


def _load_api_keys() -> set[str]:
    """Load API keys from environment variables.

    - API_KEYS env var (comma-separated) is the primary source.
    - In production/staging, missing API_KEYS causes a fatal startup error.
    - In development, a local-only default key is used with a warning.
    """
    keys: set[str] = set()
    raw = os.getenv("API_KEYS", "")
    if raw:
        for key in raw.split(","):
            key = key.strip()
            if key:
                keys.add(key)

    if not keys:
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env in ("production", "prod", "staging"):
            raise RuntimeError(
                "FATAL: API_KEYS environment variable must be set in "
                "production/staging environment. "
                "Example: export API_KEYS='key1,key2,key3'"
            )
        # Development only
        keys.add("dev-api-key-local-only")
        logger.warning(
            "Running with INSECURE default API key. "
            "This is acceptable ONLY in local development. "
            "Set API_KEYS env var for any shared environment."
        )

    return keys


def _load_admin_api_keys() -> set[str]:
    """Load admin API keys from ADMIN_API_KEYS env var (comma-separated).

    If ADMIN_API_KEYS is not set, ALL valid API keys are treated as admin.
    This preserves backward compatibility for single-user deployments.
    """
    raw = os.getenv("ADMIN_API_KEYS", "")
    if raw:
        return {k.strip() for k in raw.split(",") if k.strip()}
    # No admin keys configured: all authenticated keys are admin
    return set()


API_KEYS = _load_api_keys()
ADMIN_API_KEYS = _load_admin_api_keys()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    api_key: Optional[str] = Security(api_key_header),
    request: Request = None,
) -> str:
    """Verify API Key from header or accept JWT Bearer token from web UI."""
    if api_key and api_key in API_KEYS:
        return api_key

    # Fallback: accept JWT Bearer token for web UI requests
    if request:
        from app.services.auth import decode_token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = decode_token(token)
                if payload.get("type") == "access":
                    return f"bearer:{payload['sub']}"
            except Exception:
                pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API Key. Provide X-API-Key header or Bearer token.",
    )


async def verify_admin_key(
    api_key: str = Depends(verify_api_key),
) -> str:
    """Verify admin privileges.

    When ADMIN_API_KEYS is set, only keys in that set are allowed.
    When ADMIN_API_KEYS is empty, all valid API keys are admin (backward compat).
    """
    if ADMIN_API_KEYS and api_key not in ADMIN_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for this operation",
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

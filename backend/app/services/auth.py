"""Authentication service — password hashing and JWT dual-token management."""
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from jose import jwt, JWTError
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user_session_token import UserSessionToken


ALGORITHM = settings.JWT_ALGORITHM
ACCESS_EXPIRE_MINUTES = settings.JWT_ACCESS_EXPIRE_MINUTES
REFRESH_EXPIRE_DAYS = settings.JWT_REFRESH_EXPIRE_DAYS


# ── Password helpers ──────────────────────────────────────────────


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── Token helpers ─────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    """SHA-256 hash of the raw token for DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "jti": str(uuid4()),
        "exp": _now() + timedelta(minutes=ACCESS_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": str(uuid4()),
        "exp": _now() + timedelta(days=REFRESH_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token, returning its payload."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Refresh token persistence ────────────────────────────────────


def store_refresh_token(db: Session, user_id: str, raw_token: str,
                        device_info: Optional[str] = None,
                        ip_address: Optional[str] = None) -> None:
    """Hash the refresh token and persist it to user_session_tokens."""
    payload = decode_token(raw_token)
    token_record = UserSessionToken(
        user_id=user_id,
        token_type="refresh",
        token_hash=_hash_token(raw_token),
        jti=payload.get("jti"),
        device_info=device_info,
        ip_address=ip_address,
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc).isoformat() + "Z",
    )
    db.add(token_record)
    db.commit()


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    """Mark a refresh token as revoked by its hash."""
    token_hash = _hash_token(raw_token)
    record = (
        db.query(UserSessionToken)
        .filter(
            UserSessionToken.token_hash == token_hash,
            UserSessionToken.revoked_at.is_(None),
        )
        .first()
    )
    if record:
        record.revoked_at = _now().isoformat() + "Z"
        db.commit()


def is_token_revoked(db: Session, raw_token: str) -> bool:
    """Check if a refresh token has been revoked."""
    token_hash = _hash_token(raw_token)
    record = (
        db.query(UserSessionToken)
        .filter(UserSessionToken.token_hash == token_hash)
        .first()
    )
    return record is not None and record.revoked_at is not None

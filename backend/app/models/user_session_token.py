"""UserSessionToken ORM model."""
from typing import Optional

from sqlalchemy import String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import generate_uuid


class UserSessionToken(Base):
    __tablename__ = "user_session_tokens"
    __table_args__ = (
        Index("idx_session_tokens_user", "user_id"),
        Index("idx_session_tokens_hash", "token_hash", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    token_type: Mapped[str] = mapped_column(String(20), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    jti: Mapped[Optional[str]] = mapped_column(String(36))
    device_info: Mapped[Optional[str]] = mapped_column(String(255))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    expires_at: Mapped[Optional[str]] = mapped_column(String)
    revoked_at: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[Optional[str]] = mapped_column(String)

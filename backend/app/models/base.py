"""Public model base classes and mixins."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TimestampMixin:
    """Common timestamp fields for all models."""

    created_at: Mapped[str] = mapped_column(
        String, default=lambda: datetime.utcnow().isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        String, default=lambda: datetime.utcnow().isoformat(),
        onupdate=lambda: datetime.utcnow().isoformat(),
    )


def generate_uuid() -> str:
    """Generate a UUID4 string."""
    return str(uuid4())

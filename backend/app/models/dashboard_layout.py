"""DashboardLayout ORM model."""
from typing import Optional

from sqlalchemy import String, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class DashboardLayout(Base, TimestampMixin):
    __tablename__ = "dashboard_layouts"
    __table_args__ = (
        Index("idx_dashboard_layouts_user_scope", "user_id", "scope"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    layout: Mapped[Optional[str]] = mapped_column(Text)

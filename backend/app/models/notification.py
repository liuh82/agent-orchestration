"""NotificationChannel ORM model."""
from typing import Optional

from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class NotificationChannel(Base, TimestampMixin):
    __tablename__ = "notification_channels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String(36))  # NULL = global
    channel_type: Mapped[str] = mapped_column(String(50), nullable=False)  # feishu/dingtalk/wecom
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    triggers: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

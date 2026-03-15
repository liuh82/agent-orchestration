"""AgentType ORM model."""
from typing import Optional

from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class AgentType(Base, TimestampMixin):
    __tablename__ = "agent_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255))
    protocol: Mapped[str] = mapped_column(String(50), nullable=False)  # ssh, websocket, local_process
    config_schema: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    capabilities: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    default_models: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))  # FK to users, optional

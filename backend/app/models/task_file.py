"""TaskFile ORM model."""
from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import generate_uuid


class TaskFile(Base):
    __tablename__ = "task_files"
    __table_args__ = (
        Index("idx_task_files_task_id", "task_id"),
        Index("idx_task_files_file_type", "file_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[Optional[str]] = mapped_column(String)

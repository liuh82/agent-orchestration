"""Gateway ORM models for SQLAlchemy 2.0."""
import time
from typing import Optional, List, Dict

from sqlalchemy import String, Integer, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BridgeRecord(Base):
    """Bridge persistent record."""
    __tablename__ = 'gateway_bridges'
    __table_args__ = (
        Index('idx_gateway_bridges_status', 'status'),
        Index('idx_gateway_bridges_last_seen', 'last_seen'),
        Index('idx_gateway_bridges_bridge_id', 'bridge_id', unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bridge_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    os_version: Mapped[Optional[str]] = mapped_column(String(100))
    node_version: Mapped[Optional[str]] = mapped_column(String(50))
    bridge_version: Mapped[Optional[str]] = mapped_column(String(50))
    # Bridge configuration fields (user-defined)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bridge_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # websocket, http, grpc, stdio
    host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    protocol: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    auth_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='offline')
    last_seen: Mapped[int] = mapped_column(Integer, nullable=False)
    available_adapters: Mapped[list] = mapped_column(JSON, nullable=False)
    active_tasks: Mapped[int] = mapped_column(Integer, default=0)
    max_concurrent: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(time.time())
    )
    updated_at: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(time.time())
    )

    # Relationships
    tasks: Mapped[List["TaskRecord"]] = relationship(
        'TaskRecord', back_populates='bridge', cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f"<BridgeRecord bridge_id={self.bridge_id} status={self.status}>"


class TaskRecord(Base):
    """Task persistent record."""
    __tablename__ = 'gateway_tasks'
    __table_args__ = (
        Index('idx_gateway_tasks_status', 'status'),
        Index('idx_gateway_tasks_bridge_id', 'bridge_id'),
        Index('idx_gateway_tasks_submitted_at', 'submitted_at'),
        Index('idx_gateway_tasks_task_id', 'task_id', unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    bridge_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey('gateway_bridges.bridge_id', ondelete='CASCADE'),
        nullable=False,
    )

    # Task content
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    project_path: Mapped[str] = mapped_column(Text, nullable=False)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    timeout: Mapped[int] = mapped_column(Integer, default=300)
    priority: Mapped[str] = mapped_column(String(20), default='normal')
    preferred_ide: Mapped[Optional[str]] = mapped_column(String(50))

    # Task source
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    callback_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Task status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending')
    output: Mapped[Optional[str]] = mapped_column(Text)
    error: Mapped[Optional[str]] = mapped_column(Text)
    exit_code: Mapped[Optional[int]] = mapped_column(Integer)
    changed_files: Mapped[Optional[List[str]]] = mapped_column(JSON)
    duration: Mapped[Optional[int]] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    submitted_at: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[Optional[int]] = mapped_column(Integer)
    completed_at: Mapped[Optional[int]] = mapped_column(Integer)

    # Relationships
    bridge: Mapped["BridgeRecord"] = relationship(
        'BridgeRecord', back_populates='tasks'
    )

    def __repr__(self):
        return f"<TaskRecord task_id={self.task_id} status={self.status}>"

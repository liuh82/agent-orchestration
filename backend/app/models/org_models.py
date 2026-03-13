from sqlalchemy import String, Integer, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from uuid import uuid4
from datetime import datetime
from typing import List, Optional


class OrganizationChartNode(Base):
    __tablename__ = "org_chart_nodes"
    __table_args__ = (
        Index('idx_org_chart_nodes_parent_id', 'parent_id'),
        Index('idx_org_chart_nodes_level', 'level'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("org_chart_nodes.id"))
    children_ids: Mapped[Optional[str]] = mapped_column(Text)  # comma-separated list of child IDs
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    avatar: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    parent: Mapped[Optional["OrganizationChartNode"]] = relationship("OrganizationChartNode", remote_side=[id], back_populates="children")
    children: Mapped[List["OrganizationChartNode"]] = relationship("OrganizationChartNode", back_populates="parent")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        Index('idx_departments_parent_id', 'parent_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("departments.id"))
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    parent: Mapped[Optional["Department"]] = relationship("Department", remote_side=[id], back_populates="children")
    children: Mapped[List["Department"]] = relationship("Department", back_populates="parent")
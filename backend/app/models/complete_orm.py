from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, Index, func, desc
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from uuid import uuid4
from typing import List, Optional
from datetime import datetime

# tasks.db tables

class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (
        Index('idx_agents_status_created_at', 'status', 'created_at'),
        Index('idx_agents_agent_type_created_at', 'agent_type', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False)  # general, custom, system
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(20), default="stopped")  # running, stopped, error
    budget: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="agent")
    workflows: Mapped[List["Workflow"]] = relationship("Workflow", back_populates="agent")
    heartbeats: Mapped[List["Heartbeat"]] = relationship("Heartbeat", back_populates="agent")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="agent")
    cost_records: Mapped[List["Cost"]] = relationship("Cost", back_populates="agent")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index('idx_tasks_agent_id_created_at', 'agent_id', 'created_at'),
        Index('idx_tasks_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, running, completed, failed
    priority: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    assigned_to: Mapped[Optional[str]] = mapped_column(String)
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer)  # minutes
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    result: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="tasks")


class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    __table_args__ = (
        Index('idx_assignments_task_id_member_id', 'task_id', 'member_id'),
        Index('idx_assignments_agent_id_created_at', 'agent_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    member_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id"))
    assigned_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    assigned_by: Mapped[Optional[str]] = mapped_column(String)  # member_id
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, in_progress, completed, rejected
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    task: Mapped["Task"] = relationship("Task")
    agent: Mapped["Agent"] = relationship("Agent")
    member: Mapped[Optional["Member"]] = relationship("Member")


class Workflow(Base):
    __tablename__ = "workflows"
    __table_args__ = (
        Index('idx_workflows_agent_id_created_at', 'agent_id', 'created_at'),
        Index('idx_workflows_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, active, paused, completed
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="workflows")
    executions: Mapped[List["WorkflowExecution"]] = relationship("WorkflowExecution", back_populates="workflow")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    __table_args__ = (
        Index('idx_workflow_executions_workflow_id_created_at', 'workflow_id', 'created_at'),
        Index('idx_workflow_executions_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    workflow_id: Mapped[str] = mapped_column(String, ForeignKey("workflows.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, running, completed, failed
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    result: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="executions")
    logs: Mapped[List["WorkflowLog"]] = relationship("WorkflowLog", back_populates="execution")


class WorkflowLog(Base):
    __tablename__ = "workflow_logs"
    __table_args__ = (
        Index('idx_workflow_logs_execution_id_timestamp', 'execution_id', 'timestamp'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    execution_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_executions.id"))
    level: Mapped[str] = mapped_column(String(20), nullable=False)  # INFO, WARNING, ERROR
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    execution: Mapped["WorkflowExecution"] = relationship("WorkflowExecution", back_populates="logs")


class Cost(Base):
    __tablename__ = "costs"
    __table_args__ = (
        Index('idx_costs_agent_id_created_at', 'agent_id', 'created_at'),
        Index('idx_costs_resource_id_created_at', 'resource_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # api_call, token, compute
    resource_id: Mapped[str] = mapped_column(String)
    details: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="cost_records")


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        Index('idx_roles_code_is_active', 'code', 'is_active'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    permissions: Mapped[Optional[str]] = mapped_column(Text)  # comma-separated
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    members: Mapped[List["Member"]] = relationship("Member", back_populates="role")


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        Index('idx_members_email_is_active', 'email', 'is_active'),
        Index('idx_members_role_id_created_at', 'role_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    role_id: Mapped[str] = mapped_column(String, ForeignKey("roles.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="members")
    approvals: Mapped[List["Approval"]] = relationship("Approval", back_populates="member")
    task_assignments: Mapped[List["TaskAssignment"]] = relationship("TaskAssignment", back_populates="member")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        Index('idx_goals_member_id_created_at', 'member_id', 'created_at'),
        Index('idx_goals_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    member_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    priority: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, cancelled
    target_date: Mapped[Optional[str]] = mapped_column(String)  # ISO format
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    member: Mapped["Member"] = relationship("Member")
    alignments: Mapped[List["GoalAlignment"]] = relationship("GoalAlignment", back_populates="goal")


class GoalAlignment(Base):
    __tablename__ = "goal_alignments"
    __table_args__ = (
        Index('idx_goal_alignments_goal_id_child_goal_id', 'goal_id', 'child_goal_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    goal_id: Mapped[str] = mapped_column(String, ForeignKey("goals.id"))
    child_goal_id: Mapped[str] = mapped_column(String, ForeignKey("goals.id"))
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    goal: Mapped["Goal"] = relationship("Goal", foreign_keys=[goal_id], back_populates="alignments")
    child_goal: Mapped["Goal"] = relationship("Goal", foreign_keys=[child_goal_id])


class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (
        Index('idx_approvals_member_id_status_created_at', 'member_id', 'status', 'created_at'),
        Index('idx_approvals_type_status_created_at', 'type', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # role_change, budget_change, org_change
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    member_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, approved, rejected
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    member: Mapped["Member"] = relationship("Member", back_populates="approvals")
    history: Mapped[List["ApprovalHistory"]] = relationship("ApprovalHistory", back_populates="approval")


class ApprovalHistory(Base):
    __tablename__ = "approval_history"
    __table_args__ = (
        Index('idx_approval_history_approval_id_created_at', 'approval_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    approval_id: Mapped[str] = mapped_column(String, ForeignKey("approvals.id"))
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # created, approved, rejected
    comments: Mapped[Optional[str]] = mapped_column(Text)
    member_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    approval: Mapped["Approval"] = relationship("Approval", back_populates="history")
    member: Mapped["Member"] = relationship("Member")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index('idx_audit_logs_resource_type_created_at', 'resource_type', 'created_at'),
        Index('idx_audit_logs_member_id_created_at', 'member_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    member_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str] = mapped_column(String)
    details: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    user: Mapped[Optional["Member"]] = relationship("Member")


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


class Heartbeat(Base):
    __tablename__ = "heartbeats"
    __table_args__ = (
        Index('idx_heartbeats_agent_id_created_at', 'agent_id', 'created_at'),
        Index('idx_heartbeats_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    schedule: Mapped[str] = mapped_column(String(100))  # cron expression
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(20), default="enabled")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    last_run_at: Mapped[Optional[str]] = mapped_column(String)
    next_run_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent")
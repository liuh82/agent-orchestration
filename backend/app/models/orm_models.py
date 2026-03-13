from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, Index, func, desc
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from uuid import uuid4
from typing import List, Optional
from datetime import datetime

# tasks.db tables

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(50), default="claude-code")
    status: Mapped[str] = mapped_column(String(20), default="offline")
    model: Mapped[str] = mapped_column(String(100), default="claude-3-sonnet")
    timeout: Mapped[int] = mapped_column(Integer, default=300)
    skills: Mapped[Optional[str]] = mapped_column(Text)
    capabilities: Mapped[Optional[str]] = mapped_column(Text)
    config: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    last_seen: Mapped[Optional[str]] = mapped_column(String)

    # Statistics
    task_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    failed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    avg_response_time: Mapped[float] = mapped_column(Float, default=0.0)
    avg_task_duration: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    logs: Mapped[List["AgentLog"]] = relationship("AgentLog", back_populates="agent", cascade="all, delete-orphan")
    assignments: Mapped[List["TaskAssignment"]] = relationship("TaskAssignment", back_populates="agent")
    costs: Mapped[List["CostEntry"]] = relationship("CostEntry", back_populates="agent")

class AgentLog(Base):
    __tablename__ = "agent_logs"
    __table_args__ = (
        Index('idx_agent_logs_agent_id_created_at', 'agent_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    level: Mapped[str] = mapped_column(String(20), default="INFO")
    message: Mapped[str] = mapped_column(Text)
    metadata_: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="logs")

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index('idx_tasks_status_created_at', 'status', 'created_at'),
        Index('idx_tasks_agent_id_created_at', 'agent_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    assignee_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("agents.id"))
    agent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("agents.id"))
    action_params: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    result: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    assignee: Mapped[Optional["Agent"]] = relationship("Agent", foreign_keys=[assignee_id])
    agent: Mapped[Optional["Agent"]] = relationship("Agent", foreign_keys=[agent_id])
    assignments: Mapped[List["TaskAssignment"]] = relationship("TaskAssignment", back_populates="task")
    costs: Mapped[List["CostEntry"]] = relationship("CostEntry", back_populates="task")

class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    __table_args__ = (
        Index('idx_task_assignments_task_id_agent_id', 'task_id', 'agent_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    assigned_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    status: Mapped[str] = mapped_column(String(50), default="pending")

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="assignments")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="assignments")

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        Index('idx_budgets_agent_id_created_at', 'agent_id', 'created_at'),
        Index('idx_budgets_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    agent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("agents.id"))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    period: Mapped[str] = mapped_column(String(20), default="monthly")
    current_cost: Mapped[float] = mapped_column(Float, default=0.0)
    is_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    threshold_percentage: Mapped[int] = mapped_column(Integer, default=80)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent")
    alerts: Mapped[List["CostAlert"]] = relationship("CostAlert", back_populates="budget")
    daily_costs: Mapped[List["DailyCost"]] = relationship("DailyCost", back_populates="budget")

class CostAlert(Base):
    __tablename__ = "cost_alerts"
    __table_args__ = (
        Index('idx_cost_alerts_budget_id_created_at', 'budget_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    budget_id: Mapped[str] = mapped_column(String, ForeignKey("budgets.id"))
    current_cost: Mapped[float] = mapped_column(Float)
    threshold_percentage: Mapped[int] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(String)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    resolved_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    budget: Mapped["Budget"] = relationship("Budget", back_populates="alerts")

class DailyCost(Base):
    __tablename__ = "daily_costs"
    __table_args__ = (
        Index('idx_daily_costs_agent_id_date', 'agent_id', 'date'),
        Index('idx_daily_costs_budget_id_date', 'budget_id', 'date'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    budget_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("budgets.id"))
    date: Mapped[str] = mapped_column(String)  # YYYY-MM-DD format
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent")
    budget: Mapped["Budget"] = relationship("Budget", back_populates="daily_costs")

class OrgChartNode(Base):
    __tablename__ = "org_chart_nodes"
    __table_args__ = (
        Index('idx_org_chart_nodes_parent_id', 'parent_id'),
        Index('idx_org_chart_nodes_created_at', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255))
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("org_chart_nodes.id"))
    department_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("departments.id"))
    department: Mapped[Optional[str]] = mapped_column(String(50))  # Department name
    position: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=0)
    children_ids: Mapped[Optional[str]] = mapped_column(Text)  # CSV
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    avatar: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    parent: Mapped["OrgChartNode"] = relationship("OrgChartNode", remote_side=[id])
    children: Mapped[List["OrgChartNode"]] = relationship("OrgChartNode", foreign_keys=[parent_id], overlaps="parent")

class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        Index('idx_departments_name', 'name'),
        Index('idx_departments_parent_id', 'parent_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[Optional[str]] = mapped_column(String(50))
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("departments.id"))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    parent: Mapped["Department"] = relationship("Department", remote_side=[id])
    children: Mapped[List["Department"]] = relationship("Department", foreign_keys=[parent_id])

class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        Index('idx_roles_code', 'code'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    permissions: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    members: Mapped[List["Member"]] = relationship("Member", back_populates="role")

class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        Index('idx_members_email', 'email'),
        Index('idx_members_department_id', 'department_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[str] = mapped_column(String, ForeignKey("roles.id"))
    department_id: Mapped[str] = mapped_column(String, ForeignKey("departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="members")
    department: Mapped["Department"] = relationship("Department")
    goals: Mapped[List["Goal"]] = relationship("Goal", back_populates="owner")

class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        Index('idx_goals_owner_id_created_at', 'owner_id', 'created_at'),
        Index('idx_goals_department_id_created_at', 'department_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(50), default="objective")
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    department_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("departments.id"))
    status: Mapped[str] = mapped_column(String(50), default="active")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    target_date: Mapped[Optional[str]] = mapped_column(String)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[Optional[str]] = mapped_column(Text)  # CSV
    metrics: Mapped[Optional[str]] = mapped_column(Text)  # CSV
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    owner: Mapped["Member"] = relationship("Member", back_populates="goals")
    alignments: Mapped[List["GoalAlignment"]] = relationship("GoalAlignment", foreign_keys="GoalAlignment.parent_id", viewonly=True)

class GoalAlignment(Base):
    __tablename__ = "goal_alignments"
    __table_args__ = (
        Index('idx_goal_alignments_parent_id', 'parent_id'),
        Index('idx_goal_alignments_child_id', 'child_id'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("goals.id"))
    child_id: Mapped[str] = mapped_column(String, ForeignKey("goals.id"))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    alignment_type: Mapped[str] = mapped_column(String(50), default="supports")
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    # parent and child relationships removed - not needed for Goal model

class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (
        Index('idx_approvals_requester_id_created_at', 'requester_id', 'created_at'),
        Index('idx_approvals_status_created_at', 'status', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    requester_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    approver_ids: Mapped[Optional[str]] = mapped_column(Text)  # CSV
    status: Mapped[str] = mapped_column(String(20), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    due_date: Mapped[Optional[str]] = mapped_column(String)
    metadata_: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    requester: Mapped["Member"] = relationship("Member", foreign_keys=[requester_id])
    history: Mapped[List["ApprovalHistory"]] = relationship("ApprovalHistory", back_populates="approval")

class ApprovalHistory(Base):
    __tablename__ = "approval_history"
    __table_args__ = (
        Index('idx_approval_history_approval_id_created_at', 'approval_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    approval_id: Mapped[str] = mapped_column(String, ForeignKey("approvals.id"))
    action: Mapped[str] = mapped_column(String(50))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    actor_id: Mapped[str] = mapped_column(String, ForeignKey("members.id"))
    actor_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    approval: Mapped["Approval"] = relationship("Approval", back_populates="history")
    actor: Mapped["Member"] = relationship("Member")

class AuditLog(Base):
    __table_args__ = (
        Index('idx_audit_logs_member_id_created_at', 'member_id', 'created_at'),
        Index('idx_audit_logs_resource_type_created_at', 'resource_type', 'created_at'),
        Index('idx_audit_logs_resource', 'resource_type', 'resource_id'),
    )
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    member_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id"))
    action: Mapped[str] = mapped_column(String(50))
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[str] = mapped_column(String)
    details: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    member: Mapped[Optional["Member"]] = relationship("Member")


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

    # For the HeartbeatService (task scheduler heartbeat)
    description: Mapped[Optional[str]] = mapped_column(Text)
    action_type: Mapped[Optional[str]] = mapped_column(String(50))
    action_params: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    interval_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent")
    logs: Mapped[List["HeartbeatLog"]] = relationship("HeartbeatLog", back_populates="heartbeat")

class HeartbeatLog(Base):
    __tablename__ = "heartbeat_logs"
    __table_args__ = (
        Index('idx_heartbeat_logs_heartbeat_id_started_at', 'heartbeat_id', 'started_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    heartbeat_id: Mapped[str] = mapped_column(String, ForeignKey("heartbeats.id"))
    status: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    result: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    heartbeat: Mapped["Heartbeat"] = relationship("Heartbeat", back_populates="logs")

# costs.db tables (migrated to tasks.db)

class CostEntry(Base):
    __tablename__ = "cost_entries"
    __table_args__ = (
        Index('idx_cost_entries_agent_id_timestamp', 'agent_id', 'timestamp'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    task_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tasks.id"))
    model: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    timestamp: Mapped[Optional[str]] = mapped_column(String)
    metadata_: Mapped[Optional[str]] = mapped_column(Text)  # JSON

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="costs")
    task: Mapped[Optional["Task"]] = relationship("Task")

# workflows.db tables (migrated to tasks.db)

class Workflow(Base):
    __tablename__ = "workflows"
    __table_args__ = (
        Index('idx_workflows_created_at', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    engine: Mapped[str] = mapped_column(String(50))
    definition: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id"))
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

    # Relationships
    creator: Mapped[Optional["Member"]] = relationship("Member")

class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    __table_args__ = (
        Index('idx_workflow_templates_category_created_at', 'category', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    engine: Mapped[str] = mapped_column(String(50))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    definition: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
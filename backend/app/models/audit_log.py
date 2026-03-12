from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AuditLogType(str):
    """审计日志类型"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    READ = "read"
    EXECUTE = "execute"
    APPROVE = "approve"
    REJECT = "reject"
    LOGIN = "login"
    LOGOUT = "logout"
    ASSIGN = "assign"


class AuditLogAction(str):
    """审计操作"""
    AGENT_CREATE = "agent_create"
    AGENT_UPDATE = "agent_update"
    AGENT_DELETE = "agent_delete"
    AGENT_START = "agent_start"
    AGENT_STOP = "agent_stop"
    TASK_CREATE = "task_create"
    TASK_UPDATE = "task_update"
    TASK_DELETE = "task_delete"
    TASK_EXECUTE = "task_execute"
    TASK_PAUSE = "task_pause"
    TASK_RESUME = "task_resume"
    WORKFLOW_CREATE = "workflow_create"
    WORKFLOW_UPDATE = "workflow_update"
    WORKFLOW_DELETE = "workflow_delete"
    WORKFLOW_EXECUTE = "workflow_execute"
    COST_CREATE = "cost_create"
    COST_UPDATE = "cost_update"
    ROLE_CREATE = "role_create"
    ROLE_UPDATE = "role_update"
    ROLE_DELETE = "role_delete"
    MEMBER_CREATE = "member_create"
    MEMBER_UPDATE = "member_update"
    MEMBER_DELETE = "member_delete"
    GOAL_CREATE = "goal_create"
    GOAL_UPDATE = "goal_update"
    GOAL_DELETE = "goal_delete"
    GOAL_ALIGN = "goal_align"
    APPROVAL_CREATE = "approval_create"
    APPROVAL_APPROVE = "approval_approve"
    APPROVAL_REJECT = "approval_reject"


class AuditLogBase(BaseModel):
    """审计日志基础信息"""
    type: AuditLogType
    action: AuditLogAction
    resource_type: str  # agents, tasks, workflows, costs, roles, members, goals, approvals
    resource_id: str
    user_id: str
    user_name: str
    department_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_data: Optional[str] = None  # 请求数据，JSON字符串
    response_data: Optional[str] = None  # 响应数据，JSON字符串
    status_code: int
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None  # 执行耗时（毫秒）
    metadata: Optional[str] = None  # 额外信息，JSON字符串

    class Config:
        arbitrary_types_allowed = True


class AuditLogCreate(AuditLogBase):
    """创建审计日志"""
    pass


class AuditLog(AuditLogBase):
    """审计日志完整信息"""
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    """审计日志响应"""
    success: bool
    data: Optional[AuditLog] = None
    message: str = ""


class AuditLogListResponse(BaseModel):
    """审计日志列表响应"""
    success: bool
    data: List[AuditLog]
    pagination: Optional[dict] = None
    message: str = ""
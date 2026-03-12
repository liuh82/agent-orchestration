from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ApprovalStatus(str, Enum):
    """审批状态"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalType(str, Enum):
    """审批类型"""
    AGENT_CREATE = "agent_create"
    AGENT_UPDATE = "agent_update"
    TASK_CREATE = "task_create"
    WORKFLOW_CREATE = "workflow_create"
    BUDGET_CHANGE = "budget_change"
    ROLE_CREATE = "role_create"
    ROLE_UPDATE = "role_update"
    MEMBER_CREATE = "member_create"
    MEMBER_UPDATE = "member_update"
    GOAL_CREATE = "goal_create"
    GOAL_UPDATE = "goal_update"


class ApprovalBase(BaseModel):
    """审批基础信息"""
    title: str = Field(..., min_length=1, max_length=200)
    type: ApprovalType
    content: str  # 审批内容，JSON字符串
    requester_id: str
    approver_ids: List[str]
    status: ApprovalStatus = ApprovalStatus.PENDING
    priority: str = Field(default="medium")  # low, medium, high, urgent
    due_date: Optional[datetime] = None
    metadata: Optional[str] = None  # 额外信息，JSON字符串

    model_config = {"arbitrary_types_allowed": True}


class ApprovalCreate(ApprovalBase):
    """创建审批"""
    pass


class ApprovalUpdate(ApprovalBase):
    """更新审批"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    requester_id: Optional[str] = None
    approver_ids: Optional[List[str]] = None
    status: Optional[ApprovalStatus] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    metadata: Optional[str] = None


class Approval(ApprovalBase):
    """审批完整信息"""
    id: str
    created_at: datetime
    updated_at: datetime
    approval_history: List['ApprovalHistory'] = []

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}


class ApprovalResponse(BaseModel):
    """审批响应"""
    success: bool
    data: Optional[Approval] = None
    message: str = ""


class ApprovalListResponse(BaseModel):
    """审批列表响应"""
    success: bool
    data: List[Approval]
    message: str = ""


class ApprovalHistory(BaseModel):
    """审批历史"""
    id: str
    approval_id: str
    action: str  # create, update, approve, reject, cancel
    actor_id: str
    actor_name: str
    comment: Optional[str] = None
    status: ApprovalStatus
    created_at: datetime

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}


class ApprovalHistoryResponse(BaseModel):
    """审批历史响应"""
    success: bool
    data: List[ApprovalHistory]
    message: str = ""

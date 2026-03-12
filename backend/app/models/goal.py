from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class GoalStatus(str):
    """目标状态"""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class GoalPriority(str):
    """目标优先级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class GoalBase(BaseModel):
    """目标基础信息"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    type: str = Field(default="objective")  # objective, key_result, milestone
    priority: GoalPriority = Field(default=GoalPriority.MEDIUM)
    status: GoalStatus = Field(default=GoalStatus.DRAFT)
    owner_id: str
    department_id: Optional[str] = None
    due_date: Optional[datetime] = None
    progress: float = Field(default=0.0, ge=0, le=100)
    tags: List[str] = Field(default_factory=list)
    metrics: List[str] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True


class GoalCreate(GoalBase):
    """创建目标"""
    pass


class GoalUpdate(GoalBase):
    """更新目标"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[GoalPriority] = None
    status: Optional[GoalStatus] = None
    owner_id: Optional[str] = None
    department_id: Optional[str] = None
    due_date: Optional[datetime] = None
    progress: Optional[float] = Field(None, ge=0, le=100)
    tags: Optional[List[str]] = None
    metrics: Optional[List[str]] = None


class Goal(GoalBase):
    """目标完整信息"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class GoalResponse(BaseModel):
    """目标响应"""
    success: bool
    data: Optional[Goal] = None
    message: str = ""


class GoalListResponse(BaseModel):
    """目标列表响应"""
    success: bool
    data: List[Goal]
    message: str = ""


class GoalAlignment(BaseModel):
    """目标对齐关系"""
    parent_id: str
    child_id: str
    weight: float = Field(default=1.0, ge=0, le=1)  # 权重
    description: Optional[str] = None


class GoalAlignmentCreate(BaseModel):
    """创建目标对齐"""
    parent_id: str
    child_id: str
    weight: float = Field(default=1.0, ge=0, le=1)
    description: Optional[str] = None


class GoalAlignmentResponse(BaseModel):
    """目标对齐响应"""
    success: bool
    data: Optional[GoalAlignment] = None
    message: str = ""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    priority: str = Field(default='medium')
    workflow_id: Optional[str] = None
    input: Any = Field(default_factory=dict)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    output: Optional[Any] = None


class Task(TaskBase):
    id: str
    status: str = Field(default='pending')
    assigned_to: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    output: Optional[Any] = None
    logs: List[dict] = Field(default_factory=list)

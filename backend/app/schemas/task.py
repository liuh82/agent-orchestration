"""Task-related Pydantic schemas."""
from typing import Optional

from pydantic import BaseModel


class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    spec: Optional[str] = None
    priority: str = "medium"
    depends_on: Optional[list[str]] = None
    assigned_agent: Optional[str] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    spec: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    depends_on: Optional[list[str]] = None
    assigned_agent: Optional[str] = None


class TaskOut(BaseModel):
    id: str
    project_id: str
    user_id: str
    parent_task_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    spec: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"
    depends_on: Optional[list] = None
    assigned_agent: Optional[str] = None
    total_jobs: int = 0
    completed_jobs: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    model_config = {"from_attributes": True}

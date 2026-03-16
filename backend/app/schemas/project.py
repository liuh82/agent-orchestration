"""Project-related Pydantic schemas."""
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    spec: Optional[str] = None
    workflow_id: Optional[str] = None
    config_overrides: Optional[dict] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    spec: Optional[str] = None
    status: Optional[str] = None
    config_overrides: Optional[dict] = None


class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    spec: Optional[str] = None
    workflow_id: Optional[str] = None
    config_overrides: Optional[dict] = None
    status: str = "active"
    total_tasks: int = 0
    completed_tasks: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    created_at: str = ""
    updated_at: str = ""

    model_config = {"from_attributes": True}

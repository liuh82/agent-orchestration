"""Task-related Pydantic schemas."""
from typing import Optional, List

from pydantic import BaseModel, Field


class TaskScheduleConfig(BaseModel):
    type: str = Field(default="immediate", pattern="^(immediate|cron|interval)$")
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = Field(default=None, gt=0)


class ConfigOverrideItem(BaseModel):
    workflow_node_id: str
    agent_type_id: Optional[str] = None
    config_override: dict


class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    spec: Optional[str] = None
    priority: str = "medium"
    depends_on: Optional[list] = None
    assigned_agent: Optional[str] = None
    workflow_id: Optional[str] = None
    project_id: Optional[str] = None  # for standalone tasks via POST /api/v1/tasks
    config_overrides: Optional[List[ConfigOverrideItem]] = None
    schedule: Optional[TaskScheduleConfig] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    spec: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    depends_on: Optional[list] = None
    assigned_agent: Optional[str] = None
    workflow_id: Optional[str] = None


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
    workflow_id: Optional[str] = None
    workflow_snapshot: Optional[dict] = None
    schedule_type: Optional[str] = None
    schedule_config: Optional[dict] = None
    total_jobs: int = 0
    completed_jobs: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    # enriched fields (not ORM, populated by query)
    workflow_name: Optional[str] = None
    agent_name: Optional[str] = None

    model_config = {"from_attributes": True}


class TaskAgentConfigCreate(BaseModel):
    workflow_node_id: str
    agent_type_id: Optional[str] = None
    config_override: dict


class TaskAgentConfigOut(BaseModel):
    id: str
    task_id: str
    workflow_node_id: str
    agent_type_id: Optional[str] = None
    config_override: Optional[dict] = None
    created_at: str = ""
    updated_at: str = ""

    model_config = {"from_attributes": True}

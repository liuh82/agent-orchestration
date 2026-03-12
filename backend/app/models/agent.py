from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default='claude-code')
    model: str = Field(default='claude-3-opus')
    timeout: int = Field(default=300, gt=0)
    skills: List[str] = Field(default_factory=list)
    capabilities: List[str] = Field(default_factory=list)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(AgentBase):
    pass


class Agent(AgentBase):
    id: str
    status: str = Field(default='offline')
    created_at: datetime
    updated_at: datetime
    last_seen: Optional[datetime] = None
    task_count: int = Field(default=0)
    completed_tasks: int = Field(default=0)
    failed_tasks: int = Field(default=0)
    total_tokens_used: int = Field(default=0)
    total_cost: float = Field(default=0.0)
    avg_response_time: float = Field(0.0)
    avg_task_duration: float = Field(0.0)

    class Config:
        from_attributes = True


class AgentStats(BaseModel):
    id: str
    name: str
    status: str
    current_tasks: int = 0
    task_count: int
    completed_tasks: int
    failed_tasks: int
    success_rate: float = 0.0
    total_tokens_used: int
    total_cost: float
    avg_response_time: float
    avg_task_duration: float
    uptime_percentage: float = 0.0


class AgentLogsRequest(BaseModel):
    page: int = Field(default=1, gt=0)
    page_size: int = Field(default=50, gt=0, le=100)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    level: Optional[str] = None  # debug, info, warning, error
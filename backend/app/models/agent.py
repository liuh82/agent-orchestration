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

    class Config:
        from_attributes = True
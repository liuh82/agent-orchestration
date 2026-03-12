from datetime import datetime
from typing import List, Any, Optional
from pydantic import BaseModel, Field


class WorkflowConfig(BaseModel):
    timeout: int = Field(default=3600, gt=0)
    retry_policy: dict = Field(default_factory=dict)
    approval_gates: List[dict] = Field(default_factory=list)


class WorkflowDefinition(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    engine: str = Field(default='lobster')
    definition: Any
    config: WorkflowConfig = Field(default_factory=WorkflowConfig)
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowTemplate(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    engine: str = Field(..., min_length=1)
    category: str = Field(default='development')
    definition: Any
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
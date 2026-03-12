from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CostEntry(BaseModel):
    id: Optional[str] = None
    agent_id: str
    task_id: str
    model: str
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_cost: float = Field(default=0.0, ge=0)
    currency: str = Field(default="USD")
    timestamp: datetime
    metadata: Dict = Field(default_factory=dict)


class CostReport(BaseModel):
    id: Optional[str] = None
    period_start: datetime
    period_end: datetime
    total_cost: float = Field(default=0.0, ge=0)
    total_input_tokens: int = Field(default=0, ge=0)
    total_output_tokens: int = Field(default=0, ge=0)
    by_agent: Dict[str, float] = Field(default_factory=dict)
    by_model: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime


class BudgetConfig(BaseModel):
    id: Optional[str] = None
    name: str
    amount: float = Field(gt=0)
    currency: str = Field(default="USD")
    period: str = Field(regex='^(daily|weekly|monthly|yearly)$')
    alert_threshold: float = Field(ge=0, le=1)  # 0-1之间的比例
    notifications: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CostAlert(BaseModel):
    id: Optional[str] = None
    budget_id: str
    message: str
    current_cost: float
    threshold: float
    timestamp: datetime
    is_read: bool = Field(default=False)
    metadata: Dict = Field(default_factory=dict)
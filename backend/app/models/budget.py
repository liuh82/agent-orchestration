from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BudgetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    currency: str = Field(default='USD')
    period: str = Field(default='monthly')  # daily, weekly, monthly, yearly
    threshold_percentage: float = Field(default=80, ge=0, le=100)  # percentage of budget to trigger alert
    status: str = Field(default='active')  # active, disabled
    enabled: bool = Field(default=True)


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    period: Optional[str] = None
    threshold_percentage: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[str] = None
    enabled: Optional[bool] = None


class Budget(BudgetBase):
    id: str
    agent_id: Optional[str] = None
    current_cost: float = Field(default=0.0)
    is_triggered: bool = Field(default=False)
    created_at: datetime
    updated_at: datetime


class CostAlert(BaseModel):
    id: str
    budget_id: str
    amount: float
    percentage: float
    message: str
    triggered_at: datetime
    acknowledged: bool = Field(default=False)
    acknowledged_at: Optional[datetime] = None


class AgentCostSummary(BaseModel):
    agent_id: str
    agent_name: str
    total_tokens: int = 0
    total_cost: float = 0.0
    task_count: int = 0
    avg_task_cost: float = 0.0
    date: Optional[datetime] = None
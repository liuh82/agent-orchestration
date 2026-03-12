from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BudgetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    period: str = Field(default='monthly')  # daily, weekly, monthly, yearly
    alert_threshold: float = Field(default=0.8, ge=0, le=1)  # percentage of budget to trigger alert
    enabled: bool = Field(default=True)


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    period: Optional[str] = None
    alert_threshold: Optional[float] = Field(None, ge=0, le=1)
    enabled: Optional[bool] = None


class Budget(BudgetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    current_cost: float = Field(default=0.0)
    is_triggered: bool = Field(default=False)

    class Config:
        from_attributes = True


class CostAlert(BaseModel):
    id: str
    budget_id: str
    amount: float
    percentage: float
    message: str
    triggered_at: datetime
    acknowledged: bool = Field(default=False)
    acknowledged_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentCostSummary(BaseModel):
    agent_id: str
    agent_name: str
    total_tokens: int = 0
    total_cost: float = 0.0
    task_count: int = 0
    avg_task_cost: float = 0.0
    date: Optional[datetime] = None
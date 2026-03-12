from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LogBase(BaseModel):
    source: str  # 'agent' or 'task'
    level: str = Field(default='info')  # debug, info, warning, error
    message: str
    metadata: Optional[dict] = None


class LogCreate(LogBase):
    pass


class Log(LogBase):
    id: str
    source_id: str  # agent id or task id
    timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class TaskLogsRequest(BaseModel):
    page: int = Field(default=1, gt=0)
    page_size: int = Field(default=50, gt=0, le=100)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    level: Optional[str] = None
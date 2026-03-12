from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class HeartbeatLogStatus(str, Enum):
    """Heartbeat log status"""
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class HeartbeatLogBase(BaseModel):
    """Heartbeat log base information"""
    heartbeat_id: str
    status: HeartbeatLogStatus = HeartbeatLogStatus.RUNNING
    result: Optional[dict] = None
    error_message: Optional[str] = None

    model_config = {"arbitrary_types_allowed": True}


class HeartbeatLogCreate(HeartbeatLogBase):
    """Create heartbeat log"""
    pass


class HeartbeatLog(HeartbeatLogBase):
    """Heartbeat log complete information"""
    id: str
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}


class HeartbeatLogResponse(BaseModel):
    """Heartbeat log response"""
    success: bool
    data: Optional[HeartbeatLog] = None
    message: str = ""


class HeartbeatLogListResponse(BaseModel):
    """Heartbeat log list response"""
    success: bool
    data: list[HeartbeatLog]
    message: str = ""

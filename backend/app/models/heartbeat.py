from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class HeartbeatActionType(str):
    """Heartbeat action types"""
    CHECK_AGENT_STATUS = "check_agent_status"
    SEND_REMINDER = "send_reminder"
    CUSTOM = "custom"


class HeartbeatBase(BaseModel):
    """Heartbeat base information"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    action_type: str = Field(..., description="check_agent_status, send_reminder, custom")
    action_params: Optional[dict] = Field(default_factory=dict)
    interval_seconds: int = Field(..., ge=10, description="Minimum 10 seconds")
    is_active: bool = Field(default=True)

    model_config = {"arbitrary_types_allowed": True}


class HeartbeatCreate(HeartbeatBase):
    """Create heartbeat"""
    pass


class HeartbeatUpdate(BaseModel):
    """Update heartbeat"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    action_type: Optional[str] = None
    action_params: Optional[dict] = None
    interval_seconds: Optional[int] = Field(None, ge=10)
    is_active: Optional[bool] = None


class Heartbeat(HeartbeatBase):
    """Heartbeat complete information"""
    id: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}


class HeartbeatResponse(BaseModel):
    """Heartbeat response"""
    success: bool
    data: Optional[Heartbeat] = None
    message: str = ""


class HeartbeatListResponse(BaseModel):
    """Heartbeat list response"""
    success: bool
    data: list[Heartbeat]
    message: str = ""

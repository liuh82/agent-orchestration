"""Gateway Pydantic schemas for API validation and internal data transfer."""
from __future__ import annotations

from typing import Optional, List, Dict

from pydantic import BaseModel, Field
from enum import Enum


class AgentType(str, Enum):
    CLI = "cli"
    CODEX = "codex"
    PI = "pi"
    ACP = "acp"
    VSCODE = "vscode"
    CURSOR = "cursor"
    INTELLIJ = "intellij"


class TaskPriority(str, Enum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class BridgeStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdapterInfo(BaseModel):
    type: AgentType
    agent_name: str
    version: Optional[str] = None
    executable_path: Optional[str] = None


class BridgeInfo(BaseModel):
    """Bridge information DTO."""
    bridge_id: str
    platform: str
    hostname: str
    os_version: Optional[str] = None
    node_version: Optional[str] = None
    bridge_version: Optional[str] = None
    status: BridgeStatus
    last_seen: int
    available_adapters: List[AdapterInfo]
    active_tasks: int
    max_concurrent: int
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class BridgeFilter(BaseModel):
    """Bridge query filter."""
    status: Optional[BridgeStatus] = None
    platform: Optional[str] = None
    min_active_tasks: Optional[int] = None


class TaskRequest(BaseModel):
    """Task request for routing."""
    prompt: str
    project_path: str
    agent_type: AgentType = AgentType.CLI
    timeout: int = 300
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: Optional[str] = None
    callback_id: Optional[str] = None
    source: str  # 'http' | 'workflow' | 'openclaw'


class TaskInfo(BaseModel):
    """Task information DTO."""
    task_id: str
    bridge_id: Optional[str] = None
    prompt: str
    project_path: str
    agent_type: str
    timeout: int
    priority: str
    preferred_ide: Optional[str] = None
    source: str
    callback_id: Optional[str] = None
    status: str
    output: Optional[str] = None
    error: Optional[str] = None
    exit_code: Optional[int] = None
    changed_files: Optional[List[str]] = None
    duration: Optional[float] = None
    progress: int = 0
    submitted_at: int
    started_at: Optional[int] = None
    completed_at: Optional[int] = None


class TaskListResponse(BaseModel):
    success: bool
    data: List[TaskInfo]
    total: int
    limit: int
    offset: int


# HTTP API request/response models

class SubmitTaskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=10000)
    project_path: str = Field(..., min_length=1, max_length=1000)
    agent_type: AgentType = AgentType.CLI
    timeout: int = Field(default=300, ge=10, le=3600)
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: Optional[str] = None
    callback_id: Optional[str] = None


class SubmitTaskResponse(BaseModel):
    success: bool
    task_id: Optional[str] = None
    bridge_id: Optional[str] = None
    message: str


class TaskStatusResponse(BaseModel):
    success: bool
    data: Optional[TaskInfo] = None


class BridgeListResponse(BaseModel):
    success: bool
    data: List[BridgeInfo]


# Error models

class GatewayErrorCode(str, Enum):
    UNAUTHORIZED = "GATEWAY_001"
    INVALID_TOKEN = "GATEWAY_002"
    BRIDGE_NOT_FOUND = "GATEWAY_101"
    BRIDGE_OFFLINE = "GATEWAY_102"
    BRIDGE_CAPACITY_FULL = "GATEWAY_103"
    TASK_NOT_FOUND = "GATEWAY_201"
    NO_AVAILABLE_BRIDGE = "GATEWAY_202"
    TASK_SUBMIT_FAILED = "GATEWAY_203"
    TASK_TIMEOUT = "GATEWAY_204"


class GatewayError(BaseModel):
    code: str
    message: str
    details: Optional[Dict] = None


class GatewayErrorResponse(BaseModel):
    success: bool = False
    error: GatewayError

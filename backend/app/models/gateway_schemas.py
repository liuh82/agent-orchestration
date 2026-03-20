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
    BLOCKED = "blocked"  # 依赖未满足时阻塞


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
    skip_permissions: bool = False
    allowed_tools: Optional[list[str]] = None
    source: str  # 'http' | 'workflow' | 'openclaw'
    depends_on: Optional[List[str]] = None  # 依赖的 task_id 列表
    max_retries: int = 0  # 最大重试次数
    sandbox_mode: bool = False  # 沙盒模式


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
    skip_permissions: bool = Field(default=False, description="Skip Claude Code permission confirmations")
    allowed_tools: Optional[list[str]] = Field(default=None, description="Pre-approved tool list for Claude Code")
    status: str
    output: Optional[str] = None
    error: Optional[str] = None
    exit_code: Optional[int] = None
    changed_files: Optional[List[str]] = None
    duration: Optional[float] = None
    progress: int = 0
    result_data: Optional[str] = None  # 结构化结果 JSON
    depends_on: Optional[List[str]] = None  # 依赖的 task_id 列表
    parent_task_id: Optional[str] = None  # 断点续传的原始任务 ID
    partial_result: Optional[str] = None  # 超时时的部分输出
    max_retries: int = 0  # 最大重试次数
    retry_count: int = 0  # 当前已重试次数
    cost_usd: float = 0.0  # 费用（美元）
    sandbox_mode: bool = False  # 沙盒模式
    sandbox_patch: Optional[str] = None  # sandbox 模式生成的 diff patch
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
    skip_permissions: bool = Field(default=False, description="Skip Claude Code permission confirmations")
    allowed_tools: Optional[list[str]] = Field(default=None, description="Pre-approved tool list for Claude Code")
    depends_on: Optional[List[str]] = Field(default=None, description="依赖的 task_id 列表，全部完成后才执行")
    max_retries: int = Field(default=0, ge=0, le=5, description="失败时自动重试次数（指数退避，切换 bridge）")
    sandbox_mode: bool = Field(default=False, description="沙盒模式：隔离工作目录，执行后生成 diff patch")
    backend: Optional[str] = Field(default=None, description="指定后端（claude/codex/opencode），默认自动选择")


class ResumeTaskRequest(BaseModel):
    """断点续传请求 — 从原任务上下文恢复执行。"""
    prompt: Optional[str] = Field(default=None, min_length=1, max_length=10000, description="可选: 覆盖原始 prompt")
    timeout: Optional[int] = Field(default=None, ge=10, le=3600, description="可选: 覆盖超时时间")


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


class TaskLogEntry(BaseModel):
    """Single task event log entry."""
    type: str  # "event" | "done"
    event: Optional[dict] = None
    progress: int = 0
    ts: int


class TaskLogResponse(BaseModel):
    """Paginated task event log response."""
    success: bool
    data: List[TaskLogEntry]
    total: int
    page: int
    page_size: int


class PatchActionResponse(BaseModel):
    """Response for apply/discard patch actions."""
    success: bool
    message: str


class GatewayErrorResponse(BaseModel):
    success: bool = False
    error: GatewayError

"""Agent-related Pydantic schemas."""
from typing import Optional

from pydantic import BaseModel


# ── AgentType ──────────────────────────────────────────────


class AgentTypeOut(BaseModel):
    id: str
    name: str
    display_name: Optional[str] = None
    protocol: str
    config_schema: Optional[dict] = None
    capabilities: Optional[list] = None
    default_models: Optional[list] = None
    is_system: bool = True
    created_at: str = ""

    model_config = {"from_attributes": True}


# ── AgentInstance ──────────────────────────────────────────


class AgentCreate(BaseModel):
    type_id: str
    name: str
    model: Optional[str] = None
    config: Optional[dict] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    config: Optional[dict] = None


class AgentOut(BaseModel):
    id: str
    user_id: str
    type_id: str
    name: str
    status: str = "offline"
    model: Optional[str] = None
    config: Optional[dict] = None
    task_count: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    is_active: bool = True
    last_seen_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    # Nested type info (populated by router)
    type_info: Optional[AgentTypeOut] = None

    model_config = {"from_attributes": True}

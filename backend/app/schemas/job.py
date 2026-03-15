"""Job-related Pydantic schemas."""
from typing import Optional

from pydantic import BaseModel


class JobOut(BaseModel):
    id: str
    task_id: str
    project_id: str
    user_id: str
    agent_inst_id: Optional[str] = None
    name: Optional[str] = None
    status: str = "pending"
    priority: str = "medium"
    prompt: Optional[str] = None
    action_params: Optional[dict] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None
    input_files: Optional[list] = None
    output_files: Optional[list] = None
    messages: Optional[list] = None
    node_data: Optional[dict] = None
    spec: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 300
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    model_config = {"from_attributes": True}

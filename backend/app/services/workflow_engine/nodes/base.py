"""Base node executor classes for workflow engine."""
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, Optional

if TYPE_CHECKING:
    from ..variable_resolver import VariableResolver


class NodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    WAITING = "waiting"  # human review, timer, etc.


@dataclass
class NodeContext:
    """Execution context passed to each node."""
    node_id: str
    node_type: str
    node_config: Dict[str, Any]
    input_data: Dict[str, Any] = field(default_factory=dict)
    execution_id: str = ""
    workflow_id: str = ""
    upstream_outputs: Dict[str, Any] = field(default_factory=dict)
    db_session: Any = None
    resolver: Optional["VariableResolver"] = None


@dataclass
class NodeResult:
    """Result returned by node execution."""
    status: NodeStatus = NodeStatus.SUCCESS
    output_data: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    next_node_ids: Optional[list] = None  # explicit next nodes (overrides edges)
    duration_ms: Optional[int] = None


class BaseNodeExecutor(ABC):
    """Abstract base class for all workflow node executors.

    Subclasses must define CONFIG_SCHEMA (JSON Schema for frontend config panel)
    and implement the execute() method.
    """

    CONFIG_SCHEMA: dict = {}

    @abstractmethod
    async def execute(self, context: NodeContext) -> NodeResult:
        """Execute the node and return a result.

        Args:
            context: Contains input_data, config, execution_id, etc.

        Returns:
            NodeResult with status, output_data, and optional error_message.
        """

    async def validate_config(self, config: dict) -> tuple:
        """Validate node config. Returns (is_valid, error_message)."""
        # Default: accept any config
        return True, ""

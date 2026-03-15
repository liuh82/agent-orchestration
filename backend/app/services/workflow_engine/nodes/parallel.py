"""Parallel execution node — runs multiple branches concurrently."""
import asyncio
import logging
from typing import Any, Dict, List

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "parallel",
    label="Parallel",
    description="Execute multiple branches concurrently",
    category="flow",
    icon="git-merge",
)
class ParallelNodeExecutor(BaseNodeExecutor):
    """Fan-out node: all outgoing edges are executed in parallel.

    The engine handles the actual parallel scheduling. This node
    serves as a marker and collects results from all branches.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "mode": {
                "type": "string",
                "title": "Mode",
                "description": "Execution mode",
                "enum": ["all", "any", "race"],
                "default": "all",
            },
            "max_parallel": {
                "type": "integer",
                "title": "Max Parallel",
                "description": "Maximum concurrent branches",
                "default": 5,
            },
            "fail_fast": {
                "type": "boolean",
                "title": "Fail Fast",
                "description": "Stop all branches if any fails",
                "default": False,
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        # The engine handles parallel dispatch based on edges.
        # This node just marks completion and passes data through.
        mode = context.node_config.get("mode", "all")
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "mode": mode,
                "message": "Parallel branches dispatched",
                "branch_count": len(context.input_data.get("_branch_targets", [])),
            },
        )

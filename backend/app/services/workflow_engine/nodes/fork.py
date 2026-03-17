"""Fork node — distributes data to multiple parallel branches."""
import logging
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "fork",
    label="Fork",
    description="Distribute data to multiple parallel branches (broadcast or distribute)",
    category="flow",
    icon="git-fork",
)
class ForkNode(BaseNodeExecutor):
    """Fork node: fans out execution to multiple parallel branches.

    broadcast mode — all branches receive the same upstream_outputs.
    distribute mode — each branch receives an additional data payload
    from the branchData config, keyed by sourceHandle (branch_0, branch_1, ...).

    The engine handles actual parallel scheduling via sourceHandle routing.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "标签",
                "default": "Fork",
            },
            "mode": {
                "type": "string",
                "title": "Mode",
                "description": "broadcast: all branches receive same data; distribute: each branch gets unique data",
                "enum": ["broadcast", "distribute"],
                "default": "broadcast",
            },
            "branchCount": {
                "type": "integer",
                "title": "Branch Count",
                "description": "Number of parallel branches (2-10)",
                "minimum": 2,
                "maximum": 10,
                "default": 2,
            },
            "branchData": {
                "type": "array",
                "title": "Branch Data",
                "description": "Per-branch additional data (distribute mode only)",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "title": "Branch Label"},
                        "data": {"type": "string", "title": "Branch Data"},
                    },
                },
            },
        },
        "required": ["branchCount"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        mode = context.node_config.get("mode", "broadcast")
        branch_count = context.node_config.get("branchCount", 2)
        branch_data_list = context.node_config.get("branchData", [])

        # Build branch labels
        branch_labels: List[str] = []
        for i in range(branch_count):
            if i < len(branch_data_list) and isinstance(branch_data_list[i], dict):
                branch_labels.append(branch_data_list[i].get("label", f"branch_{i}"))
            else:
                branch_labels.append(f"branch_{i}")

        output: Dict[str, Any] = {
            "mode": mode,
            "branch_count": branch_count,
            "branch_labels": branch_labels,
        }

        # In distribute mode, include per-branch data keyed by branch index
        if mode == "distribute" and branch_data_list:
            for i, bd in enumerate(branch_data_list):
                if isinstance(bd, dict) and "data" in bd:
                    output[f"branch_{i}"] = bd["data"]

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data=output,
        )

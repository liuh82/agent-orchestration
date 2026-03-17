"""Join node — waits for all parallel branches and merges results."""
import copy
import logging
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "join",
    label="Join",
    description="Wait for all parallel branches to complete and merge results",
    category="flow",
    icon="git-merge",
)
class JoinNode(BaseNodeExecutor):
    """Join node: synchronization point for parallel branches.

    The engine handles the actual multi-input waiting logic.
    When all upstream branches have completed, the engine calls
    this node's execute() with upstream_outputs containing
    each branch's output keyed by branch index.

    merge strategies:
      - append: { branch_0: {...}, branch_1: {...}, merged: [...] }
      - merge:  deep merge all branch outputs into one dict
      - custom: extract only the fields listed in extractFields
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "标签",
                "default": "Join",
            },
            "mode": {
                "type": "string",
                "title": "Mode",
                "description": "all: wait for every branch; any: proceed on first completion; n_of_m: proceed when N branches complete",
                "enum": ["all", "any", "n_of_m"],
                "default": "all",
            },
            "requiredCount": {
                "type": "integer",
                "title": "Required Count",
                "description": "Required branch completions for n_of_m mode",
                "minimum": 1,
                "default": 2,
            },
            "mergeStrategy": {
                "type": "string",
                "title": "Merge Strategy",
                "description": "How to combine branch outputs",
                "enum": ["append", "merge", "custom"],
                "default": "append",
            },
            "extractFields": {
                "type": "array",
                "title": "Extract Fields",
                "description": "Fields to extract per branch (custom strategy)",
                "items": {"type": "string"},
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (seconds)",
                "description": "Max wait time for branches",
                "minimum": 10,
                "maximum": 86400,
                "default": 3600,
            },
            "onTimeout": {
                "type": "string",
                "title": "On Timeout",
                "description": "Action when timeout is reached",
                "enum": ["fail", "continue_with_ready", "skip"],
                "default": "continue_with_ready",
            },
        },
        "required": ["mode"],
    }

    @staticmethod
    def merge_outputs(
        branch_outputs: Dict[str, Any],
        merge_strategy: str,
        extract_fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Merge branch outputs according to the configured strategy.

        Args:
            branch_outputs: Dict of { branch_id: output_data, ... }
            merge_strategy: One of "append", "merge", "custom"
            extract_fields: For custom strategy, which fields to extract

        Returns:
            Merged output dict.
        """
        if merge_strategy == "merge":
            # Deep merge all branch outputs into a single dict
            merged: Dict[str, Any] = {}
            for branch_id in sorted(branch_outputs.keys()):
                branch_data = branch_outputs[branch_id]
                if isinstance(branch_data, dict):
                    JoinNode._deep_merge(merged, branch_data)
                else:
                    merged[branch_id] = branch_data
            return merged

        if merge_strategy == "custom" and extract_fields:
            # Extract specified fields from each branch
            result: Dict[str, Any] = {}
            for branch_id in sorted(branch_outputs.keys()):
                branch_data = branch_outputs[branch_id]
                if isinstance(branch_data, dict):
                    extracted = {
                        k: branch_data[k]
                        for k in extract_fields
                        if k in branch_data
                    }
                    result[branch_id] = extracted
                else:
                    result[branch_id] = branch_data
            return result

        # Default: append strategy
        sorted_branches = sorted(branch_outputs.keys())
        return {
            **{bid: branch_outputs[bid] for bid in sorted_branches},
            "merged": [branch_outputs[bid] for bid in sorted_branches],
        }

    @staticmethod
    def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> None:
        """Deep merge override into base dict (in-place)."""
        for key, value in override.items():
            if (
                key in base
                and isinstance(base[key], dict)
                and isinstance(value, dict)
            ):
                JoinNode._deep_merge(base[key], value)
            else:
                base[key] = copy.deepcopy(value) if isinstance(value, (dict, list)) else value

    async def execute(self, context: NodeContext) -> NodeResult:
        # The engine passes branch outputs in context.input_data["_branch_outputs"]
        # keyed by the source node IDs of each branch.
        branch_outputs = context.input_data.get("_branch_outputs", {})

        merge_strategy = context.node_config.get("mergeStrategy", "append")
        extract_fields = context.node_config.get("extractFields")

        merged = self.merge_outputs(branch_outputs, merge_strategy, extract_fields)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data=merged,
        )

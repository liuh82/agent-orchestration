"""Loop node — supports count-based and list-iteration loops within workflows."""
import logging
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from ..variable_resolver import resolve_variable
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

_DEFAULT_MAX_ITERATIONS = 100


@NodeRegistry.register(
    "loop",
    label="Loop",
    description="Execute a branch repeatedly (count or list iteration)",
    category="flow",
    icon="redo",
)
class LoopNode(BaseNodeExecutor):
    """Loop execution node.

    Two modes:
      - count: execute body N times, injecting loop.current_index each iteration
      - iterate: iterate over a list, injecting loop.current_item + loop.current_index

    The engine is responsible for:
      1. Running the body edge's downstream nodes
      2. Coming back to evaluate the next iteration
      3. Checking breakCondition and maxIterations
      4. Routing to "done" edge when finished

    This node returns the loop configuration and current iteration info.
    The engine reads the output to decide whether to continue or finish.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Loop"},
            "loopType": {
                "type": "string",
                "title": "Loop Type",
                "enum": ["count", "iterate"],
                "default": "count",
            },
            "count": {
                "type": "integer",
                "title": "Count",
                "description": "Number of iterations (loopType=count)",
                "default": 10,
                "minimum": 1,
            },
            "listPath": {
                "type": "string",
                "title": "List Path",
                "description": "Variable path to the list (loopType=iterate)",
            },
            "breakCondition": {
                "type": "string",
                "title": "Break Condition",
                "description": "Expression to stop the loop early",
            },
            "maxIterations": {
                "type": "integer",
                "title": "Max Iterations",
                "description": "Safety limit to prevent infinite loops",
                "default": 100,
                "minimum": 1,
                "maximum": 10000,
            },
        },
        "required": ["loopType"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        loop_type = context.node_config.get("loopType", "count")
        max_iterations = context.node_config.get("maxIterations", _DEFAULT_MAX_ITERATIONS)

        # Build resolver context
        node_outputs = context.upstream_outputs
        workflow_vars = context.input_data.get("_workflow_variables", {})
        loop_ctx = context.input_data.get("_loop_context")
        exec_ctx = context.input_data.get("_execution_context", {})

        # Determine current iteration from loop context (if resuming)
        current_index = 0
        if loop_ctx and "current_index" in loop_ctx:
            current_index = loop_ctx["current_index"]

        # Build iteration info
        iteration_info: Dict[str, Any] = {
            "loop_type": loop_type,
            "current_index": current_index,
            "max_iterations": max_iterations,
            "break_condition": context.node_config.get("breakCondition"),
        }

        if loop_type == "count":
            count = context.node_config.get("count", 10)
            iteration_info["total"] = count

            # Check if loop should continue
            if current_index >= min(count, max_iterations):
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={**iteration_info, "done": True},
                )

            # Build loop context for next body execution
            iteration_info["done"] = False
            iteration_info["current_item"] = current_index
            iteration_info["total_items"] = count

        elif loop_type == "iterate":
            list_path = context.node_config.get("listPath", "")
            if not list_path:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message="listPath is required for iterate mode",
                )

            # Strip {{ }} wrapper
            list_path = list_path.strip()
            if list_path.startswith("{{") and list_path.endswith("}}"):
                list_path = list_path[2:-2].strip()

            # Resolve the list
            items = resolve_variable(
                list_path, node_outputs,
                workflow_variables=workflow_vars,
                loop_context=loop_ctx,
                execution_context=exec_ctx,
            )

            if not isinstance(items, (list, tuple)):
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"loop listPath resolved to non-list: {type(items).__name__}",
                )

            iteration_info["total"] = len(items)

            # Check bounds
            if current_index >= min(len(items), max_iterations):
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={**iteration_info, "done": True},
                )

            # Build loop context
            iteration_info["done"] = False
            iteration_info["current_item"] = items[current_index]
            iteration_info["total_items"] = len(items)
        else:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Unknown loopType: {loop_type}",
            )

        # Check break condition
        break_cond = context.node_config.get("breakCondition")
        if break_cond:
            # Evaluate break condition against current state
            break_resolved = resolve_variable(
                break_cond.strip(), node_outputs,
                workflow_variables=workflow_vars,
                loop_context=loop_ctx,
                execution_context=exec_ctx,
            )
            if break_resolved is not None and break_resolved:
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={**iteration_info, "done": True, "break": True},
                )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data=iteration_info,
        )

    @staticmethod
    def build_loop_context(node_output: Dict[str, Any]) -> Dict[str, Any]:
        """Build loop context dict from loop node output for the next iteration.

        Called by the engine to prepare context for body nodes.
        """
        return {
            "current_index": node_output.get("current_index", 0),
            "current_item": node_output.get("current_item"),
        }

    @staticmethod
    def build_next_iteration_context(node_output: Dict[str, Any]) -> Dict[str, Any]:
        """Build the loop context for the NEXT iteration (index + 1).

        Called by the engine after body completes, before re-entering the loop.
        """
        current_index = node_output.get("current_index", 0)
        return {
            "current_index": current_index + 1,
            "current_item": None,  # Will be resolved by loop node on next execute
        }

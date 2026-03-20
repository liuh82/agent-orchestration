"""Switch multi-branch node — routes to one of many branches based on value matching."""
import logging
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus
from .if_node import _evaluate_operator, _coerce_expected

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "switch",
    label="Switch",
    description="Multi-branch routing based on value matching",
    category="flow",
    icon="apartment",
)
class SwitchNode(BaseNodeExecutor):
    """Evaluates a field value against sequential cases.

    Output:
        { matched_case: number | "default", value: any }
    Engine routes to sourceHandle "case_N" or "default" edge.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Switch"},
            "field": {
                "type": "string",
                "title": "Field",
                "description": "Variable path to evaluate, e.g. {{ node_1.output.type }}",
            },
            "cases": {
                "type": "array",
                "title": "Cases",
                "items": {
                    "type": "object",
                    "required": ["operator", "value"],
                    "properties": {
                        "label": {"type": "string", "title": "Label"},
                        "operator": {
                            "type": "string",
                            "title": "Operator",
                            "description": "Same operators as IF node",
                        },
                        "value": {"type": "string", "title": "Match Value"},
                    },
                },
            },
        },
        "required": ["field", "cases"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        field_expr = context.node_config.get("field", "").strip()
        cases = context.node_config.get("cases", [])

        if not field_expr:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="field is required",
            )

        if not cases:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="at least one case is required",
            )

        # Build resolver context
        node_outputs = context.upstream_outputs
        workflow_vars = context.input_data.get("_workflow_variables", {})
        loop_ctx = context.input_data.get("_loop_context")
        exec_ctx = context.input_data.get("_execution_context", {})

        # Strip {{ }} wrapper if present
        if field_expr.startswith("{{") and field_expr.endswith("}}"):
            field_expr = field_expr[2:-2].strip()

        # Resolve field value
        if context.resolver:
            actual_value = context.resolver.resolve(field_expr)
        else:
            from ..variable_resolver import resolve_variable
            actual_value = resolve_variable(
                field_expr, node_outputs,
                workflow_variables=workflow_vars,
                loop_context=loop_ctx,
                execution_context=exec_ctx,
            )

        # Try matching cases in order
        for idx, case in enumerate(cases):
            operator = case.get("operator", "eq")
            expected_str = case.get("value", "")
            expected_value = _coerce_expected(expected_str) if expected_str else ""

            passed = _evaluate_operator(operator, actual_value, expected_value)
            if passed:
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={
                        "matched_case": idx,
                        "matched_label": case.get("label", f"case_{idx}"),
                        "value": actual_value,
                    },
                    next_node_ids=None,  # engine uses sourceHandle routing
                )

        # No case matched — route to default
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "matched_case": "default",
                "matched_label": "default",
                "value": actual_value,
            },
            next_node_ids=None,
        )

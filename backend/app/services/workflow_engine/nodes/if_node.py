"""IF condition node — evaluates conditions and routes to true/false branches."""
import logging
import re
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from ..variable_resolver import VariableResolver, resolve_variable
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

_SUPPORTED_OPERATORS = {
    "eq", "neq", "gt", "lt", "gte", "lte",
    "contains", "regex", "empty", "not_empty",
}


def _evaluate_operator(
    operator: str,
    actual_value: Any,
    expected_value: Any,
) -> bool:
    """Evaluate a single condition operator."""
    if operator == "eq":
        return actual_value == expected_value
    if operator == "neq":
        return actual_value != expected_value
    if operator in ("gt", "lt", "gte", "lte"):
        try:
            a = float(actual_value) if actual_value is not None else float("nan")
            b = float(expected_value) if expected_value is not None else float("nan")
        except (TypeError, ValueError):
            return False
        if operator == "gt":
            return a > b
        if operator == "lt":
            return a < b
        if operator == "gte":
            return a >= b
        return a <= b
    if operator == "contains":
        return str(expected_value) in str(actual_value or "")
    if operator == "regex":
        try:
            return bool(re.search(str(expected_value), str(actual_value or "")))
        except re.error:
            return False
    if operator == "empty":
        return actual_value is None or actual_value == "" or actual_value == []
    if operator == "not_empty":
        return actual_value is not None and actual_value != "" and actual_value != []
    return False


def _coerce_expected(value: str) -> Any:
    """Try to coerce a string expected value to its natural type."""
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if value.lower() in ("null", "none"):
        return None
    try:
        if "." in value:
            return float(value)
        return int(value)
    except (ValueError, TypeError):
        return value


@NodeRegistry.register(
    "if",
    label="IF Condition",
    description="Branch execution based on condition evaluation",
    category="flow",
    icon="git-branch",
)
class IfNode(BaseNodeExecutor):
    """Evaluates conditions (field/operator/value) with AND/OR logic.

    Output:
        { result: true/false, matched_conditions: [...] }
    Engine routes to sourceHandle "true" or "false" edge.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "IF Condition"},
            "conditions": {
                "type": "array",
                "title": "Conditions",
                "items": {
                    "type": "object",
                    "required": ["field", "operator"],
                    "properties": {
                        "field": {
                            "type": "string",
                            "title": "Field",
                            "description": "Variable path, e.g. {{ node_1.output.score }}",
                        },
                        "operator": {
                            "type": "string",
                            "title": "Operator",
                            "enum": list(_SUPPORTED_OPERATORS),
                        },
                        "value": {
                            "type": "string",
                            "title": "Value",
                            "description": "Comparison value (ignored for empty/not_empty)",
                        },
                    },
                },
            },
            "logic": {
                "type": "string",
                "title": "Logic",
                "enum": ["and", "or"],
                "default": "and",
            },
        },
        "required": ["conditions"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        conditions = context.node_config.get("conditions", [])
        logic = context.node_config.get("logic", "and")

        if not conditions:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="conditions is required",
            )

        # Build resolver context from upstream outputs
        node_outputs = context.upstream_outputs
        workflow_vars = context.input_data.get("_workflow_variables", {})
        loop_ctx = context.input_data.get("_loop_context")
        exec_ctx = context.input_data.get("_execution_context", {})

        matched = []
        results = []

        for cond in conditions:
            field_expr = cond.get("field", "")
            operator = cond.get("operator", "eq")
            expected_str = cond.get("value", "")

            if operator not in _SUPPORTED_OPERATORS:
                matched.append(False)
                results.append(False)
                continue

            # Strip {{ }} wrapper if present
            field_expr = field_expr.strip()
            if field_expr.startswith("{{") and field_expr.endswith("}}"):
                field_expr = field_expr[2:-2].strip()

            # Resolve the field value
            actual_value = resolve_variable(
                field_expr, node_outputs,
                workflow_variables=workflow_vars,
                loop_context=loop_ctx,
                execution_context=exec_ctx,
            )

            # Coerce expected value
            expected_value = _coerce_expected(expected_str) if expected_str else ""

            passed = _evaluate_operator(operator, actual_value, expected_value)
            matched.append({
                "field": field_expr,
                "operator": operator,
                "value": actual_value,
                "expected": expected_value,
                "passed": passed,
            })
            results.append(passed)

        # Combine results
        if logic == "or":
            final_result = any(results)
        else:
            final_result = all(results)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "result": final_result,
                "matched_conditions": matched,
                "logic": logic,
            },
        )

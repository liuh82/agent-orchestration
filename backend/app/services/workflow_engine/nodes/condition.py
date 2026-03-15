"""Condition branch node — evaluates expressions to choose execution path."""
import logging
import re
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "condition",
    label="Condition",
    description="Branch execution based on expression evaluation",
    category="flow",
    icon="git-branch",
)
class ConditionNodeExecutor(BaseNodeExecutor):
    """Evaluates a simple expression against upstream outputs.

    Expression format:
      - {{node_id.output.field}} == value
      - {{node_id.output.field}} != value
      - {{node_id.output.field}} contains "text"
      - {{node_id.output.field}} > 0
    Returns True/False; engine uses edge.condition ("true"/"false") to route.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "required": ["expression"],
        "properties": {
            "expression": {
                "type": "string",
                "title": "Expression",
                "description": (
                    "Condition expression, e.g. {{agent1.output.exit_code}} == 0"
                ),
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        expression = context.node_config.get("expression", "")
        if not expression:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="expression is required",
            )

        try:
            # Render template variables in expression
            rendered = self._render_expression(expression, context)
            result = self._evaluate(rendered)
            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={"result": result, "expression": expression},
            )
        except Exception as e:
            logger.warning("Condition evaluation error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Expression evaluation failed: {e}",
            )

    def _render_expression(self, expr: str, context: NodeContext) -> str:
        """Replace {{node_id.output.field}} or {{node_id.field}} with actual values.

        upstream_outputs stores node_id -> output_data directly.
        The expression format {{node_id.output.field}} is the documented syntax;
        we resolve it by looking up node_id then navigating the field path.
        """
        # Match both {{node_id.output.field}} and {{node_id.field.subfield...}}
        pattern = r"\{\{(\w+)(?:\.output)?\.([\w.]+)\}\}"

        def replacer(match):
            node_id = match.group(1)
            field_path = match.group(2)
            output = context.upstream_outputs.get(node_id, {})
            # Navigate dot-separated field path
            if isinstance(output, dict):
                for part in field_path.split("."):
                    output = output.get(part, "") if isinstance(output, dict) else ""
                    if output == "" and part not in (output if isinstance(output, dict) else {}):
                        break
            value = output
            # Quote strings for comparison
            if isinstance(value, str):
                return f'"{value}"'
            return str(value)

        return re.sub(pattern, replacer, expr)

    def _evaluate(self, expr: str) -> bool:
        """Safely evaluate a simple comparison expression.

        Supported operators: ==, !=, >, <, >=, <=, contains
        Avoids eval() for security.
        """
        expr = expr.strip()

        # Try contains operator
        for op, check in [(" contains ", lambda a, b: b in str(a))]:
            if op in expr:
                parts = expr.split(op, 1)
                left = self._parse_value(parts[0].strip())
                right = self._parse_value(parts[1].strip())
                return check(left, right)

        # Try comparison operators (longest first to avoid > matching >=)
        for op in [">=", "<=", "!=", "==", ">", "<"]:
            # Find the operator not inside quotes
            idx = self._find_operator(expr, op)
            if idx >= 0:
                left_str = expr[:idx].strip()
                right_str = expr[idx + len(op):].strip()
                left = self._parse_value(left_str)
                right = self._parse_value(right_str)

                if op == "==":
                    return left == right
                elif op == "!=":
                    return left != right
                elif op == ">":
                    return self._safe_compare(left, right, lambda a, b: a > b)
                elif op == "<":
                    return self._safe_compare(left, right, lambda a, b: a < b)
                elif op == ">=":
                    return self._safe_compare(left, right, lambda a, b: a >= b)
                elif op == "<=":
                    return self._safe_compare(left, right, lambda a, b: a <= b)

        # Fallback: treat as truthy
        return bool(self._parse_value(expr))

    def _find_operator(self, expr: str, op: str) -> int:
        """Find operator position outside of quotes."""
        in_quote = False
        quote_char = None
        i = 0
        while i < len(expr) - len(op) + 1:
            c = expr[i]
            if in_quote:
                if c == quote_char:
                    in_quote = False
            else:
                if c in ('"', "'"):
                    in_quote = True
                    quote_char = c
                elif expr[i:i + len(op)] == op:
                    return i
            i += 1
        return -1

    def _parse_value(self, val: str):
        """Parse a string value into its Python type."""
        val = val.strip()
        # Remove quotes
        if (val.startswith('"') and val.endswith('"')) or \
           (val.startswith("'") and val.endswith("'")):
            return val[1:-1]
        # Boolean
        if val.lower() == "true":
            return True
        if val.lower() == "false":
            return False
        # None
        if val.lower() in ("null", "none"):
            return None
        # Numeric
        try:
            if "." in val:
                return float(val)
            return int(val)
        except (ValueError, TypeError):
            return val

    def _safe_compare(self, left, right, op):
        """Compare with type coercion for numeric values."""
        try:
            return op(float(left), float(right))
        except (TypeError, ValueError):
            return False

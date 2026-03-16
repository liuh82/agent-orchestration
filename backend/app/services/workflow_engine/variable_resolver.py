"""Variable resolver — resolves {{ }} template syntax for workflow nodes.

Priority order:
1. Loop variables (loop.current_index, loop.current_item)
2. Node outputs (node_id.output.field)
3. Workflow variables (workflow.variables.xxx)
4. Environment variables (env.xxx)
5. Context variables (context.user_id, context.task_id)
"""
import json
import logging
import os
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Pattern to match {{ variable.path }} syntax
_TEMPLATE_PATTERN = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


def resolve_variable(
    expression: str,
    node_outputs: Dict[str, Any],
    workflow_variables: Optional[Dict[str, Any]] = None,
    loop_context: Optional[Dict[str, Any]] = None,
    execution_context: Optional[Dict[str, Any]] = None,
    env_vars: Optional[Dict[str, str]] = None,
) -> Any:
    """Resolve a single variable expression (without {{ }}).

    Args:
        expression: Variable path like "node_1.output.result" or "loop.current_index"
        node_outputs: Dict mapping node_id -> output_data
        workflow_variables: Workflow-level variables
        loop_context: Current loop state {current_index, current_item}
        execution_context: Execution context {user_id, task_id, execution_id}
        env_vars: Environment variables (defaults to os.environ)

    Returns:
        Resolved value or None if not found
    """
    expression = expression.strip()
    parts = expression.split(".")
    if not parts:
        return None

    root = parts[0]
    path = parts[1:] if len(parts) > 1 else []

    # Priority 1: Loop variables
    if root == "loop":
        if loop_context is None:
            return None
        return _navigate_path(loop_context, path)

    # Priority 2: Node outputs — two supported syntaxes:
    #   {{ node_id.output.field }}  (with explicit .output)
    #   {{ node_id.field }}          (without .output, treated as shorthand)
    if root not in ("workflow", "env", "context"):
        node_id = root
        rest = path
        # If the second part is literally "output", skip it
        if rest and rest[0] == "output":
            rest = rest[1:]
        if node_id in node_outputs:
            return _navigate_path(node_outputs[node_id], rest)
        return None

    # Priority 3: Workflow variables
    if root == "workflow":
        if workflow_variables is None:
            return None
        if path and path[0] == "variables":
            path = path[1:]
        return _navigate_path(workflow_variables, path)

    # Priority 4: Environment variables
    if root == "env":
        env = env_vars if env_vars is not None else dict(os.environ)
        return _navigate_path(env, path)

    # Priority 5: Context variables
    if root == "context":
        if execution_context is None:
            return None
        return _navigate_path(execution_context, path)

    return None


def _navigate_path(data: Any, path: list) -> Any:
    """Navigate a dot-separated path through nested data structures."""
    current = data
    for part in path:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, (list, tuple)) and part.isdigit():
            idx = int(part)
            current = current[idx] if 0 <= idx < len(current) else None
        else:
            return None
    return current


def resolve_template(
    template: str,
    node_outputs: Dict[str, Any],
    workflow_variables: Optional[Dict[str, Any]] = None,
    loop_context: Optional[Dict[str, Any]] = None,
    execution_context: Optional[Dict[str, Any]] = None,
    env_vars: Optional[Dict[str, str]] = None,
) -> str:
    """Resolve all {{ }} template expressions in a string.

    Unresolved variables become empty string.
    """
    if not template or "{{" not in template:
        return template

    def _replace(match):
        expr = match.group(1).strip()
        value = resolve_variable(
            expr, node_outputs, workflow_variables,
            loop_context, execution_context, env_vars,
        )
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            try:
                return json.dumps(value, ensure_ascii=False)
            except (TypeError, ValueError):
                return str(value)
        return str(value)

    return _TEMPLATE_PATTERN.sub(_replace, template)


def resolve_template_deep(
    data: Any,
    node_outputs: Dict[str, Any],
    workflow_variables: Optional[Dict[str, Any]] = None,
    loop_context: Optional[Dict[str, Any]] = None,
    execution_context: Optional[Dict[str, Any]] = None,
    env_vars: Optional[Dict[str, str]] = None,
) -> Any:
    """Recursively resolve {{ }} expressions in nested data structures."""
    if isinstance(data, str):
        return resolve_template(
            data, node_outputs, workflow_variables,
            loop_context, execution_context, env_vars,
        )
    if isinstance(data, dict):
        return {
            k: resolve_template_deep(
                v, node_outputs, workflow_variables,
                loop_context, execution_context, env_vars,
            )
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [
            resolve_template_deep(
                item, node_outputs, workflow_variables,
                loop_context, execution_context, env_vars,
            )
            for item in data
        ]
    return data


class VariableResolver:
    """Stateful variable resolver that maintains resolution context."""

    def __init__(
        self,
        workflow_variables: Optional[Dict[str, Any]] = None,
        execution_context: Optional[Dict[str, Any]] = None,
        env_vars: Optional[Dict[str, str]] = None,
    ):
        self.workflow_variables = workflow_variables or {}
        self.execution_context = execution_context or {}
        self.env_vars = env_vars
        self._node_outputs: Dict[str, Any] = {}
        self._loop_context: Optional[Dict[str, Any]] = None

    def set_node_output(self, node_id: str, output: Any):
        """Store a node's output for later reference."""
        self._node_outputs[node_id] = output

    def set_loop_context(self, context: Optional[Dict[str, Any]]):
        """Set the current loop context."""
        self._loop_context = context

    def resolve(self, expression: str) -> Any:
        """Resolve a single variable expression."""
        return resolve_variable(
            expression, self._node_outputs,
            self.workflow_variables, self._loop_context,
            self.execution_context, self.env_vars,
        )

    def resolve_template(self, template: str) -> str:
        """Resolve all {{ }} expressions in a string."""
        return resolve_template(
            template, self._node_outputs,
            self.workflow_variables, self._loop_context,
            self.execution_context, self.env_vars,
        )

    def resolve_deep(self, data: Any) -> Any:
        """Recursively resolve expressions in nested data."""
        return resolve_template_deep(
            data, self._node_outputs,
            self.workflow_variables, self._loop_context,
            self.execution_context, self.env_vars,
        )

    def get_node_outputs(self) -> Dict[str, Any]:
        return dict(self._node_outputs)

    def clear(self):
        self._node_outputs.clear()
        self._loop_context = None

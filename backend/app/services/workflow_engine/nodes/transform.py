"""Data transform node — maps variables using Schema v1 mappings format."""
import logging
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "transform",
    label="Transform",
    description="Transform and map data between nodes",
    category="data",
    icon="swap",
)
class TransformNodeExecutor(BaseNodeExecutor):
    """Data transformation node following Schema v1 format.

    Schema v1 mappings: [{ targetVar, sourceExpression }, ...]
    Also supports legacy format (static/extract/mappings) for backward compatibility.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Transform"},
            "mappings": {
                "type": "array",
                "title": "Variable Mappings",
                "description": "List of { targetVar, sourceExpression } pairs",
                "items": {
                    "type": "object",
                    "required": ["targetVar"],
                    "properties": {
                        "targetVar": {"type": "string", "title": "Target Variable"},
                        "sourceExpression": {
                            "type": "string",
                            "title": "Source Expression",
                            "description": "e.g. {{ node_1.output.result }}",
                        },
                    },
                },
            },
            # Legacy fields (backward compatibility)
            "static": {
                "type": "object",
                "title": "Static Values",
                "additionalProperties": {},
            },
            "extract": {
                "type": "object",
                "title": "Direct Extraction",
                "additionalProperties": {"type": "string"},
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        try:
            output: Dict[str, Any] = {}

            # Build resolver context
            node_outputs = context.upstream_outputs
            workflow_vars = context.input_data.get("_workflow_variables", {})
            loop_ctx = context.input_data.get("_loop_context")
            exec_ctx = context.input_data.get("_execution_context", {})

            # Schema v1 format: mappings with targetVar/sourceExpression
            mappings = context.node_config.get("mappings", [])
            if mappings and isinstance(mappings, list):
                for mapping in mappings:
                    target_var = mapping.get("targetVar", "")
                    source_expr = mapping.get("sourceExpression", "")

                    if not target_var:
                        continue

                    if source_expr:
                        # Strip {{ }} if present
                        if source_expr.startswith("{{") and source_expr.endswith("}}"):
                            source_expr = source_expr[2:-2].strip()
                        if context.resolver:
                            value = context.resolver.resolve(source_expr)
                        else:
                            from ..variable_resolver import resolve_variable
                            value = resolve_variable(
                                source_expr, node_outputs,
                                workflow_variables=workflow_vars,
                                loop_context=loop_ctx,
                                execution_context=exec_ctx,
                            )
                    else:
                        value = None

                    output[target_var] = value

            # Legacy: static values
            static = context.node_config.get("static", {})
            if isinstance(static, dict):
                output.update(static)

            # Legacy: direct extraction
            extract = context.node_config.get("extract", {})
            if isinstance(extract, dict) and not mappings:
                for target_path, source_expr in extract.items():
                    if source_expr.startswith("{{") and source_expr.endswith("}}"):
                        source_expr = source_expr[2:-2].strip()
                    if context.resolver:
                        value = context.resolver.resolve(source_expr)
                    else:
                        from ..variable_resolver import resolve_variable
                        value = resolve_variable(
                            source_expr, node_outputs,
                            workflow_variables=workflow_vars,
                            loop_context=loop_ctx,
                            execution_context=exec_ctx,
                        )
                    output[target_path] = value

            # Pass through input if no transform rules
            if not mappings and not static and not extract:
                output = dict(context.input_data)

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data=output,
            )
        except Exception as e:
            logger.warning("Transform node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

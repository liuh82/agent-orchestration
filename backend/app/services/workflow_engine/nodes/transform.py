"""Data transform node — maps, filters, and extracts data."""
import json
import logging
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "transform",
    label="Transform",
    description="Transform, map, or filter data between nodes",
    category="data",
    icon="repeat",
)
class TransformNodeExecutor(BaseNodeExecutor):
    """Simple data transformation node.

    Supports:
    - JSONPath-like extraction: extract a field from upstream output
    - Static mapping: define output fields with values
    - Template rendering: use {{node_id.output.field}} syntax
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "mappings": {
                "type": "array",
                "title": "Field Mappings",
                "description": "List of {source, target} pairs for data mapping",
                "items": {
                    "type": "object",
                    "properties": {
                        "source": {"type": "string", "title": "Source"},
                        "target": {"type": "string", "title": "Target"},
                        "default": {"type": "string", "title": "Default Value"},
                    },
                },
            },
            "extract": {
                "type": "object",
                "title": "Direct Extraction",
                "description": "Map of output_field: source_path",
                "additionalProperties": {"type": "string"},
            },
            "static": {
                "type": "object",
                "title": "Static Values",
                "description": "Static key-value pairs to include in output",
                "additionalProperties": {},
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        try:
            output = {}

            # Static values
            static = context.node_config.get("static", {})
            if isinstance(static, dict):
                output.update(static)

            # Direct extraction
            extract = context.node_config.get("extract", {})
            if isinstance(extract, dict):
                for target_path, source_expr in extract.items():
                    value = self._resolve_path(source_expr, context)
                    self._set_nested(output, target_path, value)

            # Field mappings
            mappings = context.node_config.get("mappings", [])
            if isinstance(mappings, list):
                for mapping in mappings:
                    source = mapping.get("source", "")
                    target = mapping.get("target", source)
                    default = mapping.get("default")
                    value = self._resolve_path(source, context)
                    if value is None and default is not None:
                        value = default
                    self._set_nested(output, target, value)

            # Pass through input if no transform rules
            if not static and not extract and not mappings:
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

    def _resolve_path(self, path: str, context: NodeContext) -> Any:
        """Resolve a dot-notation path against upstream outputs.

        Format: node_id.output.field.subfield
        """
        if not path:
            return None

        parts = path.split(".")
        if len(parts) >= 3 and parts[1] == "output":
            node_id = parts[0]
            data = context.upstream_outputs.get(node_id, {})
            for field in parts[2:]:
                if isinstance(data, dict):
                    data = data.get(field)
                else:
                    return None
                if data is None:
                    return None
            return data

        # Try from input_data
        data = context.input_data
        for part in parts:
            if isinstance(data, dict):
                data = data.get(part)
            else:
                return None
            if data is None:
                return None
        return data

    def _set_nested(self, data: dict, path: str, value: Any):
        """Set a value at a dot-notation path."""
        parts = path.split(".")
        current = data
        for part in parts[:-1]:
            if part not in current or not isinstance(current[part], dict):
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value

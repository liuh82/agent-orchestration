"""Output node — collects upstream outputs and formats them."""
import json
import logging
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "output",
    label="Output",
    description="Collect and format upstream outputs as workflow result",
    category="output",
    icon="check-circle",
)
class OutputNode(BaseNodeExecutor):
    """Output terminal node — collects upstream outputs and formats them.

    Supports formats: json, text, markdown.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Output"},
            "format": {
                "type": "string",
                "title": "Output Format",
                "enum": ["json", "text", "markdown"],
                "default": "json",
            },
            "outputPath": {
                "type": "string",
                "title": "Output Path",
                "description": "Optional file path to write output to",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        format_type = context.node_config.get("format", "json")
        output_path = context.node_config.get("outputPath")

        # Collect all upstream outputs
        upstream_data: Dict[str, Any] = {}
        for node_id, output in context.upstream_outputs.items():
            upstream_data[node_id] = output

        # Format output
        try:
            if format_type == "json":
                formatted = json.dumps(upstream_data, indent=2, ensure_ascii=False)
            elif format_type == "text":
                lines = []
                for node_id, data in upstream_data.items():
                    lines.append(f"[{node_id}]")
                    if isinstance(data, dict):
                        for k, v in data.items():
                            lines.append(f"  {k}: {v}")
                    else:
                        lines.append(f"  {data}")
                formatted = "\n".join(lines)
            elif format_type == "markdown":
                lines = ["## Workflow Output\n"]
                for node_id, data in upstream_data.items():
                    lines.append(f"### {node_id}\n")
                    if isinstance(data, dict):
                        for k, v in data.items():
                            lines.append(f"- **{k}**: {v}")
                    else:
                        lines.append(f"- {data}")
                    lines.append("")
                formatted = "\n".join(lines)
            else:
                formatted = str(upstream_data)
        except Exception as e:
            formatted = str(upstream_data)
            logger.debug("Output formatting fallback: %s", e)

        # Write to file if outputPath specified
        if output_path:
            try:
                import os
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(formatted)
            except Exception as e:
                logger.warning("Failed to write output to %s: %s", output_path, e)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "format": format_type,
                "content": formatted,
                "sources": list(upstream_data.keys()),
                "output_path": output_path,
            },
        )

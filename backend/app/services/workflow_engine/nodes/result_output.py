"""Result output node — marks final workflow output and optionally completes the task."""
import json
import logging
import time
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "result_output",
    label="结果输出",
    description="Mark final workflow result and optionally complete the task",
    category="output",
    icon="check-circle",
)
class ResultOutputNode(BaseNodeExecutor):
    """Marks the final output of a workflow. Can optionally update task status to completed."""

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "标签",
                "default": "结果输出",
            },
            "outputFormat": {
                "type": "string",
                "title": "输出格式",
                "enum": ["json", "markdown", "plain_text", "structured"],
                "default": "markdown",
            },
            "resultField": {
                "type": "string",
                "title": "结果字段名",
                "default": "result",
            },
            "onComplete": {
                "type": "string",
                "title": "完成后动作",
                "enum": ["mark_done", "mark_done_and_notify", "none"],
                "default": "mark_done",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        start = time.time()
        output_format = context.node_config.get("outputFormat", "markdown")
        result_field = context.node_config.get("resultField", "result")
        on_complete = context.node_config.get("onComplete", "mark_done")

        try:
            # Extract result value from upstream
            result_value = context.upstream_outputs.get(result_field)

            # If not found by field name, try top-level upstream data
            if result_value is None:
                result_value = context.upstream_outputs

            # Format the result
            formatted = self._format_output(result_value, output_format)

            # Write to task record
            task_id = context.input_data.get("_task_id")
            db = context.db_session
            task_updated = False

            if db and task_id:
                try:
                    from app.models.task import NexusTask

                    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
                    if task:
                        # Store formatted result in spec field (reuse as output field)
                        task.spec = formatted
                        task_updated = True

                        # Handle on_complete action
                        if on_complete in ("mark_done", "mark_done_and_notify"):
                            task.status = "completed"
                            from datetime import datetime, timezone
                            task.completed_at = datetime.now(timezone.utc).isoformat()

                        db.flush()
                except Exception as e:
                    logger.debug("Could not write result to task %s: %s", task_id, e)

            duration_ms = int((time.time() - start) * 1000)
            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "format": output_format,
                    "content": formatted,
                    "result_field": result_field,
                    "on_complete": on_complete,
                    "task_updated": task_updated,
                },
                duration_ms=duration_ms,
            )
        except Exception as e:
            logger.warning("Result output node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    def _format_output(self, value: Any, fmt: str) -> str:
        """Format output value according to the specified format."""
        if value is None:
            return ""

        try:
            if fmt == "json":
                return json.dumps(value, indent=2, ensure_ascii=False)
            elif fmt == "markdown":
                lines = ["## Result\n"]
                if isinstance(value, dict):
                    for k, v in value.items():
                        if isinstance(v, (dict, list)):
                            lines.append(f"**{k}:**\n```json\n{json.dumps(v, indent=2, ensure_ascii=False)}\n```")
                        else:
                            lines.append(f"- **{k}**: {v}")
                elif isinstance(value, list):
                    for item in value:
                        lines.append(f"- {item}")
                else:
                    lines.append(str(value))
                return "\n".join(lines)
            elif fmt == "plain_text":
                if isinstance(value, dict):
                    return "\n".join(f"{k}: {v}" for k, v in value.items())
                elif isinstance(value, list):
                    return "\n".join(str(v) for v in value)
                return str(value)
            else:
                # "structured" — return JSON
                return json.dumps(value, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.debug("Output formatting fallback: %s", e)
            return str(value)

"""Context output node — writes intermediate results back to task context fields."""
import json
import logging
import time
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# Supported target fields on the task record
TARGET_FIELDS = ["summary", "notes", "context", "tags", "custom"]


@NodeRegistry.register(
    "context_output",
    label="上下文输出",
    description="Write intermediate results back to task context fields",
    category="output",
    icon="file-text",
)
class ContextOutputNode(BaseNodeExecutor):
    """Writes intermediate results to task context fields for human review or later node reference."""

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "标签",
                "default": "上下文输出",
            },
            "targets": {
                "type": "array",
                "title": "输出目标",
                "items": {
                    "type": "object",
                    "properties": {
                        "field": {
                            "type": "string",
                            "title": "目标字段",
                            "enum": TARGET_FIELDS,
                        },
                        "source": {
                            "type": "string",
                            "title": "数据来源",
                        },
                        "template": {
                            "type": "string",
                            "title": "格式模板",
                        },
                    },
                    "required": ["field", "source"],
                },
            },
            "appendMode": {
                "type": "boolean",
                "title": "追加模式",
                "default": True,
            },
        },
        "required": ["targets"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        start = time.time()
        targets: List[Dict[str, str]] = context.node_config.get("targets", [])
        append_mode: bool = context.node_config.get("appendMode", True)

        if not targets:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="targets is required",
            )

        written: Dict[str, str] = {}

        try:
            for target in targets:
                field = target.get("field", "")
                source_expr = target.get("source", "")
                template = target.get("template")

                if not field or not source_expr:
                    continue

                # Resolve value from upstream outputs
                value = self._resolve_source(source_expr, context.upstream_outputs)

                # Apply template if provided
                if template and value is not None:
                    formatted = template.replace("{{ value }}", str(value))
                elif value is not None:
                    formatted = str(value)
                else:
                    formatted = ""

                written[field] = formatted

            # Write to task record
            task_id = context.input_data.get("_task_id")
            db = context.db_session
            if db and task_id:
                try:
                    from app.models.task import NexusTask

                    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
                    if task:
                        updates: Dict[str, Any] = {}
                        for field, content in written.items():
                            if field == "summary":
                                existing = task.spec or ""
                                updates["spec"] = (existing + "\n" + content) if append_mode and existing else content
                            elif field == "notes":
                                existing = task.description or ""
                                updates["description"] = (existing + "\n" + content) if append_mode and existing else content
                            elif field == "tags":
                                # Tags stored as JSON-like string in a generic field
                                existing_tags = []
                                if task.depends_on:
                                    try:
                                        existing_tags = json.loads(task.depends_on)
                                    except (json.JSONDecodeError, TypeError):
                                        existing_tags = [task.depends_on]
                                if append_mode:
                                    new_tags = existing_tags + [content]
                                else:
                                    new_tags = [content]
                                updates["depends_on"] = json.dumps(list(dict.fromkeys(new_tags)))
                        for col, val in updates.items():
                            setattr(task, col, val)
                        db.flush()
                except Exception as e:
                    logger.debug("Could not write context to task %s: %s", task_id, e)

            duration_ms = int((time.time() - start) * 1000)
            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={"written": written, "append_mode": append_mode},
                duration_ms=duration_ms,
            )
        except Exception as e:
            logger.warning("Context output node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    def _resolve_source(self, source_expr: str, upstream_outputs: Dict[str, Any]) -> Any:
        """Resolve a dot-path source expression from upstream outputs.

        Examples: 'node_1.result', 'node_2.content', 'input.title'
        """
        parts = source_expr.split(".", 1)
        if len(parts) == 1:
            # Direct key lookup at top level
            return upstream_outputs.get(parts[0])
        node_key, field_path = parts
        node_data = upstream_outputs.get(node_key, {})
        if isinstance(node_data, dict):
            return node_data.get(field_path)
        return node_data

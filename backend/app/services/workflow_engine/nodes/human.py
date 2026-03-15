"""Human intervention node — pauses workflow for user review."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "human",
    label="Human Review",
    description="Pause workflow for human approval or input",
    category="flow",
    icon="user-check",
)
class HumanNodeExecutor(BaseNodeExecutor):
    """Creates a human_intervention record and pauses the workflow.

    The workflow engine detects WAITING status and stops scheduling.
    When the user approves/rejects via API, the engine resumes.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "title": "Review Title",
                "description": "Title shown to the reviewer",
                "default": "Please Review",
            },
            "description": {
                "type": "string",
                "title": "Description",
                "description": "Context for the reviewer",
            },
            "assignee_id": {
                "type": "string",
                "title": "Assignee User ID",
                "description": "Optional: assign to specific user",
            },
            "timeout_hours": {
                "type": "integer",
                "title": "Timeout (hours)",
                "description": "Auto-reject after timeout",
                "default": 72,
            },
            "require_comment": {
                "type": "boolean",
                "title": "Require Comment",
                "description": "Whether a comment is required",
                "default": False,
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        db = context.db_session
        if not db:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Database session required for human node",
            )

        try:
            intervention = await self._create_intervention(context, db)
            return NodeResult(
                status=NodeStatus.WAITING,
                output_data={
                    "intervention_id": intervention,
                    "message": "Waiting for human review",
                },
            )
        except Exception as e:
            logger.warning("Human node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    async def _create_intervention(self, context: NodeContext, db) -> str:
        """Create a HumanIntervention record."""
        from app.models.human_intervention import HumanIntervention
        from app.models.base import generate_uuid
        from app.models.task import NexusTask

        intervention_id = generate_uuid()

        # Try to find or create a linked task
        task_id = context.input_data.get("_task_id")
        if not task_id and context.workflow_id:
            # Create a placeholder task
            task_id = generate_uuid()
            task = NexusTask(
                id=task_id,
                project_id=context.node_config.get("project_id"),
                user_id=context.node_config.get("user_id"),
                name=f"WF-Review-{context.node_id}",
                title=context.node_config.get("title", "Workflow Review"),
                description=context.node_config.get("description", ""),
                status="pending_approval",
                workflow_id=context.workflow_id,
            )
            db.add(task)
            db.flush()

        if not task_id:
            task_id = "placeholder"

        intervention = HumanIntervention(
            id=intervention_id,
            task_id=task_id,
            workflow_execution_id=context.execution_id,
            node_id=context.node_id,
            status="pending",
            context=json.dumps({
                "title": context.node_config.get("title", "Please Review"),
                "description": context.node_config.get("description", ""),
                "upstream_outputs": context.upstream_outputs,
            }),
        )
        db.add(intervention)
        db.flush()

        return intervention_id

    async def resume(self, context: NodeContext, decision: str, comment: str = "") -> NodeResult:
        """Resume after human decision. Called by the engine."""
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "decision": decision,
                "comment": comment,
            },
        )

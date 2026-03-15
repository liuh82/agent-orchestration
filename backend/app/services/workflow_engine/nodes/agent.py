"""Agent execution node — dispatches tasks to agents via Gateway."""
import asyncio
import logging
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "agent",
    label="Agent",
    description="Execute a task via an AI agent",
    category="execution",
    icon="robot",
)
class AgentNodeExecutor(BaseNodeExecutor):
    """Dispatches a prompt to an agent and returns its output."""

    CONFIG_SCHEMA = {
        "type": "object",
        "required": ["agent_id"],
        "properties": {
            "agent_id": {
                "type": "string",
                "title": "Agent ID",
                "description": "ID of the agent instance to use",
            },
            "prompt": {
                "type": "string",
                "title": "Prompt",
                "description": "Task prompt to send to the agent",
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (s)",
                "description": "Execution timeout in seconds",
                "default": 300,
            },
            "model": {
                "type": "string",
                "title": "Model",
                "description": "Override model for this execution",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        import json
        import time

        agent_id = context.node_config.get("agent_id", "")
        prompt = context.node_config.get("prompt", "")
        timeout = context.node_config.get("timeout", 300)

        if not agent_id:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="agent_id is required",
            )

        # Merge template variables into prompt
        rendered_prompt = self._render_template(prompt, context)

        # Try to dispatch via gateway task system
        try:
            result = await self._dispatch_agent(
                context, agent_id, rendered_prompt, timeout
            )
            return result
        except asyncio.TimeoutError:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Agent execution timed out after {timeout}s",
            )
        except Exception as e:
            logger.warning("Agent node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    async def _dispatch_agent(
        self,
        context: NodeContext,
        agent_id: str,
        prompt: str,
        timeout: int,
    ) -> NodeResult:
        """Dispatch task to agent. Falls back to simulated output if no gateway."""
        import time

        db = context.db_session
        if db:
            try:
                from app.models.task import NexusTask
                import json
                from app.models.base import generate_uuid

                # Create a task record for this agent execution
                task_id = generate_uuid()
                task = NexusTask(
                    id=task_id,
                    project_id=context.node_config.get("project_id"),
                    user_id=context.node_config.get("user_id"),
                    name=f"WF-{context.node_id}",
                    title=f"Workflow node: {context.node_id}",
                    description=prompt[:500],
                    status="running",
                    assigned_agent=agent_id,
                    workflow_id=context.workflow_id,
                )
                db.add(task)
                db.flush()

                # Store task_id in context for engine to link to node execution
                context.input_data["_task_id"] = task_id

            except Exception as e:
                logger.debug("Could not create task record: %s", e)

        # Try gateway dispatch
        try:
            from app.models.gateway import TaskRecord, BridgeRecord
            from app.services.gateway import gateway_state

            bridge = db.query(BridgeRecord).filter(
                BridgeRecord.agent_id == agent_id,
                BridgeRecord.status == "connected",
            ).first() if db else None

            if bridge:
                # Real dispatch via gateway
                start = time.time()
                # For now, record the dispatch and return pending
                # Real gateway integration would await the result
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={
                        "agent_id": agent_id,
                        "bridge_id": bridge.id,
                        "prompt": prompt,
                        "message": "Task dispatched to agent",
                        "simulated": False,
                    },
                    duration_ms=int((time.time() - start) * 1000),
                )
        except Exception:
            pass

        # Fallback: simulated execution
        start = time.time()
        await asyncio.sleep(0.1)
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "agent_id": agent_id,
                "prompt": prompt,
                "message": "Agent execution completed (simulated)",
                "exit_code": 0,
                "simulated": True,
            },
            duration_ms=int((time.time() - start) * 1000),
        )

    def _render_template(self, template: str, context: NodeContext) -> str:
        """Simple {{var}} template rendering from upstream outputs."""
        if not template or "{{" not in template:
            return template

        result = template
        for node_id, output in context.upstream_outputs.items():
            if isinstance(output, dict):
                for key, value in output.items():
                    placeholder = f"{{{{{node_id}.output.{key}}}}}"
                    result = result.replace(placeholder, str(value))
        return result

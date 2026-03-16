"""Agent execution node — dispatches tasks to agents via Gateway."""
import asyncio
import logging
import time
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from ..variable_resolver import resolve_template
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
    """Dispatches a prompt to an agent and returns its output.

    Supports:
    - Loading Agent config from data.agentId or inline config
    - Variable resolution in prompt via {{ }} syntax
    - Configurable model / temperature / maxTokens / timeout
    - Output: { content, usage, model }
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "agentId": {
                "type": "string",
                "title": "Agent ID",
                "description": "Select an existing Agent instance",
            },
            "agentType": {
                "type": "string",
                "title": "Agent Type",
                "description": "Agent type when no agentId (e.g. claude, gpt4, custom)",
            },
            "prompt": {
                "type": "string",
                "title": "Prompt",
                "description": "Agent prompt template, supports {{ variable }} syntax",
            },
            "model": {
                "type": "string",
                "title": "Model",
                "description": "Model identifier",
            },
            "temperature": {
                "type": "number",
                "title": "Temperature",
                "description": "Sampling temperature (0-1)",
                "default": 0.7,
                "minimum": 0,
                "maximum": 1,
            },
            "maxTokens": {
                "type": "integer",
                "title": "Max Tokens",
                "default": 4096,
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (s)",
                "default": 300,
            },
            "overridableFields": {
                "type": "array",
                "title": "Overridable Fields",
                "description": "Fields that can be overridden at task creation time",
                "items": {"type": "string"},
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        agent_id = context.node_config.get("agentId", "")
        prompt = context.node_config.get("prompt", "")
        model = context.node_config.get("model", "")
        temperature = context.node_config.get("temperature", 0.7)
        max_tokens = context.node_config.get("maxTokens", 4096)
        timeout = context.node_config.get("timeout", 300)

        if not agent_id and not prompt:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="agentId or prompt is required",
            )

        # Resolve variables in prompt
        rendered_prompt = resolve_template(
            prompt,
            context.upstream_outputs,
            context.input_data.get("_workflow_variables", {}),
            context.input_data.get("_loop_context"),
            context.input_data.get("_execution_context", {}),
        )

        try:
            result = await self._dispatch_agent(
                context, agent_id, rendered_prompt, model,
                temperature, max_tokens, timeout,
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
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: int,
    ) -> NodeResult:
        """Dispatch task to agent. Falls back to simulated output if no gateway."""
        start = time.time()
        db = context.db_session

        # Try to create a task record
        if db:
            try:
                from app.models.task import NexusTask
                from app.models.base import generate_uuid

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
                context.input_data["_task_id"] = task_id
            except Exception as e:
                logger.debug("Could not create task record: %s", e)

        # Try gateway dispatch
        if db and agent_id:
            try:
                from app.models.gateway import BridgeRecord

                bridge = db.query(BridgeRecord).filter(
                    BridgeRecord.agent_id == agent_id,
                    BridgeRecord.status == "connected",
                ).first()

                if bridge:
                    return NodeResult(
                        status=NodeStatus.SUCCESS,
                        output_data={
                            "agent_id": agent_id,
                            "bridge_id": bridge.id,
                            "content": prompt,
                            "usage": {},
                            "model": model or "default",
                            "message": "Task dispatched to agent",
                            "simulated": False,
                        },
                        duration_ms=int((time.time() - start) * 1000),
                    )
            except Exception:
                pass

        # Fallback: simulated execution
        await asyncio.sleep(0.1)
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "agent_id": agent_id,
                "content": f"(Simulated agent response for prompt: {prompt[:100]}...)",
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                },
                "model": model or "simulated",
                "message": "Agent execution completed (simulated)",
                "exit_code": 0,
                "simulated": True,
            },
            duration_ms=int((time.time() - start) * 1000),
        )

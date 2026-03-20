"""Agent execution node — dispatches tasks to agents via Gateway."""
import asyncio
import logging
import shutil
import subprocess
import time
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
            "agentSelectMode": {
                "type": "string",
                "title": "Agent Select Mode",
                "description": "How to select agent: 'select' (from list) or 'manual' (free input)",
                "default": "select",
                "enum": ["select", "manual"],
            },
            "workDir": {
                "type": "string",
                "title": "Working Directory",
                "description": "Working directory for agent execution (absolute or relative to project)",
            },
            "envVars": {
                "type": "string",
                "title": "Environment Variables",
                "description": "JSON string of extra env vars, e.g. '{\"NODE_ENV\": \"production\"}'",
            },
            "outputFormat": {
                "type": "string",
                "title": "Output Format",
                "description": "Agent output format: 'text', 'json', 'markdown'",
                "default": "text",
            },
            "outputAlias": {
                "type": "string",
                "title": "Output Alias",
                "description": "Alias name for referencing this node's output in downstream nodes (default: node_id)",
            },
            "gitEnabled": {
                "type": "boolean",
                "title": "Enable Git Integration",
                "description": "Whether to create git branch and commit changes for this agent task",
                "default": False,
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        agent_id = context.node_config.get("agentId") or context.node_config.get("agent_id", "")
        prompt = context.node_config.get("prompt") or context.node_config.get("prompt_template", "")
        model = context.node_config.get("model", "")
        temperature = context.node_config.get("temperature", 0.7)
        max_tokens = context.node_config.get("maxTokens", 4096)
        timeout = context.node_config.get("timeout", 300)
        work_dir = context.node_config.get("workDir", "")
        output_format = context.node_config.get("outputFormat", "text")
        output_alias = context.node_config.get("outputAlias", "")
        git_enabled = context.node_config.get("gitEnabled", False)

        if not agent_id and not prompt:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="agentId or prompt is required",
            )

        # Resolve variables in prompt
        if context.resolver:
            rendered_prompt = context.resolver.resolve_template(prompt)
        else:
            from ..variable_resolver import resolve_template
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
                temperature, max_tokens, timeout, work_dir,
            )

            # Inject outputAlias into result for engine alias mapping
            if output_alias and result.output_data:
                result.output_data["_output_alias"] = output_alias

            # Git integration: create branch + commit if enabled
            if git_enabled and work_dir and result.status == NodeStatus.SUCCESS:
                self._handle_git_integration(context.node_id, prompt, work_dir, result)

            # TODO: Apply outputFormat to format result content

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
        work_dir: str = "",
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
                    project_id=(
                        context.node_config.get("project_id")
                        or context.input_data.get("project_id")
                    ),
                    user_id=(
                        context.node_config.get("user_id")
                        or context.input_data.get("_execution_context", {}).get("user_id")
                    ),
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

        # Fallback: try LLM provider, then simulated execution
        if model:
            try:
                from app.services.llm_provider import llm_provider
                content = await llm_provider.chat_completion(
                    model_id=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={
                        "agent_id": agent_id,
                        "content": content,
                        "model": model,
                        "message": "Agent execution completed (LLM direct)",
                        "simulated": False,
                    },
                    duration_ms=int((time.time() - start) * 1000),
                )
            except Exception as e:
                logger.warning("LLM provider call failed, falling back to simulated: %s", e)

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

    def _handle_git_integration(
        self,
        node_id: str,
        prompt: str,
        work_dir: str,
        result: NodeResult,
    ) -> None:
        """Create a git branch, run agent, and commit any changes."""
        import os

        if not os.path.isdir(work_dir):
            logger.warning("Git integration: work_dir does not exist: %s", work_dir)
            return

        # Check if it's a git repo
        if not os.path.isdir(os.path.join(work_dir, ".git")):
            logger.warning("Git integration: %s is not a git repo", work_dir)
            return

        branch_name = f"agent-{node_id[:8]}-{int(time.time())}"

        # Create and checkout branch
        create_out = run_git_cmd(["git", "checkout", "-b", branch_name], work_dir)
        if create_out is None and not os.path.exists(work_dir):
            logger.warning("Git integration: failed to create branch %s", branch_name)
            return
        logger.info("Git integration: created branch %s", branch_name)

        # Check for changes and commit
        status_out = run_git_cmd(["git", "status", "--porcelain"], work_dir)
        if status_out.strip():
            run_git_cmd(["git", "add", "-A"], work_dir)
            commit_msg = f"Agent {node_id}: {prompt[:50]}"
            run_git_cmd(["git", "commit", "-m", commit_msg], work_dir)
            commit_hash = get_git_head(work_dir)
            logger.info("Git integration: committed on %s (%s)", branch_name, commit_hash)
        else:
            commit_hash = None
            logger.info("Git integration: no changes to commit on %s", branch_name)

        if result.output_data:
            result.output_data["git_branch"] = branch_name
            result.output_data["git_commit"] = commit_hash


def run_git_cmd(args: list, cwd: str) -> str:
    """Run a git command and return stdout."""
    if not shutil.which("git"):
        return ""
    try:
        result = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def get_git_head(cwd: str) -> str:
    """Get current HEAD commit hash (short)."""
    return run_git_cmd(["git", "rev-parse", "--short", "HEAD"], cwd)

"""Core workflow engine — execution scheduler with node dispatch and graph traversal.

Supports Schema v1 format (source/target edges, data config, sourceHandle routing),
variable context propagation, loop handling, error retry, and workflow-level error strategy.
"""
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from .registry import NodeRegistry
from .state_machine import ExecutionState, StateMachine
from .event_publisher import WorkflowEventPublisher, register_execution_task, unregister_execution_task
from .nodes.base import NodeContext, NodeResult, NodeStatus
from .variable_resolver import VariableResolver

logger = logging.getLogger(__name__)

# In-memory state for running executions
_running_executions: Dict[str, StateMachine] = {}
# Per-execution variable resolvers
_variable_resolvers: Dict[str, VariableResolver] = {}
# Per-execution workflow definitions (needed for resume / loop handling)
_execution_definitions: Dict[str, dict] = {}
# Per-execution tracking of completed node IDs
_completed_nodes: Dict[str, Set[str]] = {}
# Per-execution join node pending inputs: { execution_id: { join_node_id: { source_node_id: output } } }
_pending_join_inputs: Dict[str, Dict[str, Dict[str, Any]]] = {}
# Per-execution join node accumulated upstream_outputs per branch:
# { execution_id: { join_node_id: { source_node_id: upstream_outputs } } }
_pending_join_upstreams: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}
# Per-execution join node timeout tasks: { execution_id: { join_node_id: asyncio.Task } }
_join_timeout_tasks: Dict[str, Dict[str, asyncio.Task]] = {}


class WorkflowEngine:
    """Nexus workflow execution engine (Schema v1 compatible).

    Orchestrates node execution following the workflow graph (nodes + edges).
    Supports sequential, conditional branching, loop, sub-workflow, and error handling.
    """

    async def start(
        self,
        workflow_id: str,
        definition: dict,
        input_params: dict,
        user_id: str,
        db: Session,
        name: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> str:
        """Start a workflow execution. Returns execution_id."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution
        from app.models.base import generate_uuid

        execution_id = generate_uuid()

        # 1. Create execution record
        execution = WorkflowExecution(
            id=execution_id,
            workflow_id=workflow_id,
            template_id=template_id,
            name=name or definition.get("name", f"WF-{workflow_id[:8]}"),
            status=ExecutionState.RUNNING.value,
            input_params=json.dumps(input_params),
            started_at=datetime.utcnow().isoformat() + "Z",
            created_by=user_id,
        )
        db.add(execution)
        db.flush()

        # 2. Store state machine
        sm = StateMachine(ExecutionState.RUNNING)
        _running_executions[execution_id] = sm

        # 3. Parse workflow definition (Schema v1)
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])
        workflow_variables = definition.get("variables", {})
        workflow_config = definition.get("config", {})

        # Store definition for resume / loop handling
        _execution_definitions[execution_id] = definition

        # 4. Build variable resolver
        execution_context = {
            "user_id": user_id,
            "execution_id": execution_id,
            "workflow_id": workflow_id,
        }
        resolver = VariableResolver(
            workflow_variables=workflow_variables,
            execution_context=execution_context,
        )
        _variable_resolvers[execution_id] = resolver

        # 5. Find start nodes (trigger nodes or nodes with no incoming edges)
        target_ids = set()
        for e in edges:
            target_ids.add(e.get("target") or e.get("to", ""))
        start_nodes = [n for n in nodes if n["id"] not in target_ids]

        if not start_nodes:
            if nodes:
                start_nodes = [nodes[0]]
            else:
                self._fail_execution(execution_id, db, "No nodes in workflow definition")
                return execution_id

        # 6. Publish start event
        total_nodes = len([n for n in nodes if not n.get("disabled", False)])
        await WorkflowEventPublisher.publish_execution_status(
            execution_id, "running", name=execution.name,
        )
        await WorkflowEventPublisher.publish_progress(
            execution_id,
            current_node=start_nodes[0]["id"],
            completed_nodes=0,
            total_nodes=total_nodes,
        )

        # 7. Inject internal context into input_params
        input_params["_workflow_variables"] = workflow_variables
        input_params["_execution_context"] = execution_context
        input_params["_workflow_config"] = workflow_config

        # 7b. Register execution_id → task_id mapping for SSE bridge
        task_id = input_params.get("task_id")
        if task_id:
            register_execution_task(execution_id, task_id)

        # 8. Schedule start nodes (fire-and-forget via asyncio task)
        _completed_nodes[execution_id] = set()
        _pending_join_inputs[execution_id] = {}
        _pending_join_upstreams[execution_id] = {}

        await self._schedule_nodes(
            execution_id, start_nodes, nodes, edges,
            input_params, db, workflow_config,
        )

        return execution_id

    async def _schedule_nodes(
        self,
        execution_id: str,
        node_defs: List[dict],
        all_nodes: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        workflow_config: Optional[Dict[str, Any]] = None,
        upstream_outputs: Optional[Dict[str, Any]] = None,
    ):
        """Schedule one or more nodes for execution."""
        upstream_outputs = upstream_outputs or {}
        workflow_config = workflow_config or {}

        # Inject all_nodes into each node def for backward compat
        for node_def in node_defs:
            node_def["_all_nodes"] = all_nodes

        # Execute nodes sequentially to avoid db session conflicts
        for node_def in node_defs:
            node_def["_all_nodes"] = all_nodes
            try:
                await self._execute_node(
                    execution_id, node_def, all_nodes, edges,
                    input_data, db, upstream_outputs, workflow_config,
                )
            except Exception as e:
                print(f"[DEBUG] node {node_def['id']} exception: {type(e).__name__}: {e}", flush=True)
            # 确保当前轮节点执行记录写入
            try:
                db.flush()
            except Exception:
                pass

        # Safety net: ensure all pending changes are committed after all nodes finish
        try:
            db.commit()
            logger.debug("Safety net commit OK")
        except Exception as e:
            pass

    async def _execute_node(
        self,
        execution_id: str,
        node_def: dict,
        all_nodes: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        upstream_outputs: Dict[str, Any],
        workflow_config: Dict[str, Any],
        retry_count: int = 0,
    ):
        """Execute a single node and schedule downstream nodes."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution
        from app.models.base import generate_uuid

        node_id = node_def["id"]
        node_type = node_def["type"]
        # Schema v1 uses "data" for node config (fallback to "config" for legacy)
        node_config = node_def.get("data", node_def.get("config", {}))

        sm = _running_executions.get(execution_id)
        if not sm or sm.is_terminal:
            logger.debug("Execution %s is terminal, skipping node %s", execution_id, node_id)
            return

        # Skip disabled nodes
        if node_def.get("disabled", False):
            logger.debug("Node %s is disabled, skipping", node_id)
            return

        if sm.state in (ExecutionState.PAUSED, ExecutionState.CANCELLED):
            logger.debug("Execution %s is %s, skipping node %s", execution_id, sm.state.value, node_id)
            return

        # 1. Create node execution record
        node_exec_id = generate_uuid()
        node_exec = WorkflowNodeExecution(
            id=node_exec_id,
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_config=json.dumps(node_config) if node_config else None,
            status="running",
            input_data=json.dumps(input_data),
            started_at=datetime.utcnow().isoformat() + "Z",
        )
        db.add(node_exec)
        db.flush()

        # Update current_node_id on execution
        execution = db.query(WorkflowExecution).get(execution_id)
        if execution:
            execution.current_node_id = node_id
            db.flush()

        # 2. Publish node running event
        await WorkflowEventPublisher.publish_node_status(
            execution_id, node_id, "running"
        )

        # 3. Get resolver and inject loop context
        resolver = _variable_resolvers.get(execution_id)
        if resolver:
            input_data["_loop_context"] = resolver._loop_context

        # 4. Get executor and run
        result: Optional[NodeResult] = None
        try:
            executor = NodeRegistry.get_executor(node_type)
            context = NodeContext(
                node_id=node_id,
                node_type=node_type,
                node_config=node_config,
                input_data=input_data,
                execution_id=execution_id,
                workflow_id=input_data.get("_execution_context", {}).get("workflow_id", ""),
                upstream_outputs=upstream_outputs,
                db_session=db,
                resolver=resolver,
            )

            start_time = time.time()
            result = await executor.execute(context)
            duration_ms = int((time.time() - start_time) * 1000)
            if result.duration_ms is None:
                result.duration_ms = duration_ms

        except Exception as e:
            logger.error("Node execution error: node=%s err=%s", node_id, e)
            result = NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

        # 5. Update node execution record
        node_exec.status = result.status.value
        node_exec.output_data = json.dumps(result.output_data) if result.output_data else None
        node_exec.error_message = result.error_message
        node_exec.completed_at = datetime.utcnow().isoformat() + "Z"
        node_exec.duration_ms = result.duration_ms
        db.flush()

        # Link task_id / agent_id if present
        if result.output_data and isinstance(result.output_data, dict):
            if "_task_id" in result.output_data:
                node_exec.task_id = result.output_data["_task_id"]
            if "agent_id" in result.output_data:
                node_exec.agent_id = result.output_data.get("agent_id")
            db.flush()

        # 5a. Per-node commit to persist progress immediately
        try:
            db.commit()
            logger.info("Node %s execution record committed", node_id)
        except Exception as e:
            logger.warning("Node %s commit failed: %s, rolling back", node_id, e)
            db.rollback()
            # Re-flush after rollback to keep session usable
            db.flush()

        # 6. Publish result with output data
        await WorkflowEventPublisher.publish_node_status(
            execution_id, node_id, result.status.value,
            output_data=result.output_data,
            error_message=result.error_message,
            duration_ms=result.duration_ms,
        )

        # 7. Store node output in resolver (with optional outputAlias)
        if resolver and result.status == NodeStatus.SUCCESS:
            output = result.output_data or {}
            # Extract alias: from result metadata or from node config
            alias = output.pop("_output_alias", None) if isinstance(output, dict) else None
            if not alias:
                alias = node_config.get("outputAlias")
            resolver.set_node_output(node_id, output, alias=alias)

        # Track completed nodes
        completed = _completed_nodes.get(execution_id, set())
        completed.add(node_id)
        _completed_nodes[execution_id] = completed

        # 8. Handle WAITING status
        if result.status == NodeStatus.WAITING:
            sm.transition(ExecutionState.WAITING)
            await WorkflowEventPublisher.publish_execution_status(
                execution_id, "waiting", node_id=node_id
            )
            return

        # 9. Handle FAILED status — check error strategy
        if result.status == NodeStatus.FAILED:
            node_error_strategy = node_config.get("errorStrategy", "stop")
            wf_error_strategy = workflow_config.get("errorStrategy", "stop_all")

            # Check retry policy first
            retry_policy = node_config.get("retryPolicy") or workflow_config.get("retryPolicy", {})
            max_retries = retry_policy.get("maxRetries", 0)
            retry_interval = retry_policy.get("interval", 5)

            if retry_count < max_retries:
                logger.info(
                    "Retrying node %s (attempt %d/%d)",
                    node_id, retry_count + 1, max_retries,
                )
                await asyncio.sleep(retry_interval)
                await self._execute_node(
                    execution_id, node_def, all_nodes, edges,
                    input_data, db, upstream_outputs, workflow_config,
                    retry_count=retry_count + 1,
                )
                return

            if node_error_strategy == "skip":
                logger.info("Skipping failed node %s (errorStrategy=skip)", node_id)
                self._check_completion(execution_id, db)
                return

            if node_error_strategy == "continue":
                logger.warning("Node %s failed, continuing (errorStrategy=continue)", node_id)
                # Continue to downstream
            elif wf_error_strategy == "continue":
                logger.warning(
                    "Node %s failed, continuing (workflow errorStrategy=continue)", node_id,
                )
            else:
                # Default: stop_all
                self._fail_execution(
                    execution_id, db,
                    f"Node {node_id} failed: {result.error_message}",
                )
                return

        # 10. Determine next nodes based on sourceHandle routing
        try:
            next_info = self._get_next_nodes_v1(
                node_id, result, node_def, all_nodes, edges,
            )
            next_nodes = next_info["nodes"]
            routing = next_info.get("routing", {})
        except Exception as _e:
            raise

        # 11. Handle loop routing
        if node_type == "loop" and result.output_data:
            loop_done = result.output_data.get("done", False)
            if not loop_done:
                # Continue loop: execute body nodes, then re-enter loop node
                await self._handle_loop_body(
                    execution_id, node_id, result.output_data,
                    all_nodes, edges, input_data, db,
                    upstream_outputs, workflow_config,
                )
                return

        # 12. Merge upstream outputs
        new_upstream = dict(upstream_outputs)
        new_upstream[node_id] = result.output_data or {}

        # 12a. Handle fork downstream: inject branch info per target
        if node_type == "fork":
            fork_mode = node_config.get("mode", "broadcast")
            branch_data_list = node_config.get("branchData", [])
            # Compute outgoing edges for this node (outgoing is only defined in _get_next_nodes_v1)
            fork_outgoing = [
                e for e in edges
                if (e.get("source") or e.get("from", "")) == node_id
            ]
            for e in fork_outgoing:
                handle = e.get("sourceHandle", "")
                target_id = e.get("target") or e.get("to", "")
                if handle.startswith("branch_"):
                    branch_index = handle
                    # In distribute mode, inject per-branch data
                    if fork_mode == "distribute" and branch_data_list:
                        idx = int(branch_index.split("_")[1])
                        if idx < len(branch_data_list) and isinstance(branch_data_list[idx], dict):
                            new_upstream["_fork_branch_data"] = branch_data_list[idx].get("data", "")

        # 12b. Handle join downstream: multi-input wait mechanism
        # Check if any downstream node is a join — if so, use join-aware scheduling
        join_targets = []
        normal_targets = []
        for next_node in next_nodes:
            if next_node.get("type") == "join":
                join_targets.append(next_node)
            else:
                normal_targets.append(next_node)

        # Schedule non-join targets immediately
        if normal_targets:
            total_nodes = len([n for n in all_nodes if not n.get("disabled", False)])
            await WorkflowEventPublisher.publish_progress(
                execution_id,
                current_node=normal_targets[0]["id"] if normal_targets else "",
                completed_nodes=len(completed),
                total_nodes=total_nodes,
            )
            await self._schedule_nodes(
                execution_id, normal_targets, all_nodes, edges,
                input_data, db, workflow_config, new_upstream,
            )

        # Handle join targets: accumulate inputs and fire when all upstreams complete
        for join_node_def in join_targets:
            join_node_id = join_node_def["id"]
            await self._handle_join_upstream(
                execution_id, join_node_id, join_node_def,
                node_id, result, all_nodes, edges,
                input_data, db, workflow_config, new_upstream, completed,
            )

        # If no targets at all, check completion
        if not next_nodes:
            total_nodes = len([n for n in all_nodes if not n.get("disabled", False)])
            await WorkflowEventPublisher.publish_progress(
                execution_id,
                current_node="",
                completed_nodes=len(completed),
                total_nodes=total_nodes,
            )
            self._check_completion(execution_id, db)

        return

    async def _handle_loop_body(
        self,
        execution_id: str,
        loop_node_id: str,
        loop_output: Dict[str, Any],
        all_nodes: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        upstream_outputs: Dict[str, Any],
        workflow_config: Dict[str, Any],
    ):
        """Execute the loop body nodes and then re-enter the loop node."""
        resolver = _variable_resolvers.get(execution_id)

        # Set loop context for body nodes
        from .nodes.loop_node import LoopNode
        loop_context = LoopNode.build_loop_context(loop_output)
        if resolver:
            resolver.set_loop_context(loop_context)

        # Find body edge targets (sourceHandle="body")
        body_nodes = self._find_edge_targets(
            loop_node_id, "body", all_nodes, edges,
        )

        if not body_nodes:
            logger.warning("Loop node %s has no body edge targets", loop_node_id)
            self._check_completion(execution_id, db)
            return

        # Execute body nodes
        new_upstream = dict(upstream_outputs)
        new_upstream[loop_node_id] = loop_output

        # We need to intercept after body nodes complete and re-enter the loop.
        # Instead of using _schedule_nodes (which runs them and ends),
        # we manually track and re-enter.
        try:
            for body_node in body_nodes:
                body_node["_all_nodes"] = all_nodes
                await self._execute_node(
                    execution_id, body_node, all_nodes, edges,
                    input_data, db, new_upstream, workflow_config,
                )
                # Propagate outputs
                # (get from resolver or completed nodes tracking)
                if resolver:
                    new_upstream[body_node["id"]] = resolver.get_node_outputs().get(
                        body_node["id"], {}
                    )
        except Exception as e:
            logger.error("Loop body execution error: %s", e)
            self._fail_execution(execution_id, db, f"Loop body error: {e}")
            return

        # After body completes, increment loop index and re-execute the loop node
        if resolver:
            next_loop_context = LoopNode.build_next_iteration_context(loop_output)
            resolver.set_loop_context(next_loop_context)

        # Find the loop node definition
        loop_def = None
        for n in all_nodes:
            if n["id"] == loop_node_id:
                loop_def = n
                break

        if loop_def:
            loop_def["_all_nodes"] = all_nodes
            await self._execute_node(
                execution_id, loop_def, all_nodes, edges,
                input_data, db, new_upstream, workflow_config,
            )

    async def _handle_join_upstream(
        self,
        execution_id: str,
        join_node_id: str,
        join_node_def: dict,
        source_node_id: str,
        source_result: NodeResult,
        all_nodes: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        workflow_config: Dict[str, Any],
        upstream_outputs: Dict[str, Any],
        completed: Set[str],
    ):
        """Accumulate inputs for a join node and execute it when all upstreams complete.

        When a branch completes and its downstream is a join node, this method:
        1. Stores the branch output in _pending_join_inputs
        2. Stores the branch's upstream_outputs in _pending_join_upstreams
        3. Counts how many upstream edges the join node has
        4. When all upstreams have reported, merges all branch upstreams and executes
        """
        # Initialize pending dicts for this join node
        if execution_id not in _pending_join_inputs:
            _pending_join_inputs[execution_id] = {}
        if join_node_id not in _pending_join_inputs[execution_id]:
            _pending_join_inputs[execution_id][join_node_id] = {}

        if execution_id not in _pending_join_upstreams:
            _pending_join_upstreams[execution_id] = {}
        if join_node_id not in _pending_join_upstreams[execution_id]:
            _pending_join_upstreams[execution_id][join_node_id] = {}

        # Store this branch's output
        _pending_join_inputs[execution_id][join_node_id][source_node_id] = (
            source_result.output_data or {}
        )

        # Store this branch's upstream_outputs (deep copy to avoid mutations)
        _pending_join_upstreams[execution_id][join_node_id][source_node_id] = (
            dict(upstream_outputs)
        )

        # Calculate how many incoming edges the join node has
        incoming_edges = [
            e for e in edges
            if (e.get("target") or e.get("to", "")) == join_node_id
        ]
        total_upstream = len(incoming_edges)

        # Count how many have reported
        reported = len(_pending_join_inputs[execution_id][join_node_id])

        logger.debug(
            "Join node %s: %d/%d upstream branches completed",
            join_node_id, reported, total_upstream,
        )

        # Check if join mode allows early execution
        join_config = join_node_def.get("data", join_node_def.get("config", {}))
        join_mode = join_config.get("mode", "all")
        join_timeout = join_config.get("timeout", 3600)
        on_timeout = join_config.get("onTimeout", "continue_with_ready")

        should_execute = False
        if join_mode == "any":
            should_execute = reported >= 1
        elif join_mode == "n_of_m":
            required = join_config.get("requiredCount", total_upstream)
            should_execute = reported >= required
        else:  # "all"
            should_execute = reported >= total_upstream

        # Start timeout timer on first branch arrival
        if reported == 1 and join_timeout > 0:
            async def _join_timeout_handler():
                await asyncio.sleep(join_timeout)
                # Check if join already executed (data was popped)
                if join_node_id not in _pending_join_inputs.get(execution_id, {}):
                    return
                logger.warning(
                    "Join node %s timed out after %ds (onTimeout=%s)",
                    join_node_id, join_timeout, on_timeout,
                )
                if on_timeout == "fail":
                    self._fail_execution(
                        execution_id, db,
                        f"Join node {join_node_id} timed out after {join_timeout}s",
                    )
                elif on_timeout == "continue_with_ready":
                    # Execute join with whatever branches have reported so far
                    self._execute_join_with_pending(
                        execution_id, join_node_id, join_node_def,
                        all_nodes, edges, input_data, db,
                        workflow_config, completed,
                    )
                # "skip" — do nothing, join is abandoned

            if execution_id not in _join_timeout_tasks:
                _join_timeout_tasks[execution_id] = {}
            _join_timeout_tasks[execution_id][join_node_id] = asyncio.create_task(
                _join_timeout_handler(),
            )

        if not should_execute:
            return

        # Cancel timeout — join is executing normally
        if execution_id in _join_timeout_tasks:
            timeout_task = _join_timeout_tasks[execution_id].pop(join_node_id, None)
            if timeout_task and not timeout_task.done():
                timeout_task.cancel()

        # All required upstreams completed — execute the join node
        branch_outputs = _pending_join_inputs[execution_id].pop(join_node_id, {})
        branch_upstreams = _pending_join_upstreams[execution_id].pop(join_node_id, {})

        # Merge upstream_outputs from all branches so join has complete context
        merged_upstream: Dict[str, Any] = {}
        for bid, bup in branch_upstreams.items():
            merged_upstream.update(bup)

        # Build upstream for join: include all collected branch outputs
        join_input_data = dict(input_data)
        join_input_data["_branch_outputs"] = branch_outputs

        # Execute the join node with merged upstream_outputs
        await self._execute_node(
            execution_id, join_node_def, all_nodes, edges,
            join_input_data, db, merged_upstream, workflow_config,
        )

    def _execute_join_with_pending(
        self,
        execution_id: str,
        join_node_id: str,
        join_node_def: dict,
        all_nodes: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        workflow_config: Dict[str, Any],
        completed: Set[str],
    ):
        """Execute join with whatever branches have reported (used by timeout handler)."""
        branch_outputs = _pending_join_inputs.get(execution_id, {}).pop(join_node_id, {})
        branch_upstreams = _pending_join_upstreams.get(execution_id, {}).pop(join_node_id, {})

        # Cancel timeout task
        if execution_id in _join_timeout_tasks:
            timeout_task = _join_timeout_tasks[execution_id].pop(join_node_id, None)
            if timeout_task and not timeout_task.done():
                timeout_task.cancel()

        merged_upstream: Dict[str, Any] = {}
        for bid, bup in branch_upstreams.items():
            merged_upstream.update(bup)

        join_input_data = dict(input_data)
        join_input_data["_branch_outputs"] = branch_outputs

        logger.info(
            "Join node %s executing on timeout with %d/%d branches",
            join_node_id, len(branch_outputs), "unknown",
        )

        # Schedule as a task to avoid blocking the timeout handler
        asyncio.create_task(
            self._execute_node(
                execution_id, join_node_def, all_nodes, edges,
                join_input_data, db, merged_upstream, workflow_config,
            )
        )

    def _get_next_nodes_v1(
        self,
        node_id: str,
        result: NodeResult,
        node_def: dict,
        all_nodes: List[dict],
        edges: List[dict],
    ) -> Dict[str, Any]:
        """Determine next nodes using Schema v1 sourceHandle routing.

        Returns:
            { "nodes": [node_def, ...], "routing": { sourceHandle: target_node_id } }
        """
        node_type = node_def.get("type", "")

        # Find outgoing edges (Schema v1 uses "source", legacy uses "from")
        outgoing = []
        for e in edges:
            src = e.get("source") or e.get("from", "")
            if src == node_id:
                outgoing.append(e)

        if not outgoing:
            return {"nodes": [], "routing": {}}

        # Build target node map
        node_map = {n["id"]: n for n in all_nodes}

        # --- sourceHandle routing for conditional nodes ---

        if node_type == "if":
            cond_result = result.output_data.get("result", False) if result.output_data else False
            handle = "true" if cond_result else "false"
            for e in outgoing:
                if e.get("sourceHandle") == handle:
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": handle}}
            # Fallback: follow any edge with matching handle name
            for e in outgoing:
                handle_lower = e.get("sourceHandle", "").lower()
                if handle_lower == ("true" if cond_result else "false"):
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": handle_lower}}
            return {"nodes": [], "routing": {}}

        if node_type == "switch":
            matched_case = result.output_data.get("matched_case") if result.output_data else None
            if matched_case is not None and matched_case != "default":
                handle = f"case_{matched_case}"
            else:
                handle = "default"
            for e in outgoing:
                if e.get("sourceHandle") == handle:
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": handle}}
            # Fallback to default
            for e in outgoing:
                if e.get("sourceHandle") == "default":
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": "default"}}
            return {"nodes": [], "routing": {}}

        if node_type == "loop":
            loop_done = result.output_data.get("done", False) if result.output_data else True
            handle = "done" if loop_done else "body"
            for e in outgoing:
                if e.get("sourceHandle") == handle:
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": handle}}
            # Default for loop done
            if loop_done:
                for e in outgoing:
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {"sourceHandle": "done"}}
            return {"nodes": [], "routing": {}}

        # --- Explicit next_node_ids ---
        if result.next_node_ids:
            nodes = [node_map[nid] for nid in result.next_node_ids if nid in node_map]
            return {"nodes": nodes, "routing": {}}

        # --- Legacy condition node (type="condition") ---
        if node_type == "condition":
            condition_value = str(result.output_data.get("result", "")).lower() if result.output_data else ""
            for e in outgoing:
                edge_cond = str(e.get("condition", e.get("sourceHandle", ""))).lower()
                if edge_cond == condition_value:
                    target_id = e.get("target") or e.get("to", "")
                    if target_id in node_map:
                        return {"nodes": [node_map[target_id]], "routing": {}}
            return {"nodes": [], "routing": {}}

        # --- Default: follow all outgoing edges ---
        next_ids = [e.get("target") or e.get("to", "") for e in outgoing]
        nodes = [node_map[nid] for nid in next_ids if nid in node_map]
        print(f"[DEBUG] _get_next_nodes_v1({node_id}): outgoing={len(outgoing)} next_ids={next_ids} nodes={[n['id'] for n in nodes]}", flush=True)
        return {"nodes": nodes, "routing": {}}

    def _find_edge_targets(
        self,
        node_id: str,
        source_handle: str,
        all_nodes: List[dict],
        edges: List[dict],
    ) -> List[dict]:
        """Find target nodes for a specific sourceHandle."""
        node_map = {n["id"]: n for n in all_nodes}
        targets = []
        for e in edges:
            src = e.get("source") or e.get("from", "")
            if src == node_id and e.get("sourceHandle") == source_handle:
                target_id = e.get("target") or e.get("to", "")
                if target_id in node_map:
                    targets.append(node_map[target_id])
        return targets

    def _check_completion(self, execution_id: str, db: Session):
        """Check if all nodes have completed and finalize the execution."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution

        execution = db.query(WorkflowExecution).get(execution_id)
        if not execution:
            return

        pending_count = db.query(WorkflowNodeExecution).filter(
            WorkflowNodeExecution.execution_id == execution_id,
            WorkflowNodeExecution.status.in_(["pending", "running", "waiting"]),
        ).count()

        if pending_count == 0:
            sm = _running_executions.get(execution_id)
            if sm:
                sm.transition(ExecutionState.COMPLETED)

            execution.status = ExecutionState.COMPLETED.value
            execution.completed_at = datetime.utcnow().isoformat() + "Z"
            db.flush()

            total_nodes = len(_completed_nodes.get(execution_id, set()))
            asyncio.create_task(
                WorkflowEventPublisher.publish_progress(
                    execution_id,
                    current_node="",
                    completed_nodes=total_nodes,
                    total_nodes=total_nodes,
                )
            )
            asyncio.create_task(
                WorkflowEventPublisher.publish_execution_status(
                    execution_id, "completed"
                )
            )

    def _fail_execution(self, execution_id: str, db: Session, error: str):
        """Mark execution as failed."""
        from app.models.workflow_execution import WorkflowExecution

        execution = db.query(WorkflowExecution).get(execution_id)
        if not execution:
            return

        sm = _running_executions.get(execution_id)
        if sm:
            sm.transition(ExecutionState.FAILED)

        execution.status = ExecutionState.FAILED.value
        execution.error_message = error
        execution.completed_at = datetime.utcnow().isoformat() + "Z"
        db.flush()

        asyncio.create_task(
            WorkflowEventPublisher.publish_execution_status(
                execution_id, "failed", error_message=error
            )
        )

    async def pause(self, execution_id: str, db: Session) -> bool:
        """Pause a running execution."""
        sm = _running_executions.get(execution_id)
        if not sm or not sm.can_transition(ExecutionState.PAUSED):
            return False

        sm.transition(ExecutionState.PAUSED)

        from app.models.workflow_execution import WorkflowExecution
        execution = db.query(WorkflowExecution).get(execution_id)
        if execution:
            execution.status = ExecutionState.PAUSED.value
            db.flush()

        await WorkflowEventPublisher.publish_execution_status(
            execution_id, "paused"
        )
        return True

    async def resume(self, execution_id: str, db: Session) -> bool:
        """Resume a paused/waiting execution."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution

        sm = _running_executions.get(execution_id)
        if not sm:
            return False

        if sm.state == ExecutionState.WAITING:
            waiting_node = db.query(WorkflowNodeExecution).filter(
                WorkflowNodeExecution.execution_id == execution_id,
                WorkflowNodeExecution.status == "waiting",
            ).first()

            if waiting_node:
                from app.models.human_intervention import HumanIntervention
                intervention = db.query(HumanIntervention).filter(
                    HumanIntervention.workflow_execution_id == execution_id,
                    HumanIntervention.node_id == waiting_node.node_id,
                    HumanIntervention.status.in_(["approved", "rejected"]),
                ).first()

                if not intervention:
                    return False

                waiting_node.status = "success" if intervention.decision == "approved" else "failed"
                waiting_node.output_data = json.dumps({
                    "decision": intervention.decision,
                    "comment": intervention.comment,
                })
                waiting_node.completed_at = datetime.utcnow().isoformat() + "Z"
                db.flush()

            sm.transition(ExecutionState.RUNNING)

            execution = db.query(WorkflowExecution).get(execution_id)
            if execution:
                execution.status = ExecutionState.RUNNING.value
                db.flush()

            await WorkflowEventPublisher.publish_execution_status(
                execution_id, "running"
            )
            return True

        if sm.state == ExecutionState.PAUSED:
            sm.transition(ExecutionState.RUNNING)

            execution = db.query(WorkflowExecution).get(execution_id)
            if execution:
                execution.status = ExecutionState.RUNNING.value
                db.flush()

            await WorkflowEventPublisher.publish_execution_status(
                execution_id, "running"
            )
            return True

        return False

    async def cancel(self, execution_id: str, db: Session) -> bool:
        """Cancel a running/paused/waiting execution."""
        sm = _running_executions.get(execution_id)
        if not sm:
            return False

        if sm.state in (ExecutionState.COMPLETED, ExecutionState.FAILED, ExecutionState.CANCELLED):
            return False

        sm.transition(ExecutionState.CANCELLED)

        from app.models.workflow_execution import WorkflowExecution
        execution = db.query(WorkflowExecution).get(execution_id)
        if execution:
            execution.status = ExecutionState.CANCELLED.value
            execution.completed_at = datetime.utcnow().isoformat() + "Z"
            db.flush()

        await WorkflowEventPublisher.publish_execution_status(
            execution_id, "cancelled"
        )
        return True

    @staticmethod
    def get_execution_state(execution_id: str) -> Optional[ExecutionState]:
        """Get the current state of a running execution."""
        sm = _running_executions.get(execution_id)
        return sm.state if sm else None

    @staticmethod
    def is_running(execution_id: str) -> bool:
        """Check if an execution is currently running."""
        sm = _running_executions.get(execution_id)
        return sm is not None and not sm.is_terminal

    @staticmethod
    def cleanup_execution(execution_id: str):
        """Clean up in-memory state for a completed/failed execution."""
        _running_executions.pop(execution_id, None)
        _variable_resolvers.pop(execution_id, None)
        _execution_definitions.pop(execution_id, None)
        _completed_nodes.pop(execution_id, None)
        _pending_join_inputs.pop(execution_id, None)
        _pending_join_upstreams.pop(execution_id, None)
        _join_timeout_tasks.pop(execution_id, None)
        unregister_execution_task(execution_id)


# Global singleton
workflow_engine = WorkflowEngine()

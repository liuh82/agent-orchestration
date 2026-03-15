"""Core workflow engine — execution scheduler with node dispatch and graph traversal."""
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from .registry import NodeRegistry
from .state_machine import ExecutionState, StateMachine
from .event_publisher import WorkflowEventPublisher
from .nodes.base import NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# In-memory state for running executions
_running_executions: Dict[str, StateMachine] = {}


class WorkflowEngine:
    """Nexus workflow execution engine.

    Orchestrates node execution following the workflow graph (nodes + edges).
    Supports sequential, conditional branching, parallel, and human-wait flows.
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
            name=name or f"WF-{workflow_id[:8]}",
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

        # 3. Parse workflow definition
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        # 4. Find start nodes (no incoming edges)
        target_ids = {e["to"] for e in edges}
        start_nodes = [n for n in nodes if n["id"] not in target_ids]

        if not start_nodes:
            # Fallback: use first node
            if nodes:
                start_nodes = [nodes[0]]
            else:
                self._fail_execution(execution_id, db, "No nodes in workflow definition")
                return execution_id

        # 5. Publish start event
        await WorkflowEventPublisher.publish_execution_status(
            execution_id, "running", name=execution.name
        )

        # 6. Schedule start nodes (fire-and-forget via asyncio task)
        asyncio.create_task(
            self._schedule_nodes(execution_id, start_nodes, edges, input_params, db)
        )

        return execution_id

    async def _schedule_nodes(
        self,
        execution_id: str,
        node_defs: List[dict],
        edges: List[dict],
        input_data: dict,
        db: Session,
        upstream_outputs: Optional[Dict[str, Any]] = None,
    ):
        """Schedule one or more nodes for execution."""
        upstream_outputs = upstream_outputs or {}

        # Run nodes concurrently if multiple start nodes
        tasks = []
        for node_def in node_defs:
            tasks.append(
                self._execute_node(execution_id, node_def, edges, input_data, db, upstream_outputs)
            )
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _execute_node(
        self,
        execution_id: str,
        node_def: dict,
        edges: List[dict],
        input_data: dict,
        db: Session,
        upstream_outputs: Dict[str, Any],
    ):
        """Execute a single node and schedule downstream nodes."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution
        from app.models.base import generate_uuid

        node_id = node_def["id"]
        node_type = node_def["type"]
        node_config = node_def.get("config", {})

        sm = _running_executions.get(execution_id)
        if not sm or sm.is_terminal:
            logger.debug("Execution %s is terminal, skipping node %s", execution_id, node_id)
            return

        # Check for pause/waiting
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

        # 3. Get executor and run
        try:
            executor = NodeRegistry.get_executor(node_type)
            context = NodeContext(
                node_id=node_id,
                node_type=node_type,
                node_config=node_config,
                input_data=input_data,
                execution_id=execution_id,
                upstream_outputs=upstream_outputs,
                db_session=db,
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

        # 4. Update node execution record
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

        # 5. Publish result
        await WorkflowEventPublisher.publish_node_status(
            execution_id, node_id, result.status.value,
            output_data=result.output_data,
            error_message=result.error_message,
            duration_ms=result.duration_ms,
        )

        # 6. Handle result status
        if result.status == NodeStatus.WAITING:
            # Human review — pause the state machine
            sm.transition(ExecutionState.WAITING)
            await WorkflowEventPublisher.publish_execution_status(
                execution_id, "waiting", node_id=node_id
            )
            return

        if result.status == NodeStatus.FAILED:
            self._fail_execution(execution_id, db, f"Node {node_id} failed: {result.error_message}")
            return

        # 7. Determine next nodes
        next_nodes = self._get_next_nodes(node_id, result, node_def, edges)
        if not next_nodes:
            # Check if all nodes are done
            self._check_completion(execution_id, db)
            return

        # 8. Merge upstream outputs
        new_upstream = dict(upstream_outputs)
        new_upstream[node_id] = result.output_data or {}

        # 9. Schedule next nodes
        await self._schedule_nodes(
            execution_id, next_nodes, edges, input_data, db, new_upstream
        )

    def _get_next_nodes(
        self,
        node_id: str,
        result: NodeResult,
        node_def: dict,
        edges: List[dict],
    ) -> List[dict]:
        """Determine the next nodes to execute based on edges and result."""
        outgoing = [e for e in edges if e.get("from") == node_id]

        if not outgoing:
            return []

        # If node has explicit next_node_ids, use those
        if result.next_node_ids:
            node_map = {n["id"]: n for n in node_def.get("_all_nodes", [])}
            return [node_map[nid] for nid in result.next_node_ids if nid in node_map]

        # For condition nodes, filter by edge condition
        if node_def.get("type") == "condition":
            condition_value = str(result.output_data.get("result", "")).lower()
            for edge in outgoing:
                edge_cond = str(edge.get("condition", "")).lower()
                if edge_cond == condition_value:
                    return self._resolve_edge_target(edge, node_def)

            # If no matching condition edge, follow unconditional edges
            unconditional = [e for e in outgoing if not e.get("condition")]
            if unconditional:
                return self._resolve_edge_target(unconditional[0], node_def)
            return []

        # Default: follow all outgoing edges
        all_nodes = node_def.get("_all_nodes", [])
        next_ids = [e["to"] for e in outgoing]
        return [n for n in all_nodes if n["id"] in next_ids]

    def _resolve_edge_target(
        self, edge: dict, current_node_def: dict
    ) -> List[dict]:
        """Resolve an edge to its target node definition(s)."""
        all_nodes = current_node_def.get("_all_nodes", [])
        target_id = edge.get("to")
        for n in all_nodes:
            if n["id"] == target_id:
                return [n]
        return []

    def _check_completion(self, execution_id: str, db: Session):
        """Check if all nodes have completed and finalize the execution."""
        from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution

        execution = db.query(WorkflowExecution).get(execution_id)
        if not execution:
            return

        # Count pending/running nodes
        pending_count = db.query(WorkflowNodeExecution).filter(
            WorkflowNodeExecution.execution_id == execution_id,
            WorkflowNodeExecution.status.in_(["pending", "running", "waiting"]),
        ).count()

        if pending_count == 0:
            # All nodes done
            sm = _running_executions.get(execution_id)
            if sm:
                sm.transition(ExecutionState.COMPLETED)

            execution.status = ExecutionState.COMPLETED.value
            execution.completed_at = datetime.utcnow().isoformat() + "Z"
            db.flush()

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
        from app.models.base import generate_uuid

        sm = _running_executions.get(execution_id)
        if not sm:
            return False

        # If waiting (human review), check if intervention is resolved
        if sm.state == ExecutionState.WAITING:
            waiting_node = db.query(WorkflowNodeExecution).filter(
                WorkflowNodeExecution.execution_id == execution_id,
                WorkflowNodeExecution.status == "waiting",
            ).first()

            if waiting_node:
                # Check if human intervention is resolved
                from app.models.human_intervention import HumanIntervention
                intervention = db.query(HumanIntervention).filter(
                    HumanIntervention.workflow_execution_id == execution_id,
                    HumanIntervention.node_id == waiting_node.node_id,
                    HumanIntervention.status.in_(["approved", "rejected"]),
                ).first()

                if not intervention:
                    return False  # Still waiting

                # Mark node as completed with decision
                waiting_node.status = "success" if intervention.decision == "approved" else "failed"
                waiting_node.output_data = json.dumps({
                    "decision": intervention.decision,
                    "comment": intervention.comment,
                })
                waiting_node.completed_at = datetime.utcnow().isoformat() + "Z"
                db.flush()

                # Transition to running and continue from this node
                sm.transition(ExecutionState.RUNNING)

                execution = db.query(WorkflowExecution).get(execution_id)
                if execution:
                    execution.status = ExecutionState.RUNNING.value
                    db.flush()

                await WorkflowEventPublisher.publish_execution_status(
                    execution_id, "running"
                )

                # Re-schedule downstream nodes
                # (simplified: need to reconstruct the workflow graph)
                return True

        if sm.state == ExecutionState.PAUSED:
            sm.transition(ExecutionState.RUNNING)

            from app.models.workflow_execution import WorkflowExecution
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


# Global singleton
workflow_engine = WorkflowEngine()

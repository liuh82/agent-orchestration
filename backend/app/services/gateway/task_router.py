"""Task router - selects Bridge and manages task lifecycle."""
from __future__ import annotations

import asyncio
import logging
import time
import uuid

from app.database import SessionLocal
from app.models.gateway import BridgeRecord
from app.models.gateway_schemas import (
    TaskRequest, TaskStatus, BridgeInfo, BridgeFilter,
)
from app.services.gateway.ws_server import WSServer
from app.services.gateway.bridge_manager import BridgeManager
from app.services.gateway.db_gateway import GatewayDB

logger = logging.getLogger(__name__)


class NoAvailableBridgeError(Exception):
    """Raised when no Bridge is available for a task."""
    pass


class TaskNotFoundError(Exception):
    """Raised when a task is not found."""
    pass


class TaskRouter:
    """Task router - selects optimal Bridge and manages task submission."""

    def __init__(
        self,
        bridge_manager: BridgeManager,
        ws_server: WSServer,
        db_gateway: GatewayDB,
    ):
        self.bridge_manager = bridge_manager
        self.ws_server = ws_server
        self.db_gateway = db_gateway

    async def select_bridge(self, task: TaskRequest) -> BridgeInfo | None:
        """Select the best available Bridge for a task.

        MVP: select Bridge with lowest active task count.
        Optionally filters by IDE preference.
        """
        candidates = self.bridge_manager.get_available_bridges()
        if not candidates:
            return None

        # Step 1: filter by IDE preference if specified
        if task.preferred_ide:
            ide_matches = [
                b for b in candidates
                if task.preferred_ide in [a.type.value for a in b.available_adapters]
            ]
            if ide_matches:
                candidates = ide_matches
            # else: fall through with all candidates

        # Step 2: select Bridge with fewest active tasks
        return min(candidates, key=lambda b: b.active_tasks)

    async def submit_task(self, task: TaskRequest) -> str:
        """Submit a task and return task_id.

        Raises NoAvailableBridgeError if no Bridge is available.
        """
        bridge = await self.select_bridge(task)
        if not bridge:
            raise NoAvailableBridgeError("No available Bridge for this task")

        task_id = self._generate_task_id()

        # Create task record in database
        self.db_gateway.create_task(task_id, task, bridge.bridge_id)

        # Send task to Bridge
        try:
            success = await self.ws_server.send_message(bridge.bridge_id, {
                'type': 'task.submit',
                'taskId': task_id,
                'prompt': task.prompt,
                'projectPath': task.project_path,
                'agentType': task.agent_type.value,
                'timeout': task.timeout,
                'priority': task.priority.value,
                'preferredIde': task.preferred_ide,
            })
            if not success:
                raise Exception(f"Failed to send task to Bridge {bridge.bridge_id}")
        except Exception as e:
            # Send failed - mark task as failed and rollback count
            self.db_gateway.update_task_status(task_id, TaskStatus.FAILED, error=str(e))
            self.bridge_manager.decrement_active_tasks(bridge.bridge_id)
            raise

        # Update Bridge load count
        self.bridge_manager.increment_active_tasks(bridge.bridge_id)

        # Schedule ack timeout check (5 seconds)
        self._schedule_ack_timeout(task_id, bridge.bridge_id, timeout=5)

        logger.info(
            f"Task submitted: {task_id} -> Bridge {bridge.bridge_id} "
            f"(agent_type={task.agent_type.value}, priority={task.priority.value})"
        )
        return task_id

    async def cancel_task(self, task_id: str, reason: str = "user_request") -> None:
        """Cancel a task."""
        task = self.db_gateway.get_task(task_id)
        if not task:
            raise TaskNotFoundError(f"Task not found: {task_id}")

        if task.status in ('completed', 'failed', 'cancelled'):
            logger.warning(f"Cannot cancel task {task_id} in status: {task.status}")
            return

        # Send cancel message to Bridge
        await self.ws_server.send_message(task.bridge_id, {
            'type': 'task.cancel',
            'taskId': task_id,
            'reason': reason,
        })

        # Update task status
        self.db_gateway.update_task_status(task_id, TaskStatus.CANCELLED)
        self.bridge_manager.decrement_active_tasks(task.bridge_id)
        logger.info(f"Task cancelled: {task_id}, reason: {reason}")

    def get_task_bridge(self, task_id: str) -> BridgeInfo | None:
        """Get the Bridge associated with a task."""
        task = self.db_gateway.get_task(task_id)
        if not task:
            return None
        return self.bridge_manager.get_bridge(task.bridge_id)

    def handle_task_ack(self, bridge_id: str, data: dict) -> None:
        """Handle task.ack message from Bridge."""
        task_id = data.get('taskId')
        if not task_id:
            return

        task = self.db_gateway.get_task(task_id)
        if not task:
            return

        now = int(time.time())
        self.db_gateway.update_task_status(
            task_id, TaskStatus.RUNNING, started_at=now
        )
        logger.info(f"Task acknowledged and running: {task_id}")

    def handle_task_progress(self, bridge_id: str, data: dict) -> None:
        """Handle task.progress message from Bridge."""
        task_id = data.get('taskId')
        progress = data.get('progress', 0)
        if not task_id:
            return

        self.db_gateway.update_task_status(
            task_id, self._get_current_status(task_id), progress=progress
        )

    def handle_task_complete(self, bridge_id: str, data: dict) -> None:
        """Handle task.complete message from Bridge."""
        task_id = data.get('taskId')
        if not task_id:
            return

        task = self.db_gateway.get_task(task_id)
        if not task:
            return

        now = int(time.time())
        success = data.get('success', False)
        duration = data.get('duration')

        # If submitted_at exists and duration doesn't, calculate it
        if not duration and task.submitted_at:
            duration = now - task.submitted_at

        if success:
            self.db_gateway.update_task_status(
                task_id,
                TaskStatus.COMPLETED,
                output=data.get('output'),
                exit_code=data.get('exitCode'),
                changed_files=data.get('changedFiles'),
                duration=duration,
                progress=100,
                completed_at=now,
            )
        else:
            self.db_gateway.update_task_status(
                task_id,
                TaskStatus.FAILED,
                error=data.get('error'),
                exit_code=data.get('exitCode'),
                duration=duration,
                completed_at=now,
            )

        self.bridge_manager.decrement_active_tasks(task.bridge_id)
        logger.info(
            f"Task completed: {task_id}, "
            f"success={success}, duration={duration}s"
        )

    async def resume_queued_tasks(self, bridge_id: str) -> None:
        """Resume queued tasks when a Bridge reconnects."""
        queued_tasks = self.db_gateway.get_queued_tasks(bridge_id)
        for task_record in queued_tasks:
            try:
                success = await self.ws_server.send_message(bridge_id, {
                    'type': 'task.submit',
                    'taskId': task_record.task_id,
                    'prompt': task_record.prompt,
                    'projectPath': task_record.project_path,
                    'agentType': task_record.agent_type,
                    'timeout': task_record.timeout,
                    'priority': task_record.priority,
                    'preferredIde': task_record.preferred_ide,
                })
                if success:
                    self.db_gateway.update_task_status(
                        task_record.task_id, TaskStatus.PENDING
                    )
                    self.bridge_manager.increment_active_tasks(bridge_id)
                    self._schedule_ack_timeout(
                        task_record.task_id, bridge_id, timeout=5
                    )
                    logger.info(f"Resumed queued task: {task_record.task_id}")
            except Exception as e:
                logger.error(
                    f"Failed to resume queued task {task_record.task_id}: {e}"
                )

    # ---- Internal helpers ----

    def _generate_task_id(self) -> str:
        """Generate unique task ID: task_{timestamp}_{short_uuid}."""
        timestamp = int(time.time())
        short_uuid = uuid.uuid4().hex[:8]
        return f"task_{timestamp}_{short_uuid}"

    def _schedule_ack_timeout(
        self, task_id: str, bridge_id: str, timeout: int = 5
    ) -> None:
        """Schedule ack timeout check.

        If Bridge doesn't acknowledge within timeout, mark task as queued
        for future recovery. Uses an independent DB session to avoid
        issues with request-scoped sessions being closed.
        """
        async def check_ack():
            await asyncio.sleep(timeout)
            try:
                with SessionLocal() as db:
                    gw_db = GatewayDB(db)
                    task = gw_db.get_task(task_id)
                    if task and task.status == 'pending':
                        gw_db.update_task_status(task_id, TaskStatus.QUEUED)
                        self.bridge_manager.decrement_active_tasks(bridge_id)
                        logger.warning(
                            f"Task ack timeout: {task_id}, marked as queued"
                        )
            except Exception as e:
                logger.error(f"Error in ack timeout check for {task_id}: {e}")

        asyncio.create_task(check_ack())

    def _get_current_status(self, task_id: str) -> str:
        """Get current status of a task without changing it."""
        task = self.db_gateway.get_task(task_id)
        return task.status if task else 'pending'

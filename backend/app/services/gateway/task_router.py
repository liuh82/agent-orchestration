"""Task router - selects Bridge and manages task lifecycle."""
from __future__ import annotations

import asyncio
import json
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
        Filters out bridges that are DB-online but WS-offline (ghost bridges).
        Optionally filters by IDE preference and backend type.
        """
        candidates = self.bridge_manager.get_available_bridges()
        if not candidates:
            return None

        # Step 0: filter out ghost bridges (DB-online but WS-disconnected)
        if self.ws_server is not None:
            live = []
            for b in candidates:
                if not self.ws_server.is_connected(b.bridge_id):
                    logger.debug(
                        f"Bridge {b.bridge_id} is DB-online but WS-offline, "
                        f"setting offline and skipping"
                    )
                    self.bridge_manager.set_bridge_offline(b.bridge_id)
                else:
                    live.append(b)
            candidates = live

        if not candidates:
            return None

        # Step 1: 按 backend 字段筛选（如果指定了后端类型）
        if hasattr(task, 'backend') and task.backend:
            backend = str(task.backend).lower()
            backend_matches = [
                b for b in candidates
                if any(a.type.value.lower() == backend for a in b.available_adapters)
            ]
            if backend_matches:
                candidates = backend_matches
                logger.debug(f"Backend filter '{backend}': {len(candidates)} bridge(s)")
            # else: fall through with all candidates

        # Step 2: filter by IDE preference if specified
        if task.preferred_ide:
            ide_matches = [
                b for b in candidates
                if task.preferred_ide in [a.type.value for a in b.available_adapters]
            ]
            if ide_matches:
                candidates = ide_matches
            # else: fall through with all candidates

        # Step 3: 按活跃任务数升序 + 任务类型亲和性
        # 任务类型亲和性: 优先选择已注册对应 agent_type 适配器的 bridge
        task_type = task.agent_type.value
        type_matches = [
            b for b in candidates
            if any(a.type.value == task_type for a in b.available_adapters)
        ]
        pool = type_matches if type_matches else candidates
        return min(pool, key=lambda b: b.active_tasks)

    async def submit_task(self, task: TaskRequest) -> str:
        """Submit a task and return task_id.

        如果任务有 depends_on，先验证依赖是否全部完成。
        未满足依赖时任务状态设为 blocked。

        Raises NoAvailableBridgeError if no Bridge is available.
        """
        task_id = self._generate_task_id()

        # 依赖验证
        if task.depends_on:
            unresolved = self._check_dependencies(task.depends_on)
            if unresolved:
                # 依赖未全部满足，设为 blocked
                self.db_gateway.create_task(task_id, task, '')
                self.db_gateway.update_task_status(
                    task_id, TaskStatus.BLOCKED, depends_on=task.depends_on
                )
                logger.info(
                    f"Task {task_id} blocked, waiting for dependencies: {unresolved}"
                )
                return task_id

        bridge = await self.select_bridge(task)
        if not bridge:
            raise NoAvailableBridgeError("No available Bridge for this task")

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
                'skipPermissions': task.skip_permissions,
                'allowedTools': task.allowed_tools,
                'sandboxMode': task.sandbox_mode,
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
        event = data.get('event')  # 解析后的 CCEvent
        if not task_id:
            return

        # 实时推送事件到内存队列供 SSE 消费
        from app.services.gateway.event_store import event_store
        if event:
            event_store.push(task_id, {
                "type": "event",
                "event": event,
                "progress": progress,
                "ts": int(time.time() * 1000),
            })

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

        # 序列化 structuredResult 为 JSON 存入 result_data
        structured_result = data.get('structuredResult')
        result_data = json.dumps(structured_result, ensure_ascii=False) if structured_result else None

        # 推送完成事件到事件队列供 SSE 消费
        from app.services.gateway.event_store import event_store
        event_store.push(task_id, {
            "type": "done",
            "success": success,
            "ts": int(time.time() * 1000),
        })

        if success:
            # 从 structuredResult 提取费用
            cost_usd = 0.0
            if structured_result and isinstance(structured_result, dict):
                cost_usd = float(structured_result.get('costUsd', 0))

            update_kwargs = {
                'output': data.get('output'),
                'exit_code': data.get('exitCode'),
                'changed_files': data.get('changedFiles'),
                'duration': duration,
                'progress': 100,
                'completed_at': now,
                'result_data': result_data,
                'cost_usd': cost_usd,
            }

            # sandbox 模式: 保存 patch
            sandbox_patch = data.get('sandboxPatch')
            if sandbox_patch:
                update_kwargs['sandbox_patch'] = sandbox_patch

            self.db_gateway.update_task_status(
                task_id, TaskStatus.COMPLETED, **update_kwargs,
            )
        else:
            # 保存 partial_result 便于断点续传
            self.db_gateway.update_task_status(
                task_id,
                TaskStatus.FAILED,
                error=data.get('error'),
                exit_code=data.get('exitCode'),
                duration=duration,
                completed_at=now,
                result_data=result_data,
                partial_result=data.get('partial_result'),
            )

        self.bridge_manager.decrement_active_tasks(task.bridge_id)
        logger.info(
            f"Task completed: {task_id}, "
            f"success={success}, duration={duration}s"
        )

        # 任务完成后，自动解除被此任务阻塞的下游任务
        if success:
            asyncio.create_task(self._unblock_dependent_tasks(task_id))

        # 失败时自动重试（指数退避，切换 bridge）
        if not success and task.max_retries > 0 and task.retry_count < task.max_retries:
            asyncio.create_task(self._retry_task(task, task_id))

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
                    'sandboxMode': bool(task_record.sandbox_mode),
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

    async def resume_task(self, task_id: str, prompt: str | None = None, timeout: int | None = None) -> str:
        """断点续传 — 从原任务上下文恢复执行。

        创建新任务，引用原任务的 partial_result 作为上下文。
        """
        original = self.db_gateway.get_task(task_id)
        if not original:
            raise TaskNotFoundError(f"Original task not found: {task_id}")

        # 构建续传 prompt: 附加原任务的部分输出作为上下文
        context = ""
        if original.partial_result:
            context = f"\n\n--- 以下是上次执行的中间结果，请在此基础上继续 ---\n{original.partial_result}"
        elif original.output:
            context = f"\n\n--- 以下是上次执行的输出，请在此基础上继续 ---\n{original.output}"

        new_prompt = prompt or (original.prompt + context)

        # 构建新的 TaskRequest
        from app.models.gateway_schemas import TaskRequest
        task = TaskRequest(
            prompt=new_prompt,
            project_path=original.project_path,
            agent_type=original.agent_type,
            timeout=timeout or original.timeout,
            priority=original.priority,
            skip_permissions=False,
            source="resume",
        )

        bridge = await self.select_bridge(task)
        if not bridge:
            raise NoAvailableBridgeError("No available Bridge for this task")

        new_task_id = self._generate_task_id()
        self.db_gateway.create_task(new_task_id, task, bridge.bridge_id)

        # 记录父任务 ID
        self.db_gateway.update_task_status(
            new_task_id, TaskStatus.PENDING, parent_task_id=task_id
        )

        try:
            success = await self.ws_server.send_message(bridge.bridge_id, {
                'type': 'task.submit',
                'taskId': new_task_id,
                'prompt': task.prompt,
                'projectPath': task.project_path,
                'agentType': task.agent_type.value,
                'timeout': task.timeout,
                'priority': task.priority.value,
                'preferredIde': task.preferred_ide,
                'skipPermissions': task.skip_permissions,
                'allowedTools': task.allowed_tools,
                'sandboxMode': task.sandbox_mode,
            })
            if not success:
                raise Exception(f"Failed to send task to Bridge {bridge.bridge_id}")
        except Exception as e:
            self.db_gateway.update_task_status(new_task_id, TaskStatus.FAILED, error=str(e))
            self.bridge_manager.decrement_active_tasks(bridge.bridge_id)
            raise

        self.bridge_manager.increment_active_tasks(bridge.bridge_id)
        self._schedule_ack_timeout(new_task_id, bridge.bridge_id, timeout=5)

        logger.info(
            f"Task resumed: {task_id} -> {new_task_id} "
            f"(bridge={bridge.bridge_id}, context_len={len(context)})"
        )
        return new_task_id

    async def _retry_task(self, original_task, original_task_id: str) -> None:
        """失败时自动重试 — 指数退避，切换 bridge。

        等待 2^retry_count 秒后重新提交，尝试选择不同的 bridge。
        """
        retry_count = (original_task.retry_count or 0) + 1
        backoff = 2 ** retry_count  # 2, 4, 8, 16, 32 秒

        logger.info(
            f"Scheduling retry {retry_count}/{original_task.max_retries} "
            f"for task {original_task_id} in {backoff}s"
        )

        await asyncio.sleep(backoff)

        try:
            with SessionLocal() as db:
                gw_db = GatewayDB(db)
                # 确认任务仍然处于失败状态（可能已被手动取消）
                current = gw_db.get_task(original_task_id)
                if not current or current.status != 'failed':
                    logger.info(f"Task {original_task_id} no longer failed, skipping retry")
                    return

                from app.models.gateway_schemas import TaskRequest
                task = TaskRequest(
                    prompt=original_task.prompt,
                    project_path=original_task.project_path,
                    agent_type=original_task.agent_type,
                    timeout=original_task.timeout,
                    priority=original_task.priority,
                    preferred_ide=original_task.preferred_ide,
                    skip_permissions=original_task.skip_permissions if hasattr(original_task, 'skip_permissions') else False,
                    source='retry',
                    max_retries=original_task.max_retries,
                )

                # 更新重试计数
                gw_db.update_task_status(
                    original_task_id, TaskStatus.PENDING, retry_count=retry_count
                )

                tr = TaskRouter(self.bridge_manager, self.ws_server, gw_db)
                # 重新路由到新 bridge（select_bridge 会选择负载最低的）
                new_task_id = tr._generate_task_id()
                bridge = await tr.select_bridge(task)
                if not bridge:
                    logger.warning(f"Retry failed for {original_task_id}: no bridge available")
                    return

                gw_db.create_task(new_task_id, task, bridge.bridge_id)
                gw_db.update_task_status(
                    new_task_id, TaskStatus.PENDING,
                    parent_task_id=original_task_id,
                    retry_count=retry_count,
                )

                success = await self.ws_server.send_message(bridge.bridge_id, {
                    'type': 'task.submit',
                    'taskId': new_task_id,
                    'prompt': task.prompt,
                    'projectPath': task.project_path,
                    'agentType': task.agent_type.value,
                    'timeout': task.timeout,
                    'priority': task.priority.value,
                    'preferredIde': task.preferred_ide,
                    'skipPermissions': task.skip_permissions,
                    'allowedTools': task.allowed_tools,
                    'sandboxMode': task.sandbox_mode,
                })
                if success:
                    self.bridge_manager.increment_active_tasks(bridge.bridge_id)
                    tr._schedule_ack_timeout(new_task_id, bridge.bridge_id, timeout=5)
                    logger.info(
                        f"Retry {retry_count} submitted: {original_task_id} -> {new_task_id} "
                        f"(bridge={bridge.bridge_id})"
                    )
                    # 标记原始任务为 cancelled（被重试任务替代）
                    gw_db.update_task_status(
                        original_task_id, TaskStatus.CANCELLED,
                        error=f"Retried as {new_task_id} (attempt {retry_count})"
                    )
        except Exception as e:
            logger.error(f"Retry failed for {original_task_id}: {e}")

    def _check_dependencies(self, depends_on: list[str]) -> list[str]:
        """检查依赖列表，返回未完成的 task_id 列表。"""
        unresolved = []
        for dep_id in depends_on:
            dep = self.db_gateway.get_task(dep_id)
            if not dep or dep.status != 'completed':
                unresolved.append(dep_id)
        return unresolved

    async def _unblock_dependent_tasks(self, completed_task_id: str) -> None:
        """当一个任务完成时，检查是否有被它阻塞的下游任务可以执行。"""
        try:
            # 使用独立 DB session 查找被阻塞的任务
            with SessionLocal() as db:
                gw_db = GatewayDB(db)
                from sqlalchemy import select
                from app.models.gateway import TaskRecord

                # 简单方式: 查找所有 blocked 状态的任务
                stmt = select(TaskRecord).where(TaskRecord.status == 'blocked')
                results = list(db.execute(stmt).scalars().all())

                for blocked in results:
                    depends = blocked.depends_on or []
                    if completed_task_id in depends:
                        # 重新检查所有依赖
                        still_blocked = []
                        for dep_id in depends:
                            dep = gw_db.get_task(dep_id)
                            if not dep or dep.status != 'completed':
                                still_blocked.append(dep_id)

                        if not still_blocked:
                            # 所有依赖已满足，尝试路由
                            logger.info(f"Unblocking task {blocked.task_id} (all dependencies met)")
                            try:
                                tr = TaskRouter(
                                    self.bridge_manager, self.ws_server, gw_db
                                )
                                new_req = TaskRequest(
                                    prompt=blocked.prompt,
                                    project_path=blocked.project_path,
                                    agent_type=blocked.agent_type,
                                    timeout=blocked.timeout,
                                    priority=blocked.priority,
                                    preferred_ide=blocked.preferred_ide,
                                    skip_permissions=False,
                                    source=blocked.source,
                                    depends_on=blocked.depends_on,
                                )
                                new_task_id = tr._generate_task_id()
                                bridge = await tr.select_bridge(new_req)
                                if bridge:
                                    gw_db.update_task_status(
                                        blocked.task_id, TaskStatus.FAILED,
                                        error="Replaced by auto-routed task"
                                    )
                                    await tr.submit_task(new_req)
                                    logger.info(f"Auto-routed unblocked task: {new_task_id}")
                                else:
                                    logger.warning(
                                        f"No bridge available for unblocked task {blocked.task_id}"
                                    )
                            except Exception as e:
                                logger.error(f"Failed to route unblocked task {blocked.task_id}: {e}")
                        else:
                            logger.debug(
                                f"Task {blocked.task_id} still blocked on: {still_blocked}"
                            )
        except Exception as e:
            logger.error(f"Error in _unblock_dependent_tasks: {e}")

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

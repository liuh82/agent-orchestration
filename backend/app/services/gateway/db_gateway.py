"""Gateway data access layer using SQLAlchemy 2.0 ORM."""
from __future__ import annotations

import time
import logging
from typing import Optional, List, Tuple

from sqlalchemy import select, and_, desc, asc, func
from sqlalchemy.orm import Session

from app.models.gateway import BridgeRecord, TaskRecord
from app.models.gateway_schemas import BridgeInfo, TaskRequest, TaskStatus, BridgeFilter

logger = logging.getLogger(__name__)


class GatewayDB:
    """Gateway data access layer."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Bridge operations ----

    def create_bridge(self, bridge_info: BridgeInfo) -> BridgeRecord:
        """Create or update Bridge record."""
        record = self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_info.bridge_id)
        ).scalar_one_or_none()

        if record:
            record.status = bridge_info.status.value
            record.last_seen = bridge_info.last_seen
            record.available_adapters = [
                a.model_dump() for a in bridge_info.available_adapters
            ]
            record.active_tasks = bridge_info.active_tasks
            record.max_concurrent = bridge_info.max_concurrent
            if bridge_info.os_version:
                record.os_version = bridge_info.os_version
            if bridge_info.node_version:
                record.node_version = bridge_info.node_version
            if bridge_info.bridge_version:
                record.bridge_version = bridge_info.bridge_version
        else:
            record = BridgeRecord(
                bridge_id=bridge_info.bridge_id,
                platform=bridge_info.platform,
                hostname=bridge_info.hostname,
                os_version=bridge_info.os_version,
                node_version=bridge_info.node_version,
                bridge_version=bridge_info.bridge_version,
                status=bridge_info.status.value,
                last_seen=bridge_info.last_seen,
                available_adapters=[
                    a.model_dump() for a in bridge_info.available_adapters
                ],
                active_tasks=bridge_info.active_tasks,
                max_concurrent=bridge_info.max_concurrent,
            )
            self.db.add(record)

        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to commit bridge record: {e}")
            raise

        try:
            self.db.refresh(record)
        except Exception as e:
            logger.warning(f"Failed to refresh bridge after commit: {e}")
            # Data is already committed, re-query if possible
            try:
                record = self.get_bridge(bridge_info.bridge_id)
            except Exception as re_err:
                logger.warning(f"Failed to re-query bridge after refresh failure: {re_err}")

        return record

    def get_bridge(self, bridge_id: str) -> BridgeRecord | None:
        """Get Bridge record by bridge_id."""
        return self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_id)
        ).scalar_one_or_none()

    def get_all_bridges(self, filters: BridgeFilter | None = None) -> list[BridgeRecord]:
        """Get all Bridge records with optional filtering."""
        query = select(BridgeRecord)

        if filters:
            if filters.status:
                query = query.where(BridgeRecord.status == filters.status.value)
            if filters.platform:
                query = query.where(BridgeRecord.platform == filters.platform)
            if filters.min_active_tasks is not None:
                query = query.where(BridgeRecord.active_tasks < filters.min_active_tasks)

        return list(self.db.execute(query).scalars().all())

    def update_bridge_status(self, bridge_id: str, status: str) -> None:
        """Update Bridge status."""
        record = self.get_bridge(bridge_id)
        if record:
            record.status = status
            record.last_seen = int(time.time())
            self.db.commit()

    def increment_active_tasks(self, bridge_id: str) -> bool:
        """Increment Bridge active task count. Returns False if at capacity."""
        record = self.get_bridge(bridge_id)
        if not record:
            return False
        if record.active_tasks >= record.max_concurrent:
            return False
        record.active_tasks += 1
        self.db.commit()
        return True

    def decrement_active_tasks(self, bridge_id: str) -> None:
        """Decrement Bridge active task count."""
        record = self.get_bridge(bridge_id)
        if record and record.active_tasks > 0:
            record.active_tasks -= 1
            self.db.commit()

    # ---- Task operations ----

    def create_task(
        self, task_id: str, task: TaskRequest, bridge_id: str
    ) -> TaskRecord:
        """Create task record."""
        record = TaskRecord(
            task_id=task_id,
            bridge_id=bridge_id,
            prompt=task.prompt,
            project_path=task.project_path,
            agent_type=task.agent_type.value,
            timeout=task.timeout,
            priority=task.priority.value,
            preferred_ide=task.preferred_ide,
            source=task.source,
            callback_id=task.callback_id,
            status='pending',
            submitted_at=int(time.time()),
            sandbox_mode=int(task.sandbox_mode) if task.sandbox_mode else 0,
        )
        self.db.add(record)
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to commit task record: {e}")
            raise

        try:
            self.db.refresh(record)
        except Exception as e:
            logger.warning(f"Failed to refresh task after commit: {e}")
            try:
                record = self.get_task(task_id)
            except Exception as re_err:
                logger.warning(f"Failed to re-query task after refresh failure: {re_err}")

        return record

    def get_task(self, task_id: str) -> TaskRecord | None:
        """Get task record by task_id."""
        return self.db.execute(
            select(TaskRecord).where(TaskRecord.task_id == task_id)
        ).scalar_one_or_none()

    def update_task_status(
        self, task_id: str, status: TaskStatus | str, **kwargs
    ) -> None:
        """Update task status and optional fields."""
        record = self.get_task(task_id)
        if record:
            if isinstance(status, TaskStatus):
                record.status = status.value
            else:
                record.status = status
            for key, value in kwargs.items():
                if hasattr(record, key):
                    setattr(record, key, value)
            self.db.commit()

    def list_tasks(
        self,
        status: TaskStatus | str | None = None,
        bridge_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "submitted_at",
        sort_order: str = "desc",
    ) -> tuple[list[TaskRecord], int]:
        """Query tasks with filtering and pagination."""
        query = select(TaskRecord)

        if status:
            status_val = status.value if isinstance(status, TaskStatus) else status
            query = query.where(TaskRecord.status == status_val)
        if bridge_id:
            query = query.where(TaskRecord.bridge_id == bridge_id)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = self.db.execute(count_query).scalar() or 0

        # Sort
        order_col = getattr(TaskRecord, sort_by, TaskRecord.submitted_at)
        query = query.order_by(
            desc(order_col) if sort_order == "desc" else asc(order_col)
        )

        # Paginate
        query = query.offset(offset).limit(limit)

        tasks = list(self.db.execute(query).scalars().all())
        return tasks, total

    def get_queued_tasks(self, bridge_id: str) -> list[TaskRecord]:
        """Get queued tasks for a Bridge (used for reconnection recovery)."""
        return list(self.db.execute(
            select(TaskRecord).where(
                and_(
                    TaskRecord.bridge_id == bridge_id,
                    TaskRecord.status == 'queued',
                )
            )
        ).scalars().all())

    def get_running_tasks(self, bridge_id: str) -> list[TaskRecord]:
        """Get running tasks for a Bridge (used for reconnection recovery)."""
        return list(self.db.execute(
            select(TaskRecord).where(
                and_(
                    TaskRecord.bridge_id == bridge_id,
                    TaskRecord.status == 'running',
                )
            )
        ).scalars().all())

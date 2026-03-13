from datetime import datetime
from typing import List, Optional
from uuid import uuid4
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import Session

from ..models.heartbeat import Heartbeat, HeartbeatCreate, HeartbeatUpdate
from ..models.heartbeat_log import HeartbeatLog, HeartbeatLogCreate, HeartbeatLogStatus
from ..models.orm_models import Heartbeat as HeartbeatORM, HeartbeatLog as HeartbeatLogORM

# 允许更新的字段白名单
HEARTBEAT_UPDATE_FIELDS = {
    "name", "description", "action_type", "action_params",
    "interval_seconds", "is_active", "last_run_at", "next_run_at"
}

HEARTBEAT_LOG_UPDATE_FIELDS = {
    "status", "result", "error_message", "completed_at"
}


class HeartbeatService:
    """Heartbeat service for CRUD operations"""

    def __init__(self, db: Session):
        self.db = db

    def _row_to_heartbeat(self, heartbeat_orm) -> Heartbeat:
        """Convert ORM object to Heartbeat model"""
        return Heartbeat(
            id=heartbeat_orm.id,
            name=heartbeat_orm.name,
            description=heartbeat_orm.description,
            action_type=heartbeat_orm.action_type,
            action_params=heartbeat_orm.action_params,
            interval_seconds=heartbeat_orm.interval_seconds,
            is_active=heartbeat_orm.is_active,
            last_run_at=heartbeat_orm.last_run_at,
            next_run_at=heartbeat_orm.next_run_at,
            created_at=datetime.fromisoformat(heartbeat_orm.created_at),
            updated_at=datetime.fromisoformat(heartbeat_orm.updated_at)
        )

    def _row_to_log(self, log_orm) -> HeartbeatLog:
        """Convert ORM object to HeartbeatLog model"""
        return HeartbeatLog(
            id=log_orm.id,
            heartbeat_id=log_orm.heartbeat_id,
            status=HeartbeatLogStatus(log_orm.status),
            result=log_orm.result,
            error_message=log_orm.error_message,
            started_at=datetime.fromisoformat(log_orm.started_at),
            completed_at=datetime.fromisoformat(log_orm.completed_at) if log_orm.completed_at else None
        )

    async def get_all_heartbeats(self) -> List[Heartbeat]:
        """Get all heartbeats"""
        result = self.db.execute(
            select(HeartbeatORM).order_by(HeartbeatORM.created_at.desc())
        )
        heartbeat_orms = result.scalars().all()
        return [self._row_to_heartbeat(h) for h in heartbeat_orms]

    async def get_active_heartbeats(self) -> List[Heartbeat]:
        """Get active heartbeats"""
        result = self.db.execute(
            select(HeartbeatORM)
            .where(HeartbeatORM.is_active == True)
            .order_by(HeartbeatORM.created_at.desc())
        )
        heartbeat_orms = result.scalars().all()
        return [self._row_to_heartbeat(h) for h in heartbeat_orms]

    async def get_heartbeat(self, heartbeat_id: str) -> Optional[Heartbeat]:
        """Get single heartbeat by ID"""
        result = self.db.execute(
            select(HeartbeatORM).where(HeartbeatORM.id == heartbeat_id)
        )
        heartbeat_orm = result.scalar_one_or_none()
        if not heartbeat_orm:
            return None
        return self._row_to_heartbeat(heartbeat_orm)

    async def create_heartbeat(self, data: HeartbeatCreate) -> Heartbeat:
        """Create new heartbeat"""
        heartbeat_id = str(uuid4())
        now = datetime.now()
        next_run = now

        heartbeat_orm = HeartbeatORM(
            id=heartbeat_id,
            name=data.name,
            description=data.description,
            action_type=data.action_type,
            action_params=data.action_params,
            interval_seconds=data.interval_seconds,
            is_active=data.is_active,
            last_run_at=None,
            next_run_at=next_run.isoformat(),
            created_at=now.isoformat(),
            updated_at=now.isoformat()
        )

        self.db.add(heartbeat_orm)
        self.db.commit()
        self.db.refresh(heartbeat_orm)

        return self._row_to_heartbeat(heartbeat_orm)

    async def update_heartbeat(
        self, heartbeat_id: str, data: HeartbeatUpdate
    ) -> Optional[Heartbeat]:
        """Update heartbeat with field whitelist for SQL injection prevention"""
        heartbeat = await self.get_heartbeat(heartbeat_id)
        if not heartbeat:
            return None

        # Get the ORM object
        result = self.db.execute(
            select(HeartbeatORM).where(HeartbeatORM.id == heartbeat_id)
        )
        heartbeat_orm = result.scalar_one_or_none()

        if not heartbeat_orm:
            return None

        updated_at = datetime.now()

        # Update fields safely using whitelist
        if data.name is not None:
            heartbeat_orm.name = data.name
        if data.description is not None:
            heartbeat_orm.description = data.description
        if data.action_type is not None:
            heartbeat_orm.action_type = data.action_type
        if data.action_params is not None:
            heartbeat_orm.action_params = data.action_params
        if data.interval_seconds is not None:
            heartbeat_orm.interval_seconds = data.interval_seconds
        if data.is_active is not None:
            heartbeat_orm.is_active = data.is_active

        heartbeat_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(heartbeat_orm)

        return self._row_to_heartbeat(heartbeat_orm)

    async def delete_heartbeat(self, heartbeat_id: str) -> bool:
        """Delete heartbeat"""
        result = self.db.execute(
            select(HeartbeatORM).where(HeartbeatORM.id == heartbeat_id)
        )
        heartbeat_orm = result.scalar_one_or_none()

        if not heartbeat_orm:
            return False

        self.db.delete(heartbeat_orm)
        self.db.commit()

        return True

    async def update_run_times(
        self, heartbeat_id: str, last_run: datetime, next_run: datetime
    ) -> bool:
        """Update last_run_at and next_run_at"""
        result = self.db.execute(
            update(HeartbeatORM)
            .where(HeartbeatORM.id == heartbeat_id)
            .values(
                last_run_at=last_run.isoformat(),
                next_run_at=next_run.isoformat(),
                updated_at=datetime.now().isoformat()
            )
        )
        self.db.commit()
        return result.rowcount > 0

    async def create_log(self, data: HeartbeatLogCreate) -> HeartbeatLog:
        """Create heartbeat log entry"""
        log_id = str(uuid4())
        now = datetime.now()

        log_orm = HeartbeatLogORM(
            id=log_id,
            heartbeat_id=data.heartbeat_id,
            status=data.status.value,
            result=data.result,
            error_message=data.error_message,
            started_at=now.isoformat(),
            completed_at=data.completed_at.isoformat() if data.completed_at else None
        )

        self.db.add(log_orm)
        self.db.commit()
        self.db.refresh(log_orm)

        return self._row_to_log(log_orm)

    async def get_log(self, log_id: str) -> Optional[HeartbeatLog]:
        """Get single log by ID"""
        result = self.db.execute(
            select(HeartbeatLogORM).where(HeartbeatLogORM.id == log_id)
        )
        log_orm = result.scalar_one_or_none()
        if not log_orm:
            return None
        return self._row_to_log(log_orm)

    async def get_logs_by_heartbeat(self, heartbeat_id: str, limit: int = 50) -> List[HeartbeatLog]:
        """Get logs for a heartbeat"""
        result = self.db.execute(
            select(HeartbeatLogORM)
            .where(HeartbeatLogORM.heartbeat_id == heartbeat_id)
            .order_by(HeartbeatLogORM.started_at.desc())
            .limit(limit)
        )
        log_orms = result.scalars().all()
        return [self._row_to_log(l) for l in log_orms]

    async def update_log(
        self, log_id: str, status: HeartbeatLogStatus,
        result: Optional[dict] = None, error_message: Optional[str] = None,
        completed_at: Optional[datetime] = None
    ) -> Optional[HeartbeatLog]:
        """Update heartbeat log with field whitelist for SQL injection prevention"""
        # Get the ORM object
        result = self.db.execute(
            select(HeartbeatLogORM).where(HeartbeatLogORM.id == log_id)
        )
        log_orm = result.scalar_one_or_none()

        if not log_orm:
            return None

        # Update fields safely
        if result is not None:
            log_orm.result = result
        if error_message is not None:
            log_orm.error_message = error_message
        if completed_at is not None:
            log_orm.completed_at = completed_at.isoformat()

        log_orm.status = status.value

        self.db.commit()
        self.db.refresh(log_orm)

        return self._row_to_log(log_orm)

    async def get_stats(self) -> dict:
        """Get heartbeat statistics"""
        # Get heartbeat stats
        count_query = select(
            func.count(HeartbeatORM.id).label('total'),
            func.sum(func.case([(HeartbeatORM.is_active == True, 1)], else_=0)).label('active'),
            func.sum(func.case([(HeartbeatORM.is_active == False, 1)], else_=0)).label('inactive')
        )
        count_result = self.db.execute(count_query).one()

        # Get failed logs from last 24 hours
        from datetime import timedelta
        time_ago = datetime.now() - timedelta(hours=24)

        failed_query = select(func.count(HeartbeatLogORM.id)).where(
            and_(
                HeartbeatLogORM.status == 'failed',
                HeartbeatLogORM.started_at >= time_ago.isoformat()
            )
        )
        failed_result = self.db.execute(failed_query).scalar()

        return {
            "total": count_result.total or 0,
            "active": count_result.active or 0,
            "inactive": count_result.inactive or 0,
            "failed_24h": failed_result or 0,
        }

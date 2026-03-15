from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import Session
from app.models.orm_models import Agent as AgentORM, AgentLog, TaskAssignment
from app.models.agent_legacy import AgentCreate, AgentUpdate, Agent, AgentStats
from app.models.log import LogCreate


class AgentService:
    def __init__(self, db: Session = None):
        # Database connection - handled by dependency injection or passed directly
        self.db = db

    def _orm_to_model(self, agent_orm) -> Agent:
        """Convert ORM Agent to Pydantic Agent model"""
        skills = agent_orm.skills.split(',') if agent_orm.skills else []
        capabilities = agent_orm.capabilities.split(',') if agent_orm.capabilities else []
        return Agent(
            id=agent_orm.id,
            name=agent_orm.name,
            type=agent_orm.type,
            status=agent_orm.status,
            model=agent_orm.model,
            timeout=agent_orm.timeout,
            skills=skills,
            capabilities=capabilities,
            created_at=datetime.fromisoformat(agent_orm.created_at) if agent_orm.created_at else datetime.now(),
            updated_at=datetime.fromisoformat(agent_orm.updated_at) if agent_orm.updated_at else datetime.now(),
            last_seen=datetime.fromisoformat(agent_orm.last_seen) if agent_orm.last_seen else None,
            task_count=agent_orm.task_count,
            completed_tasks=agent_orm.completed_tasks,
            failed_tasks=agent_orm.failed_tasks,
            total_tokens_used=agent_orm.total_tokens_used,
            total_cost=agent_orm.total_cost,
            avg_response_time=agent_orm.avg_response_time,
            avg_task_duration=agent_orm.avg_task_duration
        )

    async def get_all_agents(self, db: Session) -> List[Agent]:
        """获取所有 Agent"""
        result = db.execute(select(AgentORM).order_by(AgentORM.created_at.desc()))
        agent_orms = result.scalars().all()
        return [self._orm_to_model(a) for a in agent_orms]

    async def get_agent(self, db: Session, agent_id: str) -> Optional[Agent]:
        """获取单个 Agent"""
        result = db.execute(select(AgentORM).where(AgentORM.id == agent_id))
        agent_orm = result.scalar_one_or_none()
        if not agent_orm:
            return None
        return self._orm_to_model(agent_orm)

    async def create_agent(self, db: Session, agent: AgentCreate) -> Agent:
        """创建新 Agent"""
        agent_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        db_agent = AgentORM(
            id=agent_id,
            name=agent.name,
            type=agent.type,
            status='offline',
            model=agent.model,
            timeout=agent.timeout,
            skills=','.join(agent.skills) if agent.skills else None,
            capabilities=','.join(agent.capabilities) if agent.capabilities else None,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        db.add(db_agent)
        db.commit()
        db.refresh(db_agent)

        return self._orm_to_model(db_agent)

    async def start_agent(self, db: Session, agent_id: str) -> Optional[Agent]:
        """启动 Agent"""
        result = db.execute(
            update(AgentORM)
            .where(AgentORM.id == agent_id)
            .values(
                status='running',
                last_seen=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            )
        )
        db.commit()

        # Log agent start
        await self._log_agent_event(db, agent_id, 'info', 'Agent started')

        return await self.get_agent(db, agent_id)

    async def stop_agent(self, db: Session, agent_id: str) -> Optional[Agent]:
        """停止 Agent"""
        result = db.execute(
            update(AgentORM)
            .where(AgentORM.id == agent_id)
            .values(
                status='offline',
                updated_at=datetime.now().isoformat()
            )
        )
        db.commit()

        # Log agent stop
        await self._log_agent_event(db, agent_id, 'info', 'Agent stopped')

        return await self.get_agent(db, agent_id)

    async def get_agent_stats(self, db: Session, agent_id: str) -> Optional[AgentStats]:
        """获取 Agent 统计信息"""
        agent = await self.get_agent(db, agent_id)
        if not agent:
            return None

        # Calculate uptime percentage (mock data for demo)
        uptime_percentage = 95.0 if agent.status == 'running' else 0.0

        # Calculate success rate
        success_rate = 0.0
        if agent.task_count > 0:
            success_rate = agent.completed_tasks / agent.task_count

        stats = AgentStats(
            id=agent.id,
            name=agent.name,
            status=agent.status,
            current_tasks=agent.task_count,  # Mock current tasks
            task_count=agent.task_count,
            completed_tasks=agent.completed_tasks,
            failed_tasks=agent.failed_tasks,
            success_rate=success_rate,
            total_tokens_used=agent.total_tokens_used,
            total_cost=agent.total_cost,
            avg_response_time=agent.avg_response_time,
            avg_task_duration=agent.avg_task_duration,
            uptime_percentage=uptime_percentage
        )

        return stats

    async def get_agent_logs(self, db: Session, agent_id: str, page: int = 1, page_size: int = 50,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None,
                           level: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取 Agent 日志"""
        query = select(AgentLog).where(AgentLog.agent_id == agent_id)
        params = []

        if start_time:
            query = query.where(AgentLog.created_at >= start_time.isoformat())
        if end_time:
            query = query.where(AgentLog.created_at <= end_time.isoformat())
        if level:
            query = query.where(AgentLog.level == level)

        query = query.order_by(AgentLog.created_at.desc())

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = db.execute(query)
        logs = result.scalars().all()

        return [
            {
                'id': log.id,
                'level': log.level,
                'message': log.message,
                'metadata': log.metadata_ if log.metadata_ else {},
                'timestamp': datetime.fromisoformat(log.created_at),
                'created_at': datetime.fromisoformat(log.created_at)
            }
            for log in logs
        ]

    async def assign_task(self, db: Session, task_id: str, agent_id: str) -> bool:
        """分配任务给 Agent"""
        # Check if agent exists and is running
        agent = await self.get_agent(db, agent_id)
        if not agent or agent.status != 'running':
            return False

        # Create task assignment record
        assignment_id = str(uuid4())
        start_time = datetime.now()

        db_assignment = TaskAssignment(
            id=assignment_id,
            task_id=task_id,
            agent_id=agent_id,
            assigned_at=start_time.isoformat(),
            status='running'
        )
        db.add(db_assignment)

        # Update agent task count
        db.execute(
            update(AgentORM)
            .where(AgentORM.id == agent_id)
            .values(task_count=AgentORM.task_count + 1)
        )

        db.commit()

        # Log the assignment
        await self._log_agent_event(db, agent_id, 'info', f'Task {task_id} assigned')

        return True

    async def _log_agent_event(self, db: Session, agent_id: str, level: str, message: str, metadata: Optional[Dict] = None):
        """记录 Agent 事件"""
        log_id = str(uuid4())
        timestamp = datetime.now()

        db_log = AgentLog(
            id=log_id,
            agent_id=agent_id,
            level=level,
            message=message,
            metadata_=str(metadata) if metadata else None,
            created_at=timestamp.isoformat()
        )
        db.add(db_log)
        db.commit()

    async def update_agent_stats(self, db: Session, agent_id: str, task_duration: float,
                               response_time: float, tokens_used: int,
                               success: bool, cost: float = 0.0):
        """更新 Agent 统计信息"""
        # Update task counts
        if success:
            db.execute(
                update(AgentORM)
                .where(AgentORM.id == agent_id)
                .values(completed_tasks=AgentORM.completed_tasks + 1)
            )
        else:
            db.execute(
                update(AgentORM)
                .where(AgentORM.id == agent_id)
                .values(failed_tasks=AgentORM.failed_tasks + 1)
            )

        # Update stats (weighted average for demo)
        db.execute(
            update(AgentORM)
            .where(AgentORM.id == agent_id)
            .values(
                avg_response_time=func.case(
                    (AgentORM.avg_response_time == 0.0, response_time),
                    else_=func.round(AgentORM.avg_response_time * 0.9 + response_time * 0.1, 2)
                ),
                avg_task_duration=func.case(
                    (AgentORM.avg_task_duration == 0.0, task_duration),
                    else_=func.round(AgentORM.avg_task_duration * 0.9 + task_duration * 0.1, 2)
                ),
                total_tokens_used=AgentORM.total_tokens_used + tokens_used,
                total_cost=AgentORM.total_cost + cost,
                updated_at=datetime.now().isoformat()
            )
        )
        db.commit()

    async def update_agent(self, db: Session, agent_id: str, agent: AgentUpdate) -> Optional[Agent]:
        """更新 Agent"""
        existing_agent = await self.get_agent(db, agent_id)
        if not existing_agent:
            return None

        updated_at = datetime.now()

        db.execute(
            update(AgentORM)
            .where(AgentORM.id == agent_id)
            .values(
                name=agent.name,
                type=agent.type,
                status=agent.status,
                model=agent.model,
                timeout=agent.timeout,
                skills=','.join(agent.skills) if agent.skills else None,
                capabilities=','.join(agent.capabilities) if agent.capabilities else None,
                updated_at=updated_at.isoformat()
            )
        )
        db.commit()

        return await self.get_agent(db, agent_id)

    async def delete_agent(self, db: Session, agent_id: str) -> bool:
        """删除 Agent"""
        result = db.execute(delete(AgentORM).where(AgentORM.id == agent_id))
        db.commit()
        return result.rowcount > 0
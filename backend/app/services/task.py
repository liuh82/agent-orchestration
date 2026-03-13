from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session

from ..models.task import TaskCreate, TaskUpdate, Task
from ..models.orm_models import Task, TaskAssignment
from ..services.agent_service import AgentService


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.agent_service = AgentService(db)

    def get_all_tasks(self) -> List[Task]:
        """获取所有任务"""
        result = self.db.execute(
            select(Task).order_by(Task.created_at.desc())
        )
        task_orms = result.scalars().all()

        tasks = []
        for task_orm in task_orms:
            task = Task(
                id=task_orm.id,
                title=task_orm.title,
                description=task_orm.description,
                status=task_orm.status,
                priority=task_orm.priority,
                assigned_to=task_orm.assignee_id,
                created_by="system",  # TODO: Get from member_id
                created_at=datetime.fromisoformat(task_orm.created_at),
                updated_at=datetime.fromisoformat(task_orm.updated_at),
                completed_at=datetime.fromisoformat(task_orm.completed_at) if task_orm.completed_at else None,
                workflow_id=None,  # TODO: Map from workflow_id
                input=task_orm.action_params or {},
                output=task_orm.result or {},
                logs=[]
            )
            tasks.append(task)

        return tasks

    def get_task(self, task_id: str) -> Optional[Task]:
        """获取单个任务"""
        result = self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        task_orm = result.scalar_one_or_none()

        if not task_orm:
            return None

        return Task(
            id=task_orm.id,
            title=task_orm.title,
            description=task_orm.description,
            status=task_orm.status,
            priority=task_orm.priority,
            assigned_to=task_orm.assignee_id,
            created_by="system",  # TODO: Get from member_id
            created_at=datetime.fromisoformat(task_orm.created_at),
            updated_at=datetime.fromisoformat(task_orm.updated_at),
            completed_at=datetime.fromisoformat(task_orm.completed_at) if task_orm.completed_at else None,
            workflow_id=None,  # TODO: Map from workflow_id
            input=task_orm.action_params or {},
            output=task_orm.result or {},
            logs=[]
        )

    def create_task(self, task: TaskCreate) -> Task:
        """创建新任务"""
        created_at = datetime.now()
        updated_at = created_at

        task_orm = Task(
            id=str(uuid4()),
            title=task.title,
            description=task.description,
            status='pending',
            priority=task.priority,
            action_params=str(task.input) if task.input else None,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(task_orm)
        self.db.commit()
        self.db.refresh(task_orm)

        return self.get_task(task_orm.id)

    def update_task(self, task_id: str, task: TaskUpdate) -> Optional[Task]:
        """更新任务"""
        result = self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        task_orm = result.scalar_one_or_none()

        if not task_orm:
            return None

        updated_at = datetime.now()

        # Update fields if provided
        if task.title is not None:
            task_orm.title = task.title
        if task.description is not None:
            task_orm.description = task.description
        if task.status is not None:
            task_orm.status = task.status
        if task.priority is not None:
            task_orm.priority = task.priority
        if task.assigned_to is not None:
            task_orm.assignee_id = task.assigned_to
        if task.output is not None:
            task_orm.result = str(task.output) if task.output else None

        # Handle completed_at timestamp
        if task.status == 'completed':
            task_orm.completed_at = updated_at.isoformat()

        task_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(task_orm)

        return self.get_task(task_id)

    def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        result = self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        task_orm = result.scalar_one_or_none()

        if not task_orm:
            return False

        self.db.delete(task_orm)
        self.db.commit()
        return True

    def assign_task(self, task_id: str, agent_id: str) -> Optional[Task]:
        """分配任务"""
        # Check if agent exists and is running
        agent = self.agent_service.get_agent(agent_id)
        if not agent or agent.status != 'running':
            return None

        # Assign task in database
        updated_task = self.update_task(task_id, TaskUpdate(assigned_to=agent_id))

        if updated_task:
            # Create assignment record in agent service
            self.agent_service.assign_task(task_id, agent_id)

        return updated_task
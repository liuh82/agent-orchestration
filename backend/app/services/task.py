import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.task import TaskCreate, TaskUpdate, Task
from ..services.agent import AgentService


class TaskService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self.agent_service = AgentService()
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                priority TEXT DEFAULT 'medium',
                assigned_to TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT,
                completed_at TEXT,
                workflow_id TEXT,
                input TEXT,
                output TEXT,
                logs TEXT
            )
        ''')
        self.conn.commit()

    async def get_all_tasks(self) -> List[Task]:
        """获取所有任务"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM tasks ORDER BY created_at DESC')
        rows = cursor.fetchall()

        tasks = []
        for row in rows:
            task = Task(
                id=row[0],
                title=row[1],
                description=row[2],
                status=row[3],
                priority=row[4],
                assigned_to=row[5],
                created_by=row[6],
                created_at=datetime.fromisoformat(row[7]),
                updated_at=datetime.fromisoformat(row[8]),
                completed_at=datetime.fromisoformat(row[9]) if row[9] else None,
                workflow_id=row[10],
                input=row[11] if row[11] else {},
                output=row[12] if row[12] else {},
                logs=row[13].split('||') if row[13] else []
            )
            tasks.append(task)

        return tasks

    async def get_task(self, task_id: str) -> Optional[Task]:
        """获取单个任务"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Task(
            id=row[0],
            title=row[1],
            description=row[2],
            status=row[3],
            priority=row[4],
            assigned_to=row[5],
            created_by=row[6],
            created_at=datetime.fromisoformat(row[7]),
            updated_at=datetime.fromisoformat(row[8]),
            completed_at=datetime.fromisoformat(row[9]) if row[9] else None,
            workflow_id=row[10],
            input=row[11] if row[11] else {},
            output=row[12] if row[12] else {},
            logs=row[13].split('||') if row[13] else []
        )

    async def create_task(self, task: TaskCreate) -> Task:
        """创建新任务"""
        task_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO tasks (id, title, description, status, priority,
                            assigned_to, created_by, created_at, updated_at,
                            workflow_id, input)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_id,
            task.title,
            task.description,
            'pending',
            task.priority,
            None,
            'system',
            created_at.isoformat(),
            updated_at.isoformat(),
            task.workflow_id,
            str(task.input)
        ))
        self.conn.commit()

        return await self.get_task(task_id)

    async def update_task(self, task_id: str, task: TaskUpdate) -> Optional[Task]:
        """更新任务"""
        existing_task = await self.get_task(task_id)
        if not existing_task:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE tasks
            SET title = COALESCE(?, title),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                assigned_to = COALESCE(?, assigned_to),
                updated_at = ?,
                completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
                output = COALESCE(?, output)
            WHERE id = ?
        ''', (
            task.title,
            task.description,
            task.status,
            task.priority,
            task.assigned_to,
            updated_at.isoformat(),
            task.status,
            datetime.now().isoformat(),
            str(task.output) if task.output is not None else None,
            task_id
        ))
        self.conn.commit()

        return await self.get_task(task_id)

    async def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def assign_task(self, task_id: str, agent_id: str) -> Optional[Task]:
        """分配任务"""
        # Check if agent exists and is running
        agent = await self.agent_service.get_agent(agent_id)
        if not agent or agent.status != 'running':
            return None

        # Assign task in database
        updated_task = await self.update_task(task_id, TaskUpdate(assigned_to=agent_id))

        if updated_task:
            # Create assignment record in agent service
            await self.agent_service.assign_task(task_id, agent_id)

        return updated_task
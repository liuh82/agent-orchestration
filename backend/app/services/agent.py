import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4

from ..models.agent import AgentCreate, AgentUpdate, Agent, AgentStats
from ..models.log import LogCreate


class AgentService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Agents table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'claude-code',
                status TEXT DEFAULT 'offline',
                model TEXT DEFAULT 'claude-3-opus',
                timeout INTEGER DEFAULT 300,
                skills TEXT,
                capabilities TEXT,
                created_at TEXT,
                updated_at TEXT,
                last_seen TEXT,
                task_count INTEGER DEFAULT 0,
                completed_tasks INTEGER DEFAULT 0,
                failed_tasks INTEGER DEFAULT 0,
                total_tokens_used INTEGER DEFAULT 0,
                total_cost REAL DEFAULT 0.0,
                avg_response_time REAL DEFAULT 0.0,
                avg_task_duration REAL DEFAULT 0.0
            )
        ''')

        # Agent logs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agent_logs (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                level TEXT DEFAULT 'info',
                message TEXT NOT NULL,
                metadata TEXT,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
            )
        ''')

        # Task assignments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS task_assignments (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT DEFAULT 'running',
                FOREIGN KEY (task_id) REFERENCES tasks (id),
                FOREIGN KEY (agent_id) REFERENCES agents (id)
            )
        ''')

        self.conn.commit()

    async def get_all_agents(self) -> List[Agent]:
        """获取所有 Agent"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM agents ORDER BY created_at DESC')
        rows = cursor.fetchall()

        agents = []
        for row in rows:
            agent = Agent(
                id=row[0],
                name=row[1],
                type=row[2],
                status=row[3],
                model=row[4],
                timeout=row[5],
                skills=row[6].split(',') if row[6] else [],
                capabilities=row[7].split(',') if row[7] else [],
                created_at=datetime.fromisoformat(row[8]),
                updated_at=datetime.fromisoformat(row[9]),
                last_seen=datetime.fromisoformat(row[10]) if row[10] else None,
                task_count=row[11] if len(row) > 11 else 0,
                completed_tasks=row[12] if len(row) > 12 else 0,
                failed_tasks=row[13] if len(row) > 13 else 0,
                total_tokens_used=row[14] if len(row) > 14 else 0,
                total_cost=row[15] if len(row) > 15 else 0.0,
                avg_response_time=row[16] if len(row) > 16 else 0.0,
                avg_task_duration=row[17] if len(row) > 17 else 0.0
            )
            agents.append(agent)

        return agents

    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        """获取单个 Agent"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM agents WHERE id = ?', (agent_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Agent(
            id=row[0],
            name=row[1],
            type=row[2],
            status=row[3],
            model=row[4],
            timeout=row[5],
            skills=row[6].split(',') if row[6] else [],
            capabilities=row[7].split(',') if row[7] else [],
            created_at=datetime.fromisoformat(row[8]),
            updated_at=datetime.fromisoformat(row[9]),
            last_seen=datetime.fromisoformat(row[10]) if row[10] else None,
            task_count=row[11] if len(row) > 11 else 0,
            completed_tasks=row[12] if len(row) > 12 else 0,
            failed_tasks=row[13] if len(row) > 13 else 0,
            total_tokens_used=row[14] if len(row) > 14 else 0,
            total_cost=row[15] if len(row) > 15 else 0.0,
            avg_response_time=row[16] if len(row) > 16 else 0.0,
            avg_task_duration=row[17] if len(row) > 17 else 0.0
        )

    async def create_agent(self, agent: AgentCreate) -> Agent:
        """创建新 Agent"""
        agent_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO agents (id, name, type, status, model, timeout,
                              skills, capabilities, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            agent_id,
            agent.name,
            agent.type,
            'offline',
            agent.model,
            agent.timeout,
            ','.join(agent.skills),
            ','.join(agent.capabilities),
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_agent(agent_id)

    async def start_agent(self, agent_id: str) -> Optional[Agent]:
        """启动 Agent"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE agents
            SET status = 'running', last_seen = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), agent_id))
        self.conn.commit()

        # Log agent start
        await self._log_agent_event(agent_id, 'info', 'Agent started')

        return await self.get_agent(agent_id)

    async def stop_agent(self, agent_id: str) -> Optional[Agent]:
        """停止 Agent"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE agents
            SET status = 'offline'
            WHERE id = ?
        ''', (agent_id,))
        self.conn.commit()

        # Log agent stop
        await self._log_agent_event(agent_id, 'info', 'Agent stopped')

        return await self.get_agent(agent_id)

    async def get_agent_stats(self, agent_id: str) -> Optional[AgentStats]:
        """获取 Agent 统计信息"""
        agent = await self.get_agent(agent_id)
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

    async def get_agent_logs(self, agent_id: str, page: int = 1, page_size: int = 50,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None,
                           level: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取 Agent 日志"""
        cursor = self.conn.cursor()

        query = '''
            SELECT id, level, message, metadata, timestamp, created_at
            FROM agent_logs
            WHERE agent_id = ?
        '''
        params = [agent_id]

        if start_time:
            query += ' AND timestamp >= ?'
            params.append(start_time.isoformat())

        if end_time:
            query += ' AND timestamp <= ?'
            params.append(end_time.isoformat())

        if level:
            query += ' AND level = ?'
            params.append(level)

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.extend([page_size, (page - 1) * page_size])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        logs = []
        for row in rows:
            log = {
                'id': row[0],
                'level': row[1],
                'message': row[2],
                'metadata': row[3] if row[3] else {},
                'timestamp': datetime.fromisoformat(row[4]),
                'created_at': datetime.fromisoformat(row[5])
            }
            logs.append(log)

        return logs

    async def assign_task(self, task_id: str, agent_id: str) -> bool:
        """分配任务给 Agent"""
        # Check if agent exists and is running
        agent = await self.get_agent(agent_id)
        if not agent or agent.status != 'running':
            return False

        # Create task assignment record
        assignment_id = str(uuid4())
        start_time = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO task_assignments
            (id, task_id, agent_id, start_time, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (assignment_id, task_id, agent_id, start_time.isoformat(), 'running'))

        # Update agent task count
        cursor.execute('''
            UPDATE agents
            SET task_count = task_count + 1
            WHERE id = ?
        ''', (agent_id,))

        self.conn.commit()

        # Log the assignment
        await self._log_agent_event(agent_id, 'info', f'Task {task_id} assigned')

        return True

    async def _log_agent_event(self, agent_id: str, level: str, message: str, metadata: Optional[Dict] = None):
        """记录 Agent 事件"""
        log_id = str(uuid4())
        timestamp = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO agent_logs
            (id, agent_id, level, message, metadata, timestamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            log_id,
            agent_id,
            level,
            message,
            str(metadata) if metadata else None,
            timestamp.isoformat(),
            timestamp.isoformat()
        ))
        self.conn.commit()

    async def update_agent_stats(self, agent_id: str, task_duration: float,
                               response_time: float, tokens_used: int,
                               success: bool, cost: float = 0.0):
        """更新 Agent 统计信息"""
        cursor = self.conn.cursor()

        # Update task counts
        if success:
            cursor.execute('''
                UPDATE agents
                SET completed_tasks = completed_tasks + 1
                WHERE id = ?
            ''', (agent_id,))
        else:
            cursor.execute('''
                UPDATE agents
                SET failed_tasks = failed_tasks + 1
                WHERE id = ?
            ''', (agent_id,))

        # Update stats (weighted average for demo)
        cursor.execute('''
            UPDATE agents
            SET avg_response_time =
                CASE WHEN avg_response_time = 0.0 THEN ?
                     ELSE (avg_response_time * 0.9 + ? * 0.1)
                END,
                avg_task_duration =
                CASE WHEN avg_task_duration = 0.0 THEN ?
                     ELSE (avg_task_duration * 0.9 + ? * 0.1)
                END,
                total_tokens_used = total_tokens_used + ?,
                total_cost = total_cost + ?
            WHERE id = ?
        ''', (response_time, response_time, task_duration, task_duration, tokens_used, cost, agent_id))

        self.conn.commit()

    async def update_agent(self, agent_id: str, agent: AgentUpdate) -> Optional[Agent]:
        """更新 Agent"""
        existing_agent = await self.get_agent(agent_id)
        if not existing_agent:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE agents
            SET name = ?, type = ?, status = ?, model = ?, timeout = ?,
                skills = ?, capabilities = ?, updated_at = ?
            WHERE id = ?
        ''', (
            agent.name,
            agent.type,
            agent.status,
            agent.model,
            agent.timeout,
            ','.join(agent.skills),
            ','.join(agent.capabilities),
            updated_at.isoformat(),
            agent_id
        ))
        self.conn.commit()

        return await self.get_agent(agent_id)

    async def delete_agent(self, agent_id: str) -> bool:
        """删除 Agent"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM agents WHERE id = ?', (agent_id,))
        self.conn.commit()
        return cursor.rowcount > 0
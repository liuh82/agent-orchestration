import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.agent import AgentCreate, AgentUpdate, Agent


class AgentService:
    def __init__(self):
        self.conn = sqlite3.connect('agents.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()
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
                last_seen TEXT
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
                last_seen=datetime.fromisoformat(row[10]) if row[10] else None
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
            last_seen=datetime.fromisoformat(row[10]) if row[10] else None
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
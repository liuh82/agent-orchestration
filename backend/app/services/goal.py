import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.goal import GoalCreate, GoalUpdate, Goal, GoalAlignmentCreate, GoalAlignment


class GoalService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Goals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL DEFAULT 'objective',
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'draft',
                owner_id TEXT NOT NULL,
                department_id TEXT,
                due_date TEXT,
                progress REAL DEFAULT 0.0 CHECK (progress >= 0 AND progress <= 100),
                tags TEXT,  -- JSON string
                metrics TEXT,  -- JSON string
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES org_chart_nodes (id),
                FOREIGN KEY (department_id) REFERENCES org_chart_nodes (id)
            )
        ''')

        # Goal alignments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goal_alignments (
                id TEXT PRIMARY KEY,
                parent_id TEXT NOT NULL,
                child_id TEXT NOT NULL,
                weight REAL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES goals (id),
                FOREIGN KEY (child_id) REFERENCES goals (id)
            )
        ''')

        # Index for owner_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_goals_owner_id ON goals (owner_id)
        ''')

        # Index for department_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_goals_department_id ON goals (department_id)
        ''')

        # Index for goal alignments
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_goal_alignments_parent_id ON goal_alignments (parent_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_goal_alignments_child_id ON goal_alignments (child_id)
        ''')

        self.conn.commit()

    async def get_all_goals(self, include_inactive: bool = False) -> List[Goal]:
        """获取所有目标"""
        cursor = self.conn.cursor()

        query = 'SELECT * FROM goals'
        params = []

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        goals = []
        for row in rows:
            goal = Goal(
                id=row[0],
                title=row[1],
                description=row[2],
                type=row[3],
                priority=row[4],
                status=row[5],
                owner_id=row[6],
                department_id=row[7],
                due_date=datetime.fromisoformat(row[8]) if row[8] else None,
                progress=row[9],
                tags=row[10].split(',') if row[10] else [],
                metrics=row[11].split(',') if row[11] else [],
                created_at=datetime.fromisoformat(row[12]),
                updated_at=datetime.fromisoformat(row[13])
            )
            goals.append(goal)

        return goals

    async def get_goal(self, goal_id: str) -> Optional[Goal]:
        """获取单个目标"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM goals WHERE id = ?', (goal_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Goal(
            id=row[0],
            title=row[1],
            description=row[2],
            type=row[3],
            priority=row[4],
            status=row[5],
            owner_id=row[6],
            department_id=row[7],
            due_date=datetime.fromisoformat(row[8]) if row[8] else None,
            progress=row[9],
            tags=row[10].split(',') if row[10] else [],
            metrics=row[11].split(',') if row[11] else [],
            created_at=datetime.fromisoformat(row[12]),
            updated_at=datetime.fromisoformat(row[13])
        )

    async def create_goal(self, goal: GoalCreate) -> Goal:
        """创建新目标"""
        goal_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO goals (
                id, title, description, type, priority, status, owner_id,
                department_id, due_date, progress, tags, metrics, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            goal_id,
            goal.title,
            goal.description,
            goal.type,
            goal.priority,
            goal.status,
            goal.owner_id,
            goal.department_id,
            goal.due_date.isoformat() if goal.due_date else None,
            goal.progress,
            ','.join(goal.tags),
            ','.join(goal.metrics),
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_goal(goal_id)

    async def update_goal(self, goal_id: str, goal: GoalUpdate) -> Optional[Goal]:
        """更新目标"""
        existing_goal = await self.get_goal(goal_id)
        if not existing_goal:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE goals
            SET title = ?, description = ?, type = ?, priority = ?, status = ?,
                owner_id = ?, department_id = ?, due_date = ?, progress = ?,
                tags = ?, metrics = ?, updated_at = ?
            WHERE id = ?
        ''', (
            goal.title,
            goal.description,
            goal.type,
            goal.priority,
            goal.status,
            goal.owner_id,
            goal.department_id,
            goal.due_date.isoformat() if goal.due_date else None,
            goal.progress,
            ','.join(goal.tags) if goal.tags else '',
            ','.join(goal.metrics) if goal.metrics else '',
            updated_at.isoformat(),
            goal_id
        ))
        self.conn.commit()

        return await self.get_goal(goal_id)

    async def delete_goal(self, goal_id: str) -> bool:
        """删除目标"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM goals WHERE id = ?', (goal_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def get_goals_by_owner(self, owner_id: str) -> List[Goal]:
        """获取指定所有者的目标"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM goals
            WHERE owner_id = ?
            ORDER BY created_at DESC
        ''', (owner_id,))

        rows = cursor.fetchall()
        goals = []
        for row in rows:
            goal = Goal(
                id=row[0],
                title=row[1],
                description=row[2],
                type=row[3],
                priority=row[4],
                status=row[5],
                owner_id=row[6],
                department_id=row[7],
                due_date=datetime.fromisoformat(row[8]) if row[8] else None,
                progress=row[9],
                tags=row[10].split(',') if row[10] else [],
                metrics=row[11].split(',') if row[11] else [],
                created_at=datetime.fromisoformat(row[12]),
                updated_at=datetime.fromisoformat(row[13])
            )
            goals.append(goal)

        return goals

    async def get_goals_by_department(self, department_id: str) -> List[Goal]:
        """获取指定部门的目标"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM goals
            WHERE department_id = ?
            ORDER BY created_at DESC
        ''', (department_id,))

        rows = cursor.fetchall()
        goals = []
        for row in rows:
            goal = Goal(
                id=row[0],
                title=row[1],
                description=row[2],
                type=row[3],
                priority=row[4],
                status=row[5],
                owner_id=row[6],
                department_id=row[7],
                due_date=datetime.fromisoformat(row[8]) if row[8] else None,
                progress=row[9],
                tags=row[10].split(',') if row[10] else [],
                metrics=row[11].split(',') if row[11] else [],
                created_at=datetime.fromisoformat(row[12]),
                updated_at=datetime.fromisoformat(row[13])
            )
            goals.append(goal)

        return goals

    # Goal Alignment Methods
    async def create_goal_alignment(self, alignment: GoalAlignmentCreate) -> GoalAlignment:
        """创建目标对齐关系"""
        alignment_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO goal_alignments (
                id, parent_id, child_id, weight, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            alignment_id,
            alignment.parent_id,
            alignment.child_id,
            alignment.weight,
            alignment.description,
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return GoalAlignment(
            id=alignment_id,
            parent_id=alignment.parent_id,
            child_id=alignment.child_id,
            weight=alignment.weight,
            description=alignment.description,
            created_at=created_at,
            updated_at=updated_at
        )

    async def get_goal_alignments(self, parent_id: Optional[str] = None, child_id: Optional[str] = None) -> List[GoalAlignment]:
        """获取目标对齐关系"""
        cursor = self.conn.cursor()
        query = 'SELECT * FROM goal_alignments'
        params = []

        conditions = []
        if parent_id:
            conditions.append('parent_id = ?')
            params.append(parent_id)
        if child_id:
            conditions.append('child_id = ?')
            params.append(child_id)

        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        alignments = []
        for row in rows:
            alignment = GoalAlignment(
                id=row[0],
                parent_id=row[1],
                child_id=row[2],
                weight=row[3],
                description=row[4],
                created_at=datetime.fromisoformat(row[5]),
                updated_at=datetime.fromisoformat(row[6])
            )
            alignments.append(alignment)

        return alignments

    async def delete_goal_alignment(self, alignment_id: str) -> bool:
        """删除目标对齐关系"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM goal_alignments WHERE id = ?', (alignment_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def get_goal_hierarchy(self, goal_id: str) -> dict:
        """获取目标层级结构"""
        goal = await self.get_goal(goal_id)
        if not goal:
            return {}

        # Get all alignments
        alignments = await self.get_goal_alignments()

        # Build hierarchy
        hierarchy = {
            'goal': goal,
            'children': [],
            'parents': []
        }

        # Find children goals
        for alignment in alignments:
            if alignment.parent_id == goal_id:
                child_goal = await self.get_goal(alignment.child_id)
                if child_goal:
                    hierarchy['children'].append({
                        'goal': child_goal,
                        'weight': alignment.weight,
                        'description': alignment.description
                    })

        # Find parent goals
        for alignment in alignments:
            if alignment.child_id == goal_id:
                parent_goal = await self.get_goal(alignment.parent_id)
                if parent_goal:
                    hierarchy['parents'].append({
                        'goal': parent_goal,
                        'weight': alignment.weight,
                        'description': alignment.description
                    })

        return hierarchy
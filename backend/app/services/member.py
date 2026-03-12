import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.member import MemberCreate, MemberUpdate, Member


class MemberService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Members table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                avatar TEXT,
                department_id TEXT NOT NULL,
                position TEXT NOT NULL,
                role_ids TEXT,  -- JSON string
                is_active BOOLEAN DEFAULT TRUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (department_id) REFERENCES org_chart_nodes (id)
            )
        ''')

        # Index for email
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_members_email ON members (email)
        ''')

        # Index for department_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_members_department_id ON members (department_id)
        ''')

        self.conn.commit()

    async def get_all_members(self, include_inactive: bool = False) -> List[Member]:
        """获取所有成员"""
        cursor = self.conn.cursor()

        query = 'SELECT * FROM members'
        params = []

        if not include_inactive:
            query += ' WHERE is_active = ?'
            params.append(True)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        members = []
        for row in rows:
            member = Member(
                id=row[0],
                name=row[1],
                email=row[2],
                phone=row[3],
                avatar=row[4],
                department_id=row[5],
                position=row[6],
                role_ids=row[7].split(',') if row[7] else [],
                is_active=bool(row[8]) if row[8] else True,
                created_at=datetime.fromisoformat(row[9]),
                updated_at=datetime.fromisoformat(row[10])
            )
            members.append(member)

        return members

    async def get_member(self, member_id: str) -> Optional[Member]:
        """获取单个成员"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM members WHERE id = ?', (member_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Member(
            id=row[0],
            name=row[1],
            email=row[2],
            phone=row[3],
            avatar=row[4],
            department_id=row[5],
            position=row[6],
            role_ids=row[7].split(',') if row[7] else [],
            is_active=bool(row[8]) if row[8] else True,
            created_at=datetime.fromisoformat(row[9]),
            updated_at=datetime.fromisoformat(row[10])
        )

    async def get_member_by_email(self, email: str) -> Optional[Member]:
        """通过邮箱获取成员"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM members WHERE email = ?', (email,))
        row = cursor.fetchone()

        if not row:
            return None

        return Member(
            id=row[0],
            name=row[1],
            email=row[2],
            phone=row[3],
            avatar=row[4],
            department_id=row[5],
            position=row[6],
            role_ids=row[7].split(',') if row[7] else [],
            is_active=bool(row[8]) if row[8] else True,
            created_at=datetime.fromisoformat(row[9]),
            updated_at=datetime.fromisoformat(row[10])
        )

    async def create_member(self, member: MemberCreate) -> Member:
        """创建新成员"""
        member_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO members (
                id, name, email, phone, avatar, department_id, position,
                role_ids, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            member_id,
            member.name,
            member.email,
            member.phone,
            member.avatar,
            member.department_id,
            member.position,
            ','.join(member.role_ids),
            member.is_active,
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_member(member_id)

    async def update_member(self, member_id: str, member: MemberUpdate) -> Optional[Member]:
        """更新成员"""
        existing_member = await self.get_member(member_id)
        if not existing_member:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE members
            SET name = ?, email = ?, phone = ?, avatar = ?, department_id = ?,
                position = ?, role_ids = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        ''', (
            member.name,
            member.email,
            member.phone,
            member.avatar,
            member.department_id,
            member.position,
            ','.join(member.role_ids) if member.role_ids else '',
            member.is_active,
            updated_at.isoformat(),
            member_id
        ))
        self.conn.commit()

        return await self.get_member(member_id)

    async def delete_member(self, member_id: str) -> bool:
        """删除成员（软删除）"""
        cursor = self.conn.cursor()
        cursor.execute('UPDATE members SET is_active = FALSE WHERE id = ?', (member_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def check_member_exists(self, email: str, exclude_id: Optional[str] = None) -> bool:
        """检查成员是否存在"""
        cursor = self.conn.cursor()

        if exclude_id:
            cursor.execute('SELECT 1 FROM members WHERE email = ? AND id != ?', (email, exclude_id))
        else:
            cursor.execute('SELECT 1 FROM members WHERE email = ?', (email,))

        return cursor.fetchone() is not None

    async def get_members_by_department(self, department_id: str) -> List[Member]:
        """获取指定部门的成员"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM members
            WHERE department_id = ? AND is_active = TRUE
            ORDER BY created_at DESC
        ''', (department_id,))

        rows = cursor.fetchall()
        members = []
        for row in rows:
            member = Member(
                id=row[0],
                name=row[1],
                email=row[2],
                phone=row[3],
                avatar=row[4],
                department_id=row[5],
                position=row[6],
                role_ids=row[7].split(',') if row[7] else [],
                is_active=bool(row[8]) if row[8] else True,
                created_at=datetime.fromisoformat(row[9]),
                updated_at=datetime.fromisoformat(row[10])
            )
            members.append(member)

        return members

    async def get_members_by_role(self, role_id: str) -> List[Member]:
        """获取拥有指定角色的成员"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM members
            WHERE role_ids LIKE ? AND is_active = TRUE
            ORDER BY created_at DESC
        ''', (f'%{role_id}%',))

        rows = cursor.fetchall()
        members = []
        for row in rows:
            member = Member(
                id=row[0],
                name=row[1],
                email=row[2],
                phone=row[3],
                avatar=row[4],
                department_id=row[5],
                position=row[6],
                role_ids=row[7].split(',') if row[7] else [],
                is_active=bool(row[8]) if row[8] else True,
                created_at=datetime.fromisoformat(row[9]),
                updated_at=datetime.fromisoformat(row[10])
            )
            members.append(member)

        return members
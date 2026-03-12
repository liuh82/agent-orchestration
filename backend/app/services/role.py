import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.role import RoleCreate, RoleUpdate, Role


class RoleService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Roles table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                description TEXT,
                permissions TEXT,  -- JSON string
                is_active BOOLEAN DEFAULT TRUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')

        # Index for code
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_roles_code ON roles (code)
        ''')

        self.conn.commit()

    async def get_all_roles(self, include_inactive: bool = False) -> List[Role]:
        """获取所有角色"""
        cursor = self.conn.cursor()

        query = 'SELECT * FROM roles'
        params = []

        if not include_inactive:
            query += ' WHERE is_active = ?'
            params.append(True)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        roles = []
        for row in rows:
            role = Role(
                id=row[0],
                name=row[1],
                code=row[2],
                description=row[3],
                permissions=row[4].split(',') if row[4] else [],
                is_active=bool(row[5]) if row[5] else True,
                created_at=datetime.fromisoformat(row[6]),
                updated_at=datetime.fromisoformat(row[7])
            )
            roles.append(role)

        return roles

    async def get_role(self, role_id: str) -> Optional[Role]:
        """获取单个角色"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM roles WHERE id = ? AND is_active = ?', (role_id, True))
        row = cursor.fetchone()

        if not row:
            return None

        return Role(
            id=row[0],
            name=row[1],
            code=row[2],
            description=row[3],
            permissions=row[4].split(',') if row[4] else [],
            is_active=bool(row[5]) if row[5] else True,
            created_at=datetime.fromisoformat(row[6]),
            updated_at=datetime.fromisoformat(row[7])
        )

    async def get_role_by_code(self, code: str) -> Optional[Role]:
        """通过代码获取角色"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM roles WHERE code = ?', (code,))
        row = cursor.fetchone()

        if not row:
            return None

        return Role(
            id=row[0],
            name=row[1],
            code=row[2],
            description=row[3],
            permissions=row[4].split(',') if row[4] else [],
            is_active=bool(row[5]) if row[5] else True,
            created_at=datetime.fromisoformat(row[6]),
            updated_at=datetime.fromisoformat(row[7])
        )

    async def create_role(self, role: RoleCreate) -> Role:
        """创建新角色"""
        role_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO roles (
                id, name, code, description, permissions, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            role_id,
            role.name,
            role.code,
            role.description,
            ','.join(role.permissions),
            role.is_active,
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_role(role_id)

    async def update_role(self, role_id: str, role: RoleUpdate) -> Optional[Role]:
        """更新角色"""
        existing_role = await self.get_role(role_id)
        if not existing_role:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE roles
            SET name = ?, code = ?, description = ?, permissions = ?,
                is_active = ?, updated_at = ?
            WHERE id = ?
        ''', (
            role.name,
            role.code,
            role.description,
            ','.join(role.permissions),
            role.is_active,
            updated_at.isoformat(),
            role_id
        ))
        self.conn.commit()

        return await self.get_role(role_id)

    async def delete_role(self, role_id: str) -> bool:
        """删除角色（软删除）"""
        cursor = self.conn.cursor()
        cursor.execute('UPDATE roles SET is_active = FALSE WHERE id = ?', (role_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def check_role_exists(self, code: str, exclude_id: Optional[str] = None) -> bool:
        """检查角色是否存在"""
        cursor = self.conn.cursor()

        if exclude_id:
            cursor.execute('SELECT 1 FROM roles WHERE code = ? AND id != ?', (code, exclude_id))
        else:
            cursor.execute('SELECT 1 FROM roles WHERE code = ?', (code,))

        return cursor.fetchone() is not None
import sqlite3
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from ..models.org_chart import (
    OrganizationChartCreate, OrganizationChartUpdate, OrganizationChartNode,
    OrgChartDataResponse
)


class OrgChartService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Organization chart nodes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS org_chart_nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                department TEXT NOT NULL,
                level INTEGER NOT NULL,
                parent_id TEXT,
                children_ids TEXT,
                email TEXT,
                phone TEXT,
                avatar TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES org_chart_nodes (id)
            )
        ''')

        # Department table (for reference)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                parent_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES departments (id)
            )
        ''')

        self.conn.commit()

    async def get_all_nodes(self, include_inactive: bool = False) -> List[OrganizationChartNode]:
        """获取所有组织架构节点"""
        cursor = self.conn.cursor()

        query = 'SELECT * FROM org_chart_nodes'
        params = []

        if not include_inactive:
            query += ' WHERE is_active = ?'
            params.append(True)

        query += ' ORDER BY level, created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        nodes = []
        for row in rows:
            node = OrganizationChartNode(
                id=row[0],
                name=row[1],
                title=row[2],
                department=row[3],
                level=row[4],
                parent_id=row[5],
                children_ids=row[6].split(',') if row[6] else [],
                email=row[7],
                phone=row[8],
                avatar=row[9],
                is_active=bool(row[10]) if row[10] else True,
                created_at=datetime.fromisoformat(row[11]),
                updated_at=datetime.fromisoformat(row[12])
            )
            nodes.append(node)

        return nodes

    async def get_node(self, node_id: str) -> Optional[OrganizationChartNode]:
        """获取单个组织架构节点"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM org_chart_nodes WHERE id = ?', (node_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return OrganizationChartNode(
            id=row[0],
            name=row[1],
            title=row[2],
            department=row[3],
            level=row[4],
            parent_id=row[5],
            children_ids=row[6].split(',') if row[6] else [],
            email=row[7],
            phone=row[8],
            avatar=row[9],
            is_active=bool(row[10]) if row[10] else True,
            created_at=datetime.fromisoformat(row[11]),
            updated_at=datetime.fromisoformat(row[12])
        )

    async def create_node(self, node: OrganizationChartCreate) -> OrganizationChartNode:
        """创建新的组织架构节点"""
        node_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        # Calculate level based on parent
        level = 1
        if node.parent_id:
            parent = await self.get_node(node.parent_id)
            if parent:
                level = parent.level + 1

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO org_chart_nodes (
                id, name, title, department, level, parent_id, children_ids,
                email, phone, avatar, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            node_id,
            node.name,
            node.title,
            node.department,
            level,
            node.parent_id,
            '',  # children_ids will be updated later
            node.email,
            node.phone,
            node.avatar,
            True,  # is_active defaults to True for new nodes
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        # If parent exists, add this node to parent's children_ids
        if node.parent_id:
            await self._add_child_to_parent(node.parent_id, node_id)

        return await self.get_node(node_id)

    async def update_node(self, node_id: str, node: OrganizationChartUpdate) -> Optional[OrganizationChartNode]:
        """更新组织架构节点"""
        existing_node = await self.get_node(node_id)
        if not existing_node:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE org_chart_nodes
            SET name = ?, title = ?, department = ?, email = ?, phone = ?,
                avatar = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        ''', (
            node.name,
            node.title,
            node.department,
            node.email,
            node.phone,
            node.avatar,
            node.is_active,
            updated_at.isoformat(),
            node_id
        ))
        self.conn.commit()

        return await self.get_node(node_id)

    async def delete_node(self, node_id: str) -> bool:
        """删除组织架构节点"""
        node = await self.get_node(node_id)
        if not node:
            return False

        cursor = self.conn.cursor()

        # Remove this node from parent's children_ids
        if node.parent_id:
            await self._remove_child_from_parent(node.parent_id, node_id)

        # Recursively delete all children
        for child_id in node.children_ids:
            await self.delete_node(child_id)

        # Delete the node
        cursor.execute('DELETE FROM org_chart_nodes WHERE id = ?', (node_id,))
        self.conn.commit()

        return cursor.rowcount > 0

    async def get_org_chart_data(self) -> OrgChartDataResponse:
        """获取组织架构图数据（树形结构）"""
        all_nodes = await self.get_all_nodes(include_inactive=False)

        # Build tree structure
        tree = {}
        node_map = {}

        # Create map of all nodes
        for node in all_nodes:
            node_map[node.id] = node

        # Build tree
        root_nodes = []
        for node in all_nodes:
            if node.parent_id is None:
                root_nodes.append(node.id)
                tree[node.id] = {
                    'id': node.id,
                    'name': node.name,
                    'title': node.title,
                    'department': node.department,
                    'children': [],
                    'email': node.email,
                    'phone': node.phone,
                    'avatar': node.avatar,
                    'level': node.level
                }

        # Add children to their parents
        for node_id, node in node_map.items():
            if node.parent_id and node.parent_id in tree:
                parent = tree[node.parent_id]
                parent['children'].append({
                    'id': node.id,
                    'name': node.name,
                    'title': node.title,
                    'department': node.department,
                    'children': [],
                    'email': node.email,
                    'phone': node.phone,
                    'avatar': node.avatar,
                    'level': node.level
                })

        return OrgChartDataResponse(
            success=True,
            data={'root_nodes': root_nodes, 'tree': tree},
            message="Organization chart data retrieved successfully"
        )

    async def get_department_tree(self) -> Dict[str, Any]:
        """获取部门树"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM departments ORDER BY created_at ASC')
        rows = cursor.fetchall()

        departments = []
        for row in rows:
            dept = {
                'id': row[0],
                'name': row[1],
                'code': row[2],
                'parent_id': row[3],
                'created_at': datetime.fromisoformat(row[4])
            }
            departments.append(dept)

        # Build tree structure
        tree = {}
        node_map = {}

        for dept in departments:
            node_map[dept['id']] = dept

        root_departments = []
        for dept in departments:
            if dept['parent_id'] is None:
                root_departments.append(dept['id'])
                tree[dept['id']] = dept

        # Add children
        for dept_id, dept in node_map.items():
            if dept['parent_id'] and dept['parent_id'] in tree:
                parent = tree[dept['parent_id']]
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(dept)

        return {'root_departments': root_departments, 'tree': tree}

    async def _add_child_to_parent(self, parent_id: str, child_id: str):
        """添加子节点到父节点的children_ids"""
        parent = await self.get_node(parent_id)
        if parent and child_id not in parent.children_ids:
            parent.children_ids.append(child_id)

            cursor = self.conn.cursor()
            cursor.execute('''
                UPDATE org_chart_nodes
                SET children_ids = ?
                WHERE id = ?
            ''', (','.join(parent.children_ids), parent_id))
            self.conn.commit()

    async def _remove_child_from_parent(self, parent_id: str, child_id: str):
        """从父节点的children_ids中移除子节点"""
        parent = await self.get_node(parent_id)
        if parent and child_id in parent.children_ids:
            parent.children_ids.remove(child_id)

            cursor = self.conn.cursor()
            cursor.execute('''
                UPDATE org_chart_nodes
                SET children_ids = ?
                WHERE id = ?
            ''', (','.join(parent.children_ids), parent_id))
            self.conn.commit()
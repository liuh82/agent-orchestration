from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import Session

from ..models.org_chart import (
    OrganizationChartCreate, OrganizationChartUpdate, OrganizationChartNode,
    OrgChartDataResponse
)
from ..models.complete_orm import OrganizationChartNode as OrganizationChartNodeORM, Department as DepartmentORM
from ..models.member import MemberCreate
# Member model will be migrated later


class OrgChartService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_nodes(self, include_inactive: bool = False) -> List[OrganizationChartNode]:
        """获取所有组织架构节点"""
        query = select(OrganizationChartNodeORM)
        params = []

        if not include_inactive:
            query = query.where(OrganizationChartNodeORM.is_active == True)

        query = query.order_by(OrganizationChartNodeORM.level, OrganizationChartNodeORM.created_at.desc())

        result = self.db.execute(query)
        node_orms = result.scalars().all()

        nodes = []
        for node_orm in node_orms:
            node = OrganizationChartNode(
                id=node_orm.id,
                name=node_orm.name,
                title=node_orm.title,
                department=node_orm.department,
                level=node_orm.level,
                parent_id=node_orm.parent_id,
                children_ids=node_orm.children_ids.split(',') if node_orm.children_ids else [],
                email=node_orm.email,
                phone=node_orm.phone,
                avatar=node_orm.avatar,
                is_active=node_orm.is_active,
                created_at=datetime.fromisoformat(node_orm.created_at),
                updated_at=datetime.fromisoformat(node_orm.updated_at)
            )
            nodes.append(node)

        return nodes

    def get_node(self, node_id: str) -> Optional[OrganizationChartNode]:
        """获取单个组织架构节点"""
        result = self.db.execute(
            select(OrganizationChartNodeORM).where(OrganizationChartNodeORM.id == node_id)
        )
        node_orm = result.scalar_one_or_none()

        if not node_orm:
            return None

        return OrganizationChartNode(
            id=node_orm.id,
            name=node_orm.name,
            title=node_orm.title,
            department=node_orm.department,
            level=node_orm.level,
            parent_id=node_orm.parent_id,
            children_ids=node_orm.children_ids.split(',') if node_orm.children_ids else [],
            email=node_orm.email,
            phone=node_orm.phone,
            avatar=node_orm.avatar,
            is_active=node_orm.is_active,
            created_at=datetime.fromisoformat(node_orm.created_at),
            updated_at=datetime.fromisoformat(node_orm.updated_at)
        )

    def create_node(self, node: OrganizationChartCreate) -> OrganizationChartNode:
        """创建新的组织架构节点"""
        node_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        # Calculate level based on parent
        level = 1
        if node.parent_id:
            parent = self.get_node(node.parent_id)
            if parent:
                level = parent.level + 1

        node_orm = OrganizationChartNodeORM(
            id=node_id,
            name=node.name,
            title=node.title,
            department=node.department,
            level=level,
            parent_id=node.parent_id,
            children_ids='',  # children_ids will be updated later
            email=node.email,
            phone=node.phone,
            avatar=node.avatar,
            is_active=True,  # is_active defaults to True for new nodes
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(node_orm)
        self.db.commit()

        # If parent exists, add this node to parent's children_ids
        if node.parent_id:
            self._add_child_to_parent(node.parent_id, node_id)

        return self.get_node(node_id)

    def update_node(self, node_id: str, node: OrganizationChartUpdate) -> Optional[OrganizationChartNode]:
        """更新组织架构节点"""
        result = self.db.execute(
            select(OrganizationChartNodeORM).where(OrganizationChartNodeORM.id == node_id)
        )
        node_orm = result.scalar_one_or_none()

        if not node_orm:
            return None

        updated_at = datetime.now()

        # Update fields
        node_orm.name = node.name
        node_orm.title = node.title
        node_orm.department = node.department
        node_orm.email = node.email
        node_orm.phone = node.phone
        node_orm.avatar = node.avatar
        node_orm.is_active = node.is_active
        node_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(node_orm)

        return self.get_node(node_id)

    def delete_node(self, node_id: str) -> bool:
        """删除组织架构节点"""
        result = self.db.execute(
            select(OrganizationChartNodeORM).where(OrganizationChartNodeORM.id == node_id)
        )
        node_orm = result.scalar_one_or_none()

        if not node_orm:
            return False

        # Remove this node from parent's children_ids
        if node_orm.parent_id:
            self._remove_child_from_parent(node_orm.parent_id, node_id)

        # Recursively delete all children
        for child_id in node_orm.children_ids.split(',') if node_orm.children_ids else []:
            self.delete_node(child_id)

        # Delete the node
        self.db.delete(node_orm)
        self.db.commit()

        return True

    def get_org_chart_data(self) -> OrgChartDataResponse:
        """获取组织架构图数据（树形结构）"""
        all_nodes = self.get_all_nodes(include_inactive=False)

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

    def get_department_tree(self) -> Dict[str, Any]:
        """获取部门树"""
        result = self.db.execute(
            select(DepartmentORM).order_by(DepartmentORM.created_at.asc())
        )
        dept_orms = result.scalars().all()

        departments = []
        for dept_orm in dept_orms:
            dept = {
                'id': dept_orm.id,
                'name': dept_orm.name,
                'code': dept_orm.code,
                'parent_id': dept_orm.parent_id,
                'created_at': datetime.fromisoformat(dept_orm.created_at)
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

    def _add_child_to_parent(self, parent_id: str, child_id: str):
        """添加子节点到父节点的children_ids"""
        result = self.db.execute(
            select(OrganizationChartNodeORM).where(OrganizationChartNodeORM.id == parent_id)
        )
        parent_orm = result.scalar_one_or_none()

        if parent_orm:
            children_ids = []
            if parent_orm.children_ids:
                children_ids = parent_orm.children_ids.split(',')
            if child_id not in children_ids:
                children_ids.append(child_id)
                parent_orm.children_ids = ','.join(children_ids)
                self.db.commit()

    def _remove_child_from_parent(self, parent_id: str, child_id: str):
        """从父节点的children_ids中移除子节点"""
        result = self.db.execute(
            select(OrganizationChartNodeORM).where(OrganizationChartNodeORM.id == parent_id)
        )
        parent_orm = result.scalar_one_or_none()

        if parent_orm:
            children_ids = []
            if parent_orm.children_ids:
                children_ids = parent_orm.children_ids.split(',')
            if child_id in children_ids:
                children_ids.remove(child_id)
                parent_orm.children_ids = ','.join(children_ids)
                self.db.commit()
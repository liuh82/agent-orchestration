from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import Session

from ..models.role import RoleCreate, RoleUpdate, Role
from ..models.orm_models import Role as RoleORM


class RoleService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_roles(self, include_inactive: bool = False) -> List[Role]:
        """获取所有角色"""
        query = select(RoleORM)
        params = []

        if not include_inactive:
            query = query.where(RoleORM.is_active == True)

        query = query.order_by(RoleORM.created_at.desc())

        result = self.db.execute(query)
        role_orms = result.scalars().all()

        roles = []
        for role_orm in role_orms:
            role = Role(
                id=role_orm.id,
                name=role_orm.name,
                code=role_orm.code,
                description=role_orm.description,
                permissions=role_orm.permissions.split(',') if role_orm.permissions else [],
                is_active=role_orm.is_active,
                created_at=datetime.fromisoformat(role_orm.created_at),
                updated_at=datetime.fromisoformat(role_orm.updated_at)
            )
            roles.append(role)

        return roles

    def get_role(self, role_id: str) -> Optional[Role]:
        """获取单个角色"""
        result = self.db.execute(
            select(RoleORM).where(and_(RoleORM.id == role_id, RoleORM.is_active == True))
        )
        role_orm = result.scalar_one_or_none()

        if not role_orm:
            return None

        return Role(
            id=role_orm.id,
            name=role_orm.name,
            code=role_orm.code,
            description=role_orm.description,
            permissions=role_orm.permissions.split(',') if role_orm.permissions else [],
            is_active=role_orm.is_active,
            created_at=datetime.fromisoformat(role_orm.created_at),
            updated_at=datetime.fromisoformat(role_orm.updated_at)
        )

    def get_role_by_code(self, code: str) -> Optional[Role]:
        """通过代码获取角色"""
        result = self.db.execute(
            select(RoleORM).where(RoleORM.code == code)
        )
        role_orm = result.scalar_one_or_none()

        if not role_orm:
            return None

        return Role(
            id=role_orm.id,
            name=role_orm.name,
            code=role_orm.code,
            description=role_orm.description,
            permissions=role_orm.permissions.split(',') if role_orm.permissions else [],
            is_active=role_orm.is_active,
            created_at=datetime.fromisoformat(role_orm.created_at),
            updated_at=datetime.fromisoformat(role_orm.updated_at)
        )

    def create_role(self, role: RoleCreate) -> Role:
        """创建新角色"""
        created_at = datetime.now()
        updated_at = created_at

        role_orm = RoleORM(
            id=str(uuid4()),
            name=role.name,
            code=role.code,
            description=role.description,
            permissions=','.join(role.permissions),
            is_active=role.is_active,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(role_orm)
        self.db.commit()
        self.db.refresh(role_orm)

        return self.get_role(role_orm.id)

    def update_role(self, role_id: str, role: RoleUpdate) -> Optional[Role]:
        """更新角色"""
        result = self.db.execute(
            select(RoleORM).where(and_(RoleORM.id == role_id, RoleORM.is_active == True))
        )
        role_orm = result.scalar_one_or_none()

        if not role_orm:
            return None

        updated_at = datetime.now()

        # Update all fields
        role_orm.name = role.name
        role_orm.code = role.code
        role_orm.description = role.description
        role_orm.permissions = ','.join(role.permissions)
        role_orm.is_active = role.is_active
        role_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(role_orm)

        return self.get_role(role_id)

    def delete_role(self, role_id: str) -> bool:
        """删除角色（软删除）"""
        result = self.db.execute(
            select(RoleORM).where(RoleORM.id == role_id)
        )
        role_orm = result.scalar_one_or_none()

        if not role_orm:
            return False

        role_orm.is_active = False
        role_orm.updated_at = datetime.now().isoformat()
        self.db.commit()
        return True

    def check_role_exists(self, code: str, exclude_id: Optional[str] = None) -> bool:
        """检查角色是否存在"""
        query = select(RoleORM).where(RoleORM.code == code)

        if exclude_id:
            query = query.where(RoleORM.id != exclude_id)

        result = self.db.execute(query)
        return result.scalar_one_or_none() is not None
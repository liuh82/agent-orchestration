from datetime import datetime
from typing import List, Optional
from uuid import uuid4
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import Session

from ..models.member import MemberCreate, MemberUpdate, Member
from ..models.orm_models import Member as MemberORM, Role as RoleORM, Department as DepartmentORM


class MemberService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_members(self, include_inactive: bool = False) -> List[Member]:
        """获取所有成员"""
        query = select(MemberORM)

        if not include_inactive:
            query = query.where(MemberORM.is_active == True)

        query = query.order_by(MemberORM.created_at.desc())
        result = self.db.execute(query)
        member_orms = result.scalars().all()

        members = []
        for member_orm in member_orms:
            member = Member(
                id=member_orm.id,
                name=member_orm.name,
                email=member_orm.email,
                phone=member_orm.phone,
                avatar=member_orm.avatar,
                department_id=member_orm.department_id,
                position=member_orm.position,
                role_ids=member_orm.role_ids.split(',') if member_orm.role_ids else [],
                is_active=member_orm.is_active,
                created_at=datetime.fromisoformat(member_orm.created_at),
                updated_at=datetime.fromisoformat(member_orm.updated_at)
            )
            members.append(member)

        return members

    def get_member(self, member_id: str) -> Optional[Member]:
        """获取单个成员"""
        result = self.db.execute(
            select(MemberORM).where(MemberORM.id == member_id)
        )
        member_orm = result.scalar_one_or_none()

        if not member_orm:
            return None

        return Member(
            id=member_orm.id,
            name=member_orm.name,
            email=member_orm.email,
            phone=member_orm.phone,
            avatar=member_orm.avatar,
            department_id=member_orm.department_id,
            position=member_orm.position,
            role_ids=member_orm.role_ids.split(',') if member_orm.role_ids else [],
            is_active=member_orm.is_active,
            created_at=datetime.fromisoformat(member_orm.created_at),
            updated_at=datetime.fromisoformat(member_orm.updated_at)
        )

    def get_member_by_email(self, email: str) -> Optional[Member]:
        """通过邮箱获取成员"""
        result = self.db.execute(
            select(MemberORM).where(MemberORM.email == email)
        )
        member_orm = result.scalar_one_or_none()

        if not member_orm:
            return None

        return Member(
            id=member_orm.id,
            name=member_orm.name,
            email=member_orm.email,
            phone=member_orm.phone,
            avatar=member_orm.avatar,
            department_id=member_orm.department_id,
            position=member_orm.position,
            role_ids=member_orm.role_ids.split(',') if member_orm.role_ids else [],
            is_active=member_orm.is_active,
            created_at=datetime.fromisoformat(member_orm.created_at),
            updated_at=datetime.fromisoformat(member_orm.updated_at)
        )

    def create_member(self, member: MemberCreate) -> Member:
        """创建新成员"""
        member_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        member_orm = MemberORM(
            id=member_id,
            name=member.name,
            email=member.email,
            phone=member.phone,
            avatar=member.avatar,
            department_id=member.department_id,
            position=member.position,
            role_ids=','.join(member.role_ids),
            is_active=member.is_active,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(member_orm)
        self.db.commit()
        self.db.refresh(member_orm)

        return self.get_member(member_id)

    def update_member(self, member_id: str, member: MemberUpdate) -> Optional[Member]:
        """更新成员"""
        existing_member = self.get_member(member_id)
        if not existing_member:
            return None

        updated_at = datetime.now()

        # Get the ORM object
        result = self.db.execute(
            select(MemberORM).where(MemberORM.id == member_id)
        )
        member_orm = result.scalar_one_or_none()

        if not member_orm:
            return None

        # Update all fields
        member_orm.name = member.name
        member_orm.email = member.email
        member_orm.phone = member.phone
        member_orm.avatar = member.avatar
        member_orm.department_id = member.department_id
        member_orm.position = member.position
        member_orm.role_ids = ','.join(member.role_ids) if member.role_ids else ''
        member_orm.is_active = member.is_active
        member_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(member_orm)

        return self.get_member(member_id)

    def delete_member(self, member_id: str) -> bool:
        """删除成员（软删除）"""
        result = self.db.execute(
            select(MemberORM).where(MemberORM.id == member_id)
        )
        member_orm = result.scalar_one_or_none()

        if not member_orm:
            return False

        member_orm.is_active = False
        member_orm.updated_at = datetime.now().isoformat()
        self.db.commit()

        return True

    def check_member_exists(self, email: str, exclude_id: Optional[str] = None) -> bool:
        """检查成员是否存在"""
        query = select(MemberORM).where(MemberORM.email == email)

        if exclude_id:
            query = query.where(MemberORM.id != exclude_id)

        result = self.db.execute(query)
        return result.scalar_one_or_none() is not None

    def get_members_by_department(self, department_id: str) -> List[Member]:
        """获取指定部门的成员"""
        result = self.db.execute(
            select(MemberORM)
            .where(
                and_(
                    MemberORM.department_id == department_id,
                    MemberORM.is_active == True
                )
            )
            .order_by(MemberORM.created_at.desc())
        )
        member_orms = result.scalars().all()

        members = []
        for member_orm in member_orms:
            member = Member(
                id=member_orm.id,
                name=member_orm.name,
                email=member_orm.email,
                phone=member_orm.phone,
                avatar=member_orm.avatar,
                department_id=member_orm.department_id,
                position=member_orm.position,
                role_ids=member_orm.role_ids.split(',') if member_orm.role_ids else [],
                is_active=member_orm.is_active,
                created_at=datetime.fromisoformat(member_orm.created_at),
                updated_at=datetime.fromisoformat(member_orm.updated_at)
            )
            members.append(member)

        return members

    def get_members_by_role(self, role_id: str) -> List[Member]:
        """获取拥有指定角色的成员"""
        result = self.db.execute(
            select(MemberORM)
            .where(
                and_(
                    MemberORM.role_ids.like(f'%{role_id}%'),
                    MemberORM.is_active == True
                )
            )
            .order_by(MemberORM.created_at.desc())
        )
        member_orms = result.scalars().all()

        members = []
        for member_orm in member_orms:
            member = Member(
                id=member_orm.id,
                name=member_orm.name,
                email=member_orm.email,
                phone=member_orm.phone,
                avatar=member_orm.avatar,
                department_id=member_orm.department_id,
                position=member_orm.position,
                role_ids=member_orm.role_ids.split(',') if member_orm.role_ids else [],
                is_active=member_orm.is_active,
                created_at=datetime.fromisoformat(member_orm.created_at),
                updated_at=datetime.fromisoformat(member_orm.updated_at)
            )
            members.append(member)

        return members
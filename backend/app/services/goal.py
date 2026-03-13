from datetime import datetime
from typing import List, Optional
from uuid import uuid4
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import Session

from ..models.goal import GoalCreate, GoalUpdate, Goal, GoalAlignmentCreate, GoalAlignment
from ..models.orm_models import Goal as GoalORM, GoalAlignment as GoalAlignmentORM, Member as MemberORM, Department as DepartmentORM


class GoalService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_goals(self, include_inactive: bool = False) -> List[Goal]:
        """获取所有目标"""
        query = select(GoalORM)

        query = query.order_by(GoalORM.created_at.desc())
        result = self.db.execute(query)
        goal_orms = result.scalars().all()

        goals = []
        for goal_orm in goal_orms:
            goal = Goal(
                id=goal_orm.id,
                title=goal_orm.title,
                description=goal_orm.description,
                type=goal_orm.type or 'objective',
                priority=goal_orm.priority or 'medium',
                status=goal_orm.status or 'active',
                owner_id=goal_orm.owner_id,
                department_id=goal_orm.department_id,
                due_date=datetime.fromisoformat(goal_orm.target_date) if goal_orm.target_date else None,
                progress=goal_orm.progress_percentage or 0,
                tags=goal_orm.tags.split(',') if goal_orm.tags else [],
                metrics=goal_orm.metrics.split(',') if goal_orm.metrics else [],
                created_at=datetime.fromisoformat(goal_orm.created_at),
                updated_at=datetime.fromisoformat(goal_orm.updated_at)
            )
            goals.append(goal)

        return goals

    def get_goal(self, goal_id: str) -> Optional[Goal]:
        """获取单个目标"""
        result = self.db.execute(
            select(GoalORM).where(GoalORM.id == goal_id)
        )
        goal_orm = result.scalar_one_or_none()

        if not goal_orm:
            return None

        return Goal(
            id=goal_orm.id,
            title=goal_orm.title,
            description=goal_orm.description,
            type=goal_orm.type or 'objective',
            priority=goal_orm.priority or 'medium',
            status=goal_orm.status or 'active',
            owner_id=goal_orm.owner_id,
            department_id=goal_orm.department_id,
            due_date=datetime.fromisoformat(goal_orm.target_date) if goal_orm.target_date else None,
            progress=goal_orm.progress_percentage or 0,
            tags=goal_orm.tags.split(',') if goal_orm.tags else [],
            metrics=goal_orm.metrics.split(',') if goal_orm.metrics else [],
            created_at=datetime.fromisoformat(goal_orm.created_at),
            updated_at=datetime.fromisoformat(goal_orm.updated_at)
        )

    def create_goal(self, goal: GoalCreate) -> Goal:
        """创建新目标"""
        goal_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        goal_orm = GoalORM(
            id=goal_id,
            title=goal.title,
            description=goal.description,
            type=goal.type,
            priority=goal.priority,
            status=goal.status,
            owner_id=goal.owner_id,
            department_id=goal.department_id,
            target_date=goal.due_date.isoformat() if goal.due_date else None,
            progress_percentage=goal.progress,
            tags=','.join(goal.tags),
            metrics=','.join(goal.metrics),
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(goal_orm)
        self.db.commit()
        self.db.refresh(goal_orm)

        return self.get_goal(goal_id)

    def update_goal(self, goal_id: str, goal: GoalUpdate) -> Optional[Goal]:
        """更新目标"""
        existing_goal = self.get_goal(goal_id)
        if not existing_goal:
            return None

        updated_at = datetime.now()

        # Get the ORM object
        result = self.db.execute(
            select(GoalORM).where(GoalORM.id == goal_id)
        )
        goal_orm = result.scalar_one_or_none()

        if not goal_orm:
            return None

        # Update all fields
        goal_orm.title = goal.title
        goal_orm.description = goal.description
        goal_orm.type = goal.type
        goal_orm.priority = goal.priority
        goal_orm.status = goal.status
        goal_orm.owner_id = goal.owner_id
        goal_orm.department_id = goal.department_id
        goal_orm.target_date = goal.due_date.isoformat() if goal.due_date else None
        goal_orm.progress_percentage = goal.progress
        goal_orm.tags = ','.join(goal.tags) if goal.tags else ''
        goal_orm.metrics = ','.join(goal.metrics) if goal.metrics else ''
        goal_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(goal_orm)

        return self.get_goal(goal_id)

    def delete_goal(self, goal_id: str) -> bool:
        """删除目标"""
        result = self.db.execute(
            select(GoalORM).where(GoalORM.id == goal_id)
        )
        goal_orm = result.scalar_one_or_none()

        if not goal_orm:
            return False

        self.db.delete(goal_orm)
        self.db.commit()

        return True

    def get_goals_by_owner(self, owner_id: str) -> List[Goal]:
        """获取指定所有者的目标"""
        result = self.db.execute(
            select(GoalORM)
            .where(GoalORM.owner_id == owner_id)
            .order_by(GoalORM.created_at.desc())
        )
        goal_orms = result.scalars().all()

        goals = []
        for goal_orm in goal_orms:
            goal = Goal(
                id=goal_orm.id,
                title=goal_orm.title,
                description=goal_orm.description,
                type=goal_orm.type or 'objective',
                priority=goal_orm.priority or 'medium',
                status=goal_orm.status or 'active',
                owner_id=goal_orm.owner_id,
                department_id=goal_orm.department_id,
                due_date=datetime.fromisoformat(goal_orm.target_date) if goal_orm.target_date else None,
                progress=goal_orm.progress_percentage or 0,
                tags=goal_orm.tags.split(',') if goal_orm.tags else [],
                metrics=goal_orm.metrics.split(',') if goal_orm.metrics else [],
                created_at=datetime.fromisoformat(goal_orm.created_at),
                updated_at=datetime.fromisoformat(goal_orm.updated_at)
            )
            goals.append(goal)

        return goals

    def get_goals_by_department(self, department_id: str) -> List[Goal]:
        """获取指定部门的目标"""
        result = self.db.execute(
            select(GoalORM)
            .where(GoalORM.department_id == department_id)
            .order_by(GoalORM.created_at.desc())
        )
        goal_orms = result.scalars().all()

        goals = []
        for goal_orm in goal_orms:
            goal = Goal(
                id=goal_orm.id,
                title=goal_orm.title,
                description=goal_orm.description,
                type=goal_orm.type or 'objective',
                priority=goal_orm.priority or 'medium',
                status=goal_orm.status or 'active',
                owner_id=goal_orm.owner_id,
                department_id=goal_orm.department_id,
                due_date=datetime.fromisoformat(goal_orm.target_date) if goal_orm.target_date else None,
                progress=goal_orm.progress_percentage or 0,
                tags=goal_orm.tags.split(',') if goal_orm.tags else [],
                metrics=goal_orm.metrics.split(',') if goal_orm.metrics else [],
                created_at=datetime.fromisoformat(goal_orm.created_at),
                updated_at=datetime.fromisoformat(goal_orm.updated_at)
            )
            goals.append(goal)

        return goals

    # Goal Alignment Methods
    def create_goal_alignment(self, alignment: GoalAlignmentCreate) -> GoalAlignment:
        """创建目标对齐关系"""
        alignment_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        alignment_orm = GoalAlignmentORM(
            id=alignment_id,
            parent_id=alignment.parent_id,
            child_id=alignment.child_id,
            weight=alignment.weight,
            alignment_type=alignment.alignment_type or 'supports',
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(alignment_orm)
        self.db.commit()
        self.db.refresh(alignment_orm)

        return GoalAlignment(
            id=alignment_id,
            parent_id=alignment.parent_id,
            child_id=alignment.child_id,
            weight=alignment.weight,
            description=alignment.description,
            created_at=created_at,
            updated_at=updated_at
        )

    def get_goal_alignments(self, parent_id: Optional[str] = None, child_id: Optional[str] = None) -> List[GoalAlignment]:
        """获取目标对齐关系"""
        query = select(GoalAlignmentORM)

        conditions = []
        if parent_id:
            conditions.append(GoalAlignmentORM.parent_id == parent_id)
        if child_id:
            conditions.append(GoalAlignmentORM.child_id == child_id)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(GoalAlignmentORM.created_at.desc())
        result = self.db.execute(query)
        alignment_orms = result.scalars().all()

        alignments = []
        for alignment_orm in alignment_orms:
            alignment = GoalAlignment(
                id=alignment_orm.id,
                parent_id=alignment_orm.parent_id,
                child_id=alignment_orm.child_id,
                weight=alignment_orm.weight,
                description=alignment_orm.description,
                created_at=datetime.fromisoformat(alignment_orm.created_at),
                updated_at=datetime.fromisoformat(alignment_orm.updated_at)
            )
            alignments.append(alignment)

        return alignments

    def delete_goal_alignment(self, alignment_id: str) -> bool:
        """删除目标对齐关系"""
        result = self.db.execute(
            select(GoalAlignmentORM).where(GoalAlignmentORM.id == alignment_id)
        )
        alignment_orm = result.scalar_one_or_none()

        if not alignment_orm:
            return False

        self.db.delete(alignment_orm)
        self.db.commit()

        return True

    def get_goal_hierarchy(self, goal_id: str) -> dict:
        """获取目标层级结构"""
        goal = self.get_goal(goal_id)
        if not goal:
            return {}

        # Get all alignments
        alignments = self.get_goal_alignments()

        # Build hierarchy
        hierarchy = {
            'goal': goal,
            'children': [],
            'parents': []
        }

        # Find children goals
        for alignment in alignments:
            if alignment.parent_id == goal_id:
                child_goal = self.get_goal(alignment.child_id)
                if child_goal:
                    hierarchy['children'].append({
                        'goal': child_goal,
                        'weight': alignment.weight,
                        'description': alignment.description
                    })

        # Find parent goals
        for alignment in alignments:
            if alignment.child_id == goal_id:
                parent_goal = self.get_goal(alignment.parent_id)
                if parent_goal:
                    hierarchy['parents'].append({
                        'goal': parent_goal,
                        'weight': alignment.weight,
                        'description': alignment.description
                    })

        return hierarchy
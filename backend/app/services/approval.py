from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, update, delete, and_, or_, desc
from sqlalchemy.orm import Session

from ..models.approval import (
    ApprovalCreate, ApprovalUpdate, Approval, ApprovalHistory,
    ApprovalStatus, ApprovalType
)
from ..models.orm_models import Approval as ApprovalORM, ApprovalHistory as ApprovalHistoryORM


def _escape_like(s: str) -> str:
    """转义 LIKE 查询中的特殊字符（% 和 _）"""
    return s.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


class ApprovalService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_approvals(self, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取所有审批"""
        query = select(ApprovalORM)

        if status:
            query = query.where(ApprovalORM.status == status.value)

        query = query.order_by(desc(ApprovalORM.created_at))
        result = self.db.execute(query)
        approval_orms = result.scalars().all()

        approvals = []
        for approval_orm in approval_orms:
            approval = self._build_approval_from_orm(approval_orm)
            approval.approval_history = self.get_approval_history(approval_orm.id)
            approvals.append(approval)

        return approvals

    def get_approval(self, approval_id: str) -> Optional[Approval]:
        """获取单个审批"""
        result = self.db.execute(
            select(ApprovalORM).where(ApprovalORM.id == approval_id)
        )
        approval_orm = result.scalar_one_or_none()

        if not approval_orm:
            return None

        approval = self._build_approval_from_orm(approval_orm)
        approval.approval_history = self.get_approval_history(approval_id)
        return approval

    def create_approval(self, approval: ApprovalCreate) -> Approval:
        """创建新审批"""
        approval_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        approval_orm = ApprovalORM(
            id=approval_id,
            title=approval.title,
            type=approval.type,
            content=approval.content,
            requester_id=approval.requester_id,
            approver_ids=','.join(approval.approver_ids),
            status=approval.status.value,
            priority=approval.priority,
            due_date=approval.due_date.isoformat() if approval.due_date else None,
            metadata_=approval.metadata,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(approval_orm)
        self.db.commit()
        self.db.refresh(approval_orm)

        # Create initial history record
        self._log_approval_action(
            approval_id, 'create', approval.requester_id,
            'System', None, approval.status
        )

        return self.get_approval(approval_id)

    def update_approval(self, approval_id: str, approval: ApprovalUpdate) -> Optional[Approval]:
        """更新审批"""
        approval_obj = self.get_approval(approval_id)
        if not approval_obj:
            return None

        result = self.db.execute(
            select(ApprovalORM).where(ApprovalORM.id == approval_id)
        )
        approval_orm = result.scalar_one_or_none()

        if not approval_orm:
            return None

        updated_at = datetime.now()

        if approval.title:
            approval_orm.title = approval.title
        if approval.type:
            approval_orm.type = approval.type
        if approval.content:
            approval_orm.content = approval.content
        if approval.requester_id:
            approval_orm.requester_id = approval.requester_id
        if approval.approver_ids:
            approval_orm.approver_ids = ','.join(approval.approver_ids)
        if approval.status:
            approval_orm.status = approval.status.value
        if approval.priority:
            approval_orm.priority = approval.priority
        if approval.due_date is not None:
            approval_orm.due_date = approval.due_date.isoformat() if approval.due_date else None
        if approval.metadata is not None:
            approval_orm.metadata_ = approval.metadata
        approval_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(approval_orm)

        return self.get_approval(approval_id)

    def update_approval_status(self, approval_id: str, status: ApprovalStatus,
                               actor_id: str, actor_name: str,
                               comment: Optional[str] = None) -> Optional[Approval]:
        """更新审批状态"""
        approval = self.get_approval(approval_id)
        if not approval:
            return None

        # Update approval status
        updated_at = datetime.now()
        result = self.db.execute(
            update(ApprovalORM)
            .where(ApprovalORM.id == approval_id)
            .values(status=status.value, updated_at=updated_at.isoformat())
        )
        self.db.commit()

        # Log action
        self._log_approval_action(
            approval_id, 'update', actor_id, actor_name,
            comment, status
        )

        return self.get_approval(approval_id)

    def delete_approval(self, approval_id: str) -> bool:
        """删除审批"""
        result = self.db.execute(
            select(ApprovalORM).where(ApprovalORM.id == approval_id)
        )
        approval_orm = result.scalar_one_or_none()

        if not approval_orm:
            return False

        self.db.delete(approval_orm)
        self.db.commit()

        return True

    def get_approvals_by_requester(self, requester_id: str, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取指定申请人的审批"""
        query = select(ApprovalORM).where(ApprovalORM.requester_id == requester_id)

        if status:
            query = query.where(ApprovalORM.status == status.value)

        query = query.order_by(desc(ApprovalORM.created_at))
        result = self.db.execute(query)
        approval_orms = result.scalars().all()

        approvals = []
        for approval_orm in approval_orms:
            approval = self._build_approval_from_orm(approval_orm)
            approval.approval_history = self.get_approval_history(approval_orm.id)
            approvals.append(approval)

        return approvals

    def get_approvals_by_approver(self, approver_id: str, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取指定审批人的审批"""
        escaped = _escape_like(approver_id)
        query = select(ApprovalORM).where(ApprovalORM.approver_ids.like(f'%{escaped}%', escape='\\'))

        if status:
            query = query.where(ApprovalORM.status == status.value)

        query = query.order_by(desc(ApprovalORM.created_at))
        result = self.db.execute(query)
        approval_orms = result.scalars().all()

        approvals = []
        for approval_orm in approval_orms:
            approval = self._build_approval_from_orm(approval_orm)
            approval.approval_history = self.get_approval_history(approval_orm.id)
            approvals.append(approval)

        return approvals

    def get_pending_approvals(self, approver_id: str) -> List[Approval]:
        """获取待处理的审批"""
        return self.get_approvals_by_approver(approver_id, ApprovalStatus.PENDING)

    def get_approval_history(self, approval_id: str) -> List[ApprovalHistory]:
        """获取审批历史"""
        result = self.db.execute(
            select(ApprovalHistoryORM)
            .where(ApprovalHistoryORM.approval_id == approval_id)
            .order_by(desc(ApprovalHistoryORM.created_at))
        )
        history_orms = result.scalars().all()

        histories = []
        for history_orm in history_orms:
            history = ApprovalHistory(
                id=history_orm.id,
                approval_id=history_orm.approval_id,
                action=history_orm.action,
                actor_id=history_orm.actor_id,
                actor_name=history_orm.actor_name,
                comment=history_orm.comment,
                status=ApprovalStatus(history_orm.status),
                created_at=datetime.fromisoformat(history_orm.created_at)
            )
            histories.append(history)

        return histories

    def _build_approval_from_orm(self, approval_orm: ApprovalORM) -> Approval:
        """从ORM对象构建审批对象"""
        return Approval(
            id=approval_orm.id,
            title=approval_orm.title,
            type=ApprovalType(approval_orm.type),
            content=approval_orm.content or '',
            requester_id=approval_orm.requester_id,
            approver_ids=approval_orm.approver_ids.split(',') if approval_orm.approver_ids else [],
            status=ApprovalStatus(approval_orm.status),
            priority=approval_orm.priority,
            due_date=datetime.fromisoformat(approval_orm.due_date) if approval_orm.due_date else None,
            metadata=approval_orm.metadata_,
            created_at=datetime.fromisoformat(approval_orm.created_at),
            updated_at=datetime.fromisoformat(approval_orm.updated_at),
            approval_history=[]
        )

    def _log_approval_action(self, approval_id: str, action: str, actor_id: str,
                            actor_name: str, comment: Optional[str], status: ApprovalStatus):
        """记录审批操作历史"""
        history_id = str(uuid4())
        created_at = datetime.now()

        history_orm = ApprovalHistoryORM(
            id=history_id,
            approval_id=approval_id,
            action=action,
            actor_id=actor_id,
            actor_name=actor_name,
            comment=comment,
            status=status.value,
            created_at=created_at.isoformat()
        )

        self.db.add(history_orm)
        self.db.commit()

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4
import json

from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import Session

from ..models.audit_log import (
    AuditLogCreate, AuditLog, AuditLogType, AuditLogAction,
    AuditLogListResponse
)
from ..models.orm_models import AuditLog as AuditLogORM


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def create_audit_log(self, audit_log: AuditLogCreate) -> AuditLog:
        """创建审计日志"""
        audit_id = str(uuid4())
        created_at = datetime.now()

        # Store all fields as JSON in details column
        details_dict = {
            "type": audit_log.type.value,
            "user_name": audit_log.user_name,
            "department_id": audit_log.department_id,
            "request_data": audit_log.request_data,
            "response_data": audit_log.response_data,
            "status_code": audit_log.status_code,
            "error_message": audit_log.error_message,
            "duration_ms": audit_log.duration_ms,
            "metadata": audit_log.metadata,
        }

        audit_log_orm = AuditLogORM(
            id=audit_id,
            member_id=audit_log.user_id,
            action=audit_log.action.value,
            resource_type=audit_log.resource_type,
            resource_id=audit_log.resource_id,
            details=json.dumps(details_dict),
            ip_address=audit_log.ip_address,
            user_agent=audit_log.user_agent,
            created_at=created_at.isoformat()
        )

        self.db.add(audit_log_orm)
        self.db.commit()
        self.db.refresh(audit_log_orm)

        return self.get_audit_log(audit_id)

    def get_audit_log(self, audit_id: str) -> Optional[AuditLog]:
        """获取单条审计日志"""
        result = self.db.execute(
            select(AuditLogORM).where(AuditLogORM.id == audit_id)
        )
        audit_log_orm = result.scalar_one_or_none()

        if not audit_log_orm:
            return None

        return self._orm_to_model(audit_log_orm)

    def _orm_to_model(self, audit_log_orm: AuditLogORM) -> AuditLog:
        """Convert ORM to Pydantic model"""
        details_dict = {}
        if audit_log_orm.details:
            try:
                details_dict = json.loads(audit_log_orm.details)
            except (json.JSONDecodeError, TypeError):
                details_dict = {}

        return AuditLog(
            id=audit_log_orm.id,
            type=AuditLogType(details_dict.get("type", "read")),
            action=AuditLogAction(audit_log_orm.action),
            resource_type=audit_log_orm.resource_type,
            resource_id=audit_log_orm.resource_id,
            user_id=audit_log_orm.member_id or "",
            user_name=details_dict.get("user_name", ""),
            department_id=details_dict.get("department_id"),
            ip_address=audit_log_orm.ip_address,
            user_agent=audit_log_orm.user_agent,
            request_data=details_dict.get("request_data"),
            response_data=details_dict.get("response_data"),
            status_code=details_dict.get("status_code", 200),
            error_message=details_dict.get("error_message"),
            duration_ms=details_dict.get("duration_ms"),
            metadata=details_dict.get("metadata"),
            created_at=datetime.fromisoformat(audit_log_orm.created_at)
        )

    def get_audit_logs(self, page: int = 1, page_size: int = 50,
                       start_time: Optional[datetime] = None,
                       end_time: Optional[datetime] = None,
                       user_id: Optional[str] = None,
                       resource_type: Optional[str] = None,
                       action: Optional[AuditLogAction] = None,
                       status_code: Optional[int] = None) -> AuditLogListResponse:
        """获取审计日志列表"""
        # Build query conditions
        conditions = []

        if start_time:
            conditions.append(AuditLogORM.created_at >= start_time.isoformat())
        if end_time:
            conditions.append(AuditLogORM.created_at <= end_time.isoformat())
        if user_id:
            conditions.append(AuditLogORM.member_id == user_id)
        if resource_type:
            conditions.append(AuditLogORM.resource_type == resource_type)
        if action:
            conditions.append(AuditLogORM.action == action.value)

        # Count total
        count_query = select(func.count(AuditLogORM.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))

        total_result = self.db.execute(count_query)
        total = total_result.scalar()

        # Get logs
        query = select(AuditLogORM).order_by(AuditLogORM.created_at.desc())
        if conditions:
            query = query.where(and_(*conditions))

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = self.db.execute(query)
        audit_log_orms = result.scalars().all()

        logs = [self._orm_to_model(audit_log_orm) for audit_log_orm in audit_log_orms]

        return AuditLogListResponse(
            success=True,
            data=logs,
            pagination={
                'page': page,
                'page_size': page_size,
                'total': total
            },
            message="Audit logs retrieved successfully"
        )

    def get_audit_logs_by_user(self, user_id: str, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定用户的审计日志"""
        return self.get_audit_logs(
            page=page,
            page_size=page_size,
            user_id=user_id
        )

    def get_audit_logs_by_resource(self, resource_type: str, resource_id: str, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定资源的审计日志"""
        conditions = [AuditLogORM.resource_type == resource_type, AuditLogORM.resource_id == resource_id]

        # Count total
        count_query = select(func.count(AuditLogORM.id)).where(and_(*conditions))
        total = self.db.execute(count_query).scalar()

        # Get logs
        query = select(AuditLogORM).where(and_(*conditions)).order_by(AuditLogORM.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = self.db.execute(query)
        audit_log_orms = result.scalars().all()

        logs = [self._orm_to_model(audit_log_orm) for audit_log_orm in audit_log_orms]

        return AuditLogListResponse(
            success=True,
            data=logs,
            pagination={
                'page': page,
                'page_size': page_size,
                'total': total
            },
            message="Audit logs retrieved successfully"
        )

    def get_audit_logs_by_action(self, action: AuditLogAction, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定操作的审计日志"""
        return self.get_audit_logs(
            page=page,
            page_size=page_size,
            action=action
        )

    def get_audit_summary(self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> dict:
        """获取审计摘要统计"""
        # Build query conditions
        conditions = []
        if start_time:
            conditions.append(AuditLogORM.created_at >= start_time.isoformat())
        if end_time:
            conditions.append(AuditLogORM.created_at <= end_time.isoformat())

        # Get total logs count
        count_query = select(func.count(AuditLogORM.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_logs = self.db.execute(count_query).scalar()

        # Get user activity count
        unique_users_query = select(func.count(func.distinct(AuditLogORM.member_id)))
        if conditions:
            unique_users_query = unique_users_query.where(and_(*conditions))
        unique_users = self.db.execute(unique_users_query).scalar()

        # Get top actions
        top_actions_query = (
            select(AuditLogORM.action, func.count().label('count'))
            .group_by(AuditLogORM.action)
            .order_by(func.count().desc())
            .limit(10)
        )
        if conditions:
            top_actions_query = top_actions_query.where(and_(*conditions))
        top_actions_result = self.db.execute(top_actions_query).all()

        return {
            'total_logs': total_logs,
            'unique_users': unique_users,
            'top_actions': [{'action': action, 'count': count} for action, count in top_actions_result]
        }

    def clean_old_logs(self, days_to_keep: int = 365) -> int:
        """清理旧的审计日志"""
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)

        query = delete(AuditLogORM).where(AuditLogORM.created_at < cutoff_date.isoformat())
        result = self.db.execute(query)
        self.db.commit()

        return result.rowcount

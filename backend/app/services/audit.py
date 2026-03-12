import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from ..models.audit_log import (
    AuditLogCreate, AuditLog, AuditLogType, AuditLogAction,
    AuditLogListResponse
)


class AuditService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Audit logs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                department_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                request_data TEXT,  -- JSON string
                response_data TEXT,  -- JSON string
                status_code INTEGER NOT NULL,
                error_message TEXT,
                duration_ms INTEGER,
                metadata TEXT,  -- JSON string
                created_at TEXT NOT NULL
            )
        ''')

        # Index for user_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)
        ''')

        # Index for resource_type
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs (resource_type)
        ''')

        # Index for created_at
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)
        ''')

        # Composite index for resource_type + resource_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id)
        ''')

        self.conn.commit()

    async def create_audit_log(self, audit_log: AuditLogCreate) -> AuditLog:
        """创建审计日志"""
        audit_id = str(uuid4())
        created_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO audit_logs (
                id, type, action, resource_type, resource_id, user_id, user_name,
                department_id, ip_address, user_agent, request_data, response_data,
                status_code, error_message, duration_ms, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            audit_id,
            audit_log.type,
            audit_log.action,
            audit_log.resource_type,
            audit_log.resource_id,
            audit_log.user_id,
            audit_log.user_name,
            audit_log.department_id,
            audit_log.ip_address,
            audit_log.user_agent,
            audit_log.request_data,
            audit_log.response_data,
            audit_log.status_code,
            audit_log.error_message,
            audit_log.duration_ms,
            audit_log.metadata,
            created_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_audit_log(audit_id)

    async def get_audit_log(self, audit_id: str) -> Optional[AuditLog]:
        """获取单条审计日志"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM audit_logs WHERE id = ?', (audit_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return AuditLog(
            id=row[0],
            type=row[1],
            action=row[2],
            resource_type=row[3],
            resource_id=row[4],
            user_id=row[5],
            user_name=row[6],
            department_id=row[7],
            ip_address=row[8],
            user_agent=row[9],
            request_data=row[10],
            response_data=row[11],
            status_code=row[12],
            error_message=row[13],
            duration_ms=row[14],
            metadata=row[15],
            created_at=datetime.fromisoformat(row[16])
        )

    async def get_audit_logs(self, page: int = 1, page_size: int = 50,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None,
                           user_id: Optional[str] = None,
                           resource_type: Optional[str] = None,
                           action: Optional[AuditLogAction] = None,
                           status_code: Optional[int] = None) -> AuditLogListResponse:
        """获取审计日志列表"""
        cursor = self.conn.cursor()

        # Count total
        count_query = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1'
        count_params = []

        # Build where clause
        where_clause = []
        where_params = []

        if start_time:
            where_clause.append('created_at >= ?')
            where_params.append(start_time.isoformat())
            count_params.append(start_time.isoformat())

        if end_time:
            where_clause.append('created_at <= ?')
            where_params.append(end_time.isoformat())
            count_params.append(end_time.isoformat())

        if user_id:
            where_clause.append('user_id = ?')
            where_params.append(user_id)
            count_params.append(user_id)

        if resource_type:
            where_clause.append('resource_type = ?')
            where_params.append(resource_type)
            count_params.append(resource_type)

        if action:
            where_clause.append('action = ?')
            where_params.append(action.value)
            count_params.append(action.value)

        if status_code:
            where_clause.append('status_code = ?')
            where_params.append(status_code)
            count_params.append(status_code)

        if where_clause:
            count_query += ' AND ' + ' AND '.join(where_clause)

        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]

        # Get logs
        query = 'SELECT * FROM audit_logs WHERE 1=1'
        params = list(where_params)

        if where_clause:
            query += ' AND ' + ' AND '.join(where_clause)

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.extend([page_size, (page - 1) * page_size])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        logs = []
        for row in rows:
            log = AuditLog(
                id=row[0],
                type=row[1],
                action=row[2],
                resource_type=row[3],
                resource_id=row[4],
                user_id=row[5],
                user_name=row[6],
                department_id=row[7],
                ip_address=row[8],
                user_agent=row[9],
                request_data=row[10],
                response_data=row[11],
                status_code=row[12],
                error_message=row[13],
                duration_ms=row[14],
                metadata=row[15],
                created_at=datetime.fromisoformat(row[16])
            )
            logs.append(log)

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

    async def get_audit_logs_by_user(self, user_id: str, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定用户的审计日志"""
        return await self.get_audit_logs(
            page=page,
            page_size=page_size,
            user_id=user_id
        )

    async def get_audit_logs_by_resource(self, resource_type: str, resource_id: str, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定资源的审计日志"""
        return await self.get_audit_logs(
            page=page,
            page_size=page_size,
            resource_type=resource_type,
            resource_id=resource_id
        )

    async def get_audit_logs_by_action(self, action: AuditLogAction, page: int = 1, page_size: int = 50) -> AuditLogListResponse:
        """获取指定操作的审计日志"""
        return await self.get_audit_logs(
            page=page,
            page_size=page_size,
            action=action
        )

    async def get_audit_summary(self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> dict:
        """获取审计摘要统计"""
        cursor = self.conn.cursor()

        # Build where clause
        where_clause = []
        where_params = []

        if start_time:
            where_clause.append('created_at >= ?')
            where_params.append(start_time.isoformat())

        if end_time:
            where_clause.append('created_at <= ?')
            where_params.append(end_time.isoformat())

        where_clause_str = ''
        params = []
        if where_clause:
            where_clause_str = 'WHERE ' + ' AND '.join(where_clause)
            params = where_params

        # Get total logs count
        cursor.execute(f'SELECT COUNT(*) FROM audit_logs {where_clause_str}', params)
        total_logs = cursor.fetchone()[0]

        # Get user activity count
        cursor.execute(f'SELECT COUNT(DISTINCT user_id) FROM audit_logs {where_clause_str}', params)
        unique_users = cursor.fetchone()[0]

        # Get top actions
        cursor.execute(f'''
            SELECT action, COUNT(*) as count
            FROM audit_logs {where_clause_str}
            GROUP BY action
            ORDER BY count DESC
            LIMIT 10
        ''', params)
        top_actions = cursor.fetchall()

        # Get error count
        cursor.execute(f'''
            SELECT COUNT(*) FROM audit_logs {where_clause_str}
            WHERE status_code >= 400
        ''', params)
        error_count = cursor.fetchone()[0]

        # Get success rate
        success_rate = ((total_logs - error_count) / total_logs * 100) if total_logs > 0 else 0

        return {
            'total_logs': total_logs,
            'unique_users': unique_users,
            'top_actions': [{'action': action, 'count': count} for action, count in top_actions],
            'error_count': error_count,
            'success_rate': round(success_rate, 2)
        }

    async def clean_old_logs(self, days_to_keep: int = 365) -> int:
        """清理旧的审计日志"""
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)

        cursor = self.conn.cursor()
        cursor.execute('''
            DELETE FROM audit_logs
            WHERE created_at < ?
        ''', (cutoff_date.isoformat(),))

        deleted_count = cursor.rowcount
        self.conn.commit()

        return deleted_count
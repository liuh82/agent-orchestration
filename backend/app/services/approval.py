import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.approval import (
    ApprovalCreate, ApprovalUpdate, Approval, ApprovalHistory,
    ApprovalStatus, ApprovalType
)


class ApprovalService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Approvals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                approver_ids TEXT NOT NULL,  -- JSON string
                status TEXT NOT NULL DEFAULT 'pending',
                priority TEXT NOT NULL DEFAULT 'medium',
                due_date TEXT,
                metadata TEXT,  -- JSON string
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')

        # Approval history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS approval_history (
                id TEXT PRIMARY KEY,
                approval_id TEXT NOT NULL,
                action TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                actor_name TEXT NOT NULL,
                comment TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (approval_id) REFERENCES approvals (id)
            )
        ''')

        # Index for requester_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_approvals_requester_id ON approvals (requester_id)
        ''')

        # Index for approver_ids (partial index)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals (status)
        ''')

        # Index for approval history
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_approval_history_approval_id ON approval_history (approval_id)
        ''')

        self.conn.commit()

    async def get_all_approvals(self, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取所有审批"""
        cursor = self.conn.cursor()

        query = 'SELECT * FROM approvals'
        params = []

        if status:
            query += ' WHERE status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        approvals = []
        for row in rows:
            approval = await self._build_approval_from_row(row)
            approval.approval_history = await self.get_approval_history(row[0])
            approvals.append(approval)

        return approvals

    async def get_approval(self, approval_id: str) -> Optional[Approval]:
        """获取单个审批"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM approvals WHERE id = ?', (approval_id,))
        row = cursor.fetchone()

        if not row:
            return None

        approval = await self._build_approval_from_row(row)
        approval.approval_history = await self.get_approval_history(approval_id)
        return approval

    async def create_approval(self, approval: ApprovalCreate) -> Approval:
        """创建新审批"""
        approval_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO approvals (
                id, title, type, content, requester_id, approver_ids,
                status, priority, due_date, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            approval_id,
            approval.title,
            approval.type,
            approval.content,
            approval.requester_id,
            ','.join(approval.approver_ids),
            approval.status,
            approval.priority,
            approval.due_date.isoformat() if approval.due_date else None,
            approval.metadata,
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        # Create initial history record
        await self._log_approval_action(
            approval_id, 'create', approval.requester_id,
            'System', None, approval.status
        )

        return await self.get_approval(approval_id)

    async def update_approval(self, approval_id: str, approval: ApprovalUpdate) -> Optional[Approval]:
        """更新审批"""
        existing_approval = await self.get_approval(approval_id)
        if not existing_approval:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE approvals
            SET title = ?, type = ?, content = ?, requester_id = ?,
                approver_ids = ?, status = ?, priority = ?, due_date = ?,
                metadata = ?, updated_at = ?
            WHERE id = ?
        ''', (
            approval.title,
            approval.type,
            approval.content,
            approval.requester_id,
            ','.join(approval.approver_ids),
            approval.status,
            approval.priority,
            approval.due_date.isoformat() if approval.due_date else None,
            approval.metadata,
            updated_at.isoformat(),
            approval_id
        ))
        self.conn.commit()

        return await self.get_approval(approval_id)

    async def update_approval_status(self, approval_id: str, status: ApprovalStatus,
                                   actor_id: str, actor_name: str,
                                   comment: Optional[str] = None) -> Optional[Approval]:
        """更新审批状态"""
        approval = await self.get_approval(approval_id)
        if not approval:
            return None

        # Update approval status
        updated_at = datetime.now()
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE approvals
            SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (status.value, updated_at.isoformat(), approval_id))
        self.conn.commit()

        # Log the action
        await self._log_approval_action(
            approval_id, 'update', actor_id, actor_name,
            comment, status
        )

        return await self.get_approval(approval_id)

    async def delete_approval(self, approval_id: str) -> bool:
        """删除审批"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM approvals WHERE id = ?', (approval_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def get_approvals_by_requester(self, requester_id: str, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取指定申请人的审批"""
        cursor = self.conn.cursor()
        query = 'SELECT * FROM approvals WHERE requester_id = ?'
        params = [requester_id]

        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        approvals = []
        for row in rows:
            approval = await self._build_approval_from_row(row)
            approval.approval_history = await self.get_approval_history(row[0])
            approvals.append(approval)

        return approvals

    async def get_approvals_by_approver(self, approver_id: str, status: Optional[ApprovalStatus] = None) -> List[Approval]:
        """获取指定审批人的审批"""
        cursor = self.conn.cursor()
        query = 'SELECT * FROM approvals WHERE approver_ids LIKE ?'
        params = [f'%{approver_id}%']

        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        approvals = []
        for row in rows:
            approval = await self._build_approval_from_row(row)
            approval.approval_history = await self.get_approval_history(row[0])
            approvals.append(approval)

        return approvals

    async def get_pending_approvals(self, approver_id: str) -> List[Approval]:
        """获取待处理的审批"""
        return await self.get_approvals_by_approver(approver_id, ApprovalStatus.PENDING)

    async def get_approval_history(self, approval_id: str) -> List[ApprovalHistory]:
        """获取审批历史"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM approval_history
            WHERE approval_id = ?
            ORDER BY created_at DESC
        ''', (approval_id,))

        rows = cursor.fetchall()
        histories = []
        for row in rows:
            history = ApprovalHistory(
                id=row[0],
                approval_id=row[1],
                action=row[2],
                actor_id=row[3],
                actor_name=row[4],
                comment=row[5],
                status=row[6],
                created_at=datetime.fromisoformat(row[7])
            )
            histories.append(history)

        return histories

    async def _build_approval_from_row(self, row) -> Approval:
        """从数据库行构建审批对象"""
        return Approval(
            id=row[0],
            title=row[1],
            type=row[2],
            content=row[3],
            requester_id=row[4],
            approver_ids=row[5].split(',') if row[5] else [],
            status=row[6],
            priority=row[7],
            due_date=datetime.fromisoformat(row[8]) if row[8] else None,
            metadata=row[9],
            created_at=datetime.fromisoformat(row[10]),
            updated_at=datetime.fromisoformat(row[11]),
            approval_history=[]
        )

    async def _log_approval_action(self, approval_id: str, action: str, actor_id: str,
                                actor_name: str, comment: Optional[str], status: ApprovalStatus):
        """记录审批操作历史"""
        history_id = str(uuid4())
        created_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO approval_history (
                id, approval_id, action, actor_id, actor_name, comment, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            history_id,
            approval_id,
            action,
            actor_id,
            actor_name,
            comment,
            status.value,
            created_at.isoformat()
        ))
        self.conn.commit()
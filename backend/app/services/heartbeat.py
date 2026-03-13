import asyncio
import os
import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional

from ..models.heartbeat import Heartbeat, HeartbeatCreate, HeartbeatUpdate
from ..models.heartbeat_log import HeartbeatLog, HeartbeatLogCreate, HeartbeatLogStatus

# 允许更新的字段白名单
HEARTBEAT_UPDATE_FIELDS = {
    "name", "description", "action_type", "action_params",
    "interval_seconds", "is_active", "last_run_at", "next_run_at"
}

HEARTBEAT_LOG_UPDATE_FIELDS = {
    "status", "result", "error_message", "completed_at"
}


def _validate_field_name(field_name: str) -> bool:
    """Validate field name to prevent SQL injection"""
    if not field_name:
        return False
    # Only allow alphanumeric characters and underscores
    return bool(field_name.replace("_", "").isalnum())


class HeartbeatService:
    """Heartbeat service for CRUD operations"""

    def __init__(self, db_path: Optional[str] = None):
        # 使用绝对路径，默认基于项目根目录
        if db_path is None:
            # 获取项目根目录（当前文件的祖父目录）
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            db_path = os.path.join(project_root, "tasks.db")

        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database tables with safe connection management"""
        with self._get_connection_context() as conn:
            cursor = conn.cursor()

            # Heartbeats table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS heartbeats (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    action_type TEXT NOT NULL,
                    action_params TEXT,
                    interval_seconds INTEGER NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    last_run_at TIMESTAMP,
                    next_run_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Heartbeat logs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS heartbeat_logs (
                    id TEXT PRIMARY KEY,
                    heartbeat_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result TEXT,
                    error_message TEXT,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (heartbeat_id) REFERENCES heartbeats(id) ON DELETE CASCADE
                )
            ''')

            # Indexes
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_heartbeat_id
                ON heartbeat_logs(heartbeat_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_started_at
                ON heartbeat_logs(started_at DESC)
            ''')

            conn.commit()

    def _get_connection(self):
        """Get database connection with WAL mode and context manager support"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode on each connection
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def _get_connection_context(self):
        """Context manager for database connection with automatic cleanup"""
        class ConnectionContext:
            def __init__(self, db_path: str):
                self.db_path = db_path
                self.conn = None

            def __enter__(self):
                self.conn = sqlite3.connect(self.db_path)
                self.conn.row_factory = sqlite3.Row
                self.conn.execute("PRAGMA journal_mode=WAL;")
                self.conn.execute("PRAGMA foreign_keys=ON;")
                return self.conn

            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.conn:
                    if exc_type is None:
                        self.conn.commit()
                    else:
                        self.conn.rollback()
                    self.conn.close()
                return False  # Don't suppress exceptions

        return ConnectionContext(self.db_path)

    def _run_sync_query(self, query: str, params: tuple = ()):
        """Run synchronous query in thread pool"""
        return asyncio.to_thread(self._execute_sync, query, params)

    def _execute_sync(self, query: str, params: tuple = ()):
        """Execute synchronous query with safe connection management"""
        with self._get_connection_context() as conn:
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor

    def _row_to_heartbeat(self, row: sqlite3.Row) -> Heartbeat:
        """Convert database row to Heartbeat model"""
        return Heartbeat(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            action_type=row["action_type"],
            action_params=self._parse_json(row["action_params"]),
            interval_seconds=row["interval_seconds"],
            is_active=bool(row["is_active"]),
            last_run_at=self._parse_datetime(row["last_run_at"]),
            next_run_at=self._parse_datetime(row["next_run_at"]),
            created_at=self._parse_datetime(row["created_at"]),
            updated_at=self._parse_datetime(row["updated_at"]),
        )

    def _parse_json(self, value: Optional[str]) -> Optional[dict]:
        """Parse JSON string to dict"""
        if not value:
            return None
        import json
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string to datetime object"""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    def _serialize_json(self, value: Optional[dict]) -> Optional[str]:
        """Serialize dict to JSON string"""
        if not value:
            return None
        import json
        return json.dumps(value)

    async def get_all_heartbeats(self) -> List[Heartbeat]:
        """Get all heartbeats"""
        query = "SELECT * FROM heartbeats ORDER BY created_at DESC"
        cursor = await self._run_sync_query(query)
        rows = cursor.fetchall()
        return [self._row_to_heartbeat(row) for row in rows]

    async def get_active_heartbeats(self) -> List[Heartbeat]:
        """Get active heartbeats"""
        query = "SELECT * FROM heartbeats WHERE is_active = 1 ORDER BY created_at DESC"
        cursor = await self._run_sync_query(query)
        rows = cursor.fetchall()
        return [self._row_to_heartbeat(row) for row in rows]

    async def get_heartbeat(self, heartbeat_id: str) -> Optional[Heartbeat]:
        """Get single heartbeat by ID"""
        query = "SELECT * FROM heartbeats WHERE id = ?"
        cursor = await self._run_sync_query(query, (heartbeat_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return self._row_to_heartbeat(row)

    async def create_heartbeat(self, data: HeartbeatCreate) -> Heartbeat:
        """Create new heartbeat"""
        heartbeat_id = str(uuid.uuid4())
        now = datetime.now()
        next_run = now

        query = """
            INSERT INTO heartbeats
            (id, name, description, action_type, action_params,
             interval_seconds, is_active, last_run_at, next_run_at,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            heartbeat_id,
            data.name,
            data.description,
            data.action_type,
            self._serialize_json(data.action_params),
            data.interval_seconds,
            1 if data.is_active else 0,
            None,
            next_run.isoformat(),
            now.isoformat(),
            now.isoformat(),
        )

        await self._run_sync_query(query, params)
        return await self.get_heartbeat(heartbeat_id)

    async def update_heartbeat(
        self, heartbeat_id: str, data: HeartbeatUpdate
    ) -> Optional[Heartbeat]:
        """Update heartbeat with field whitelist for SQL injection prevention"""
        heartbeat = await self.get_heartbeat(heartbeat_id)
        if not heartbeat:
            return None

        # 使用安全的 SQL 模板，动态构建 SET 子句
        # 字段名必须是白名单中的固定值，不能来自用户输入
        field_set_clauses = {
            "name": "name = ?",
            "description": "description = ?",
            "action_type": "action_type = ?",
            "action_params": "action_params = ?",
            "interval_seconds": "interval_seconds = ?",
            "is_active": "is_active = ?",
            "updated_at": "updated_at = ?",
        }

        set_clauses = []
        params = []

        # 安全地构建 SET 子句
        if data.name is not None:
            set_clauses.append(field_set_clauses["name"])
            params.append(data.name)
        if data.description is not None:
            set_clauses.append(field_set_clauses["description"])
            params.append(data.description)
        if data.action_type is not None:
            set_clauses.append(field_set_clauses["action_type"])
            params.append(data.action_type)
        if data.action_params is not None:
            set_clauses.append(field_set_clauses["action_params"])
            params.append(self._serialize_json(data.action_params))
        if data.interval_seconds is not None:
            set_clauses.append(field_set_clauses["interval_seconds"])
            params.append(data.interval_seconds)
        if data.is_active is not None:
            set_clauses.append(field_set_clauses["is_active"])
            params.append(1 if data.is_active else 0)

        # 总是更新 updated_at
        set_clauses.append(field_set_clauses["updated_at"])
        params.append(datetime.now().isoformat())
        params.append(heartbeat_id)

        if set_clauses:
            # 使用预定义的模板，避免 f-string 拼接
            set_clause = ", ".join(set_clauses)
            query = f"UPDATE heartbeats SET {set_clause} WHERE id = ?"
            await self._run_sync_query(query, tuple(params))

        return await self.get_heartbeat(heartbeat_id)

    async def delete_heartbeat(self, heartbeat_id: str) -> bool:
        """Delete heartbeat"""
        query = "DELETE FROM heartbeats WHERE id = ?"
        cursor = await self._run_sync_query(query, (heartbeat_id,))
        return cursor.rowcount > 0

    async def update_run_times(
        self, heartbeat_id: str, last_run: datetime, next_run: datetime
    ) -> bool:
        """Update last_run_at and next_run_at"""
        query = """
            UPDATE heartbeats
            SET last_run_at = ?, next_run_at = ?, updated_at = ?
            WHERE id = ?
        """
        params = (last_run.isoformat(), next_run.isoformat(), datetime.now().isoformat(), heartbeat_id)
        cursor = await self._run_sync_query(query, params)
        return cursor.rowcount > 0

    async def create_log(self, data: HeartbeatLogCreate) -> HeartbeatLog:
        """Create heartbeat log entry"""
        log_id = str(uuid.uuid4())
        now = datetime.now()

        query = """
            INSERT INTO heartbeat_logs
            (id, heartbeat_id, status, result, error_message, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            log_id,
            data.heartbeat_id,
            data.status.value,
            self._serialize_json(data.result),
            data.error_message,
            now.isoformat(),
            data.completed_at.isoformat() if data.completed_at else None,
        )

        await self._run_sync_query(query, params)
        return await self.get_log(log_id)

    async def get_log(self, log_id: str) -> Optional[HeartbeatLog]:
        """Get single log by ID"""
        query = "SELECT * FROM heartbeat_logs WHERE id = ?"
        cursor = await self._run_sync_query(query, (log_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return self._row_to_log(row)

    async def get_logs_by_heartbeat(self, heartbeat_id: str, limit: int = 50) -> List[HeartbeatLog]:
        """Get logs for a heartbeat"""
        query = """
            SELECT * FROM heartbeat_logs
            WHERE heartbeat_id = ?
            ORDER BY started_at DESC
            LIMIT ?
        """
        cursor = await self._run_sync_query(query, (heartbeat_id, limit))
        rows = cursor.fetchall()
        return [self._row_to_log(row) for row in rows]

    def _row_to_log(self, row: sqlite3.Row) -> HeartbeatLog:
        """Convert database row to HeartbeatLog model"""
        return HeartbeatLog(
            id=row["id"],
            heartbeat_id=row["heartbeat_id"],
            status=HeartbeatLogStatus(row["status"]),
            result=self._parse_json(row["result"]),
            error_message=row["error_message"],
            started_at=self._parse_datetime(row["started_at"]),
            completed_at=self._parse_datetime(row["completed_at"]),
        )

    async def update_log(
        self, log_id: str, status: HeartbeatLogStatus,
        result: Optional[dict] = None, error_message: Optional[str] = None,
        completed_at: Optional[datetime] = None
    ) -> Optional[HeartbeatLog]:
        """Update heartbeat log with field whitelist for SQL injection prevention"""
        # 使用安全的 SQL 模板，避免动态字段拼接
        field_set_clauses = {
            "result": "result = ?",
            "error_message": "error_message = ?",
            "completed_at": "completed_at = ?",
            "status": "status = ?",
        }

        set_clauses = []
        params = []

        if result is not None:
            set_clauses.append(field_set_clauses["result"])
            params.append(self._serialize_json(result))
        if error_message is not None:
            set_clauses.append(field_set_clauses["error_message"])
            params.append(error_message)
        if completed_at is not None:
            set_clauses.append(field_set_clauses["completed_at"])
            params.append(completed_at.isoformat())

        # status 总是更新
        set_clauses.append(field_set_clauses["status"])
        params.append(status.value)
        params.append(log_id)

        if set_clauses:
            set_clause = ", ".join(set_clauses)
            query = f"UPDATE heartbeat_logs SET {set_clause} WHERE id = ?"
            await self._run_sync_query(query, tuple(params))

        return await self.get_log(log_id)

    async def get_stats(self) -> dict:
        """Get heartbeat statistics"""
        query1 = """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
            FROM heartbeats
        """
        cursor1 = await self._run_sync_query(query1)
        row = cursor1.fetchone()

        query2 = """
            SELECT COUNT(*) as failed
            FROM heartbeat_logs
            WHERE status = 'failed' AND started_at > datetime('now', '-24 hours')
        """
        cursor2 = await self._run_sync_query(query2)
        row2 = cursor2.fetchone()

        return {
            "total": row["total"] or 0,
            "active": row["active"] or 0,
            "inactive": row["inactive"] or 0,
            "failed_24h": row2["failed"] or 0,
        }

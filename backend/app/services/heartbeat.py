import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional

from ..models.heartbeat import Heartbeat, HeartbeatCreate, HeartbeatUpdate
from ..models.heartbeat_log import HeartbeatLog, HeartbeatLogCreate, HeartbeatLogStatus


class HeartbeatService:
    """Heartbeat service for CRUD operations"""

    def __init__(self, db_path: str = "tasks.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Enable WAL mode and foreign keys
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")

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
        conn.close()

    def _get_connection(self):
        """Get database connection with WAL mode"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

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
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM heartbeats ORDER BY created_at DESC"
            )
            rows = cursor.fetchall()
            return [self._row_to_heartbeat(row) for row in rows]

    async def get_active_heartbeats(self) -> List[Heartbeat]:
        """Get active heartbeats"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM heartbeats WHERE is_active = 1 ORDER BY created_at DESC"
            )
            rows = cursor.fetchall()
            return [self._row_to_heartbeat(row) for row in rows]

    async def get_heartbeat(self, heartbeat_id: str) -> Optional[Heartbeat]:
        """Get single heartbeat by ID"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM heartbeats WHERE id = ?",
                (heartbeat_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_heartbeat(row)

    async def create_heartbeat(self, data: HeartbeatCreate) -> Heartbeat:
        """Create new heartbeat"""
        heartbeat_id = str(uuid.uuid4())
        now = datetime.now()
        next_run = now

        with self._get_connection() as conn:
            conn.execute(
                """INSERT INTO heartbeats
                (id, name, description, action_type, action_params,
                 interval_seconds, is_active, last_run_at, next_run_at,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
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
            )
            conn.commit()

        return await self.get_heartbeat(heartbeat_id)

    async def update_heartbeat(
        self, heartbeat_id: str, data: HeartbeatUpdate
    ) -> Optional[Heartbeat]:
        """Update heartbeat"""
        heartbeat = await self.get_heartbeat(heartbeat_id)
        if not heartbeat:
            return None

        updates = []
        params = []

        if data.name is not None:
            updates.append("name = ?")
            params.append(data.name)
        if data.description is not None:
            updates.append("description = ?")
            params.append(data.description)
        if data.action_type is not None:
            updates.append("action_type = ?")
            params.append(data.action_type)
        if data.action_params is not None:
            updates.append("action_params = ?")
            params.append(self._serialize_json(data.action_params))
        if data.interval_seconds is not None:
            updates.append("interval_seconds = ?")
            params.append(data.interval_seconds)
        if data.is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if data.is_active else 0)

        if updates:
            updates.append("updated_at = ?")
            params.append(datetime.now().isoformat())
            params.append(heartbeat_id)

            with self._get_connection() as conn:
                conn.execute(
                    f"UPDATE heartbeats SET {', '.join(updates)} WHERE id = ?",
                    params
                )
                conn.commit()

        return await self.get_heartbeat(heartbeat_id)

    async def delete_heartbeat(self, heartbeat_id: str) -> bool:
        """Delete heartbeat"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM heartbeats WHERE id = ?",
                (heartbeat_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    async def update_run_times(
        self, heartbeat_id: str, last_run: datetime, next_run: datetime
    ) -> bool:
        """Update last_run_at and next_run_at"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                """UPDATE heartbeats
                SET last_run_at = ?, next_run_at = ?, updated_at = ?
                WHERE id = ?""",
                (last_run.isoformat(), next_run.isoformat(), datetime.now().isoformat(), heartbeat_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    async def create_log(self, data: HeartbeatLogCreate) -> HeartbeatLog:
        """Create heartbeat log entry"""
        log_id = str(uuid.uuid4())
        now = datetime.now()

        with self._get_connection() as conn:
            conn.execute(
                """INSERT INTO heartbeat_logs
                (id, heartbeat_id, status, result, error_message, started_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    log_id,
                    data.heartbeat_id,
                    data.status.value,
                    self._serialize_json(data.result),
                    data.error_message,
                    now.isoformat(),
                    data.completed_at.isoformat() if data.completed_at else None,
                )
            )
            conn.commit()

        return await self.get_log(log_id)

    async def get_log(self, log_id: str) -> Optional[HeartbeatLog]:
        """Get single log by ID"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM heartbeat_logs WHERE id = ?",
                (log_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_log(row)

    async def get_logs_by_heartbeat(self, heartbeat_id: str, limit: int = 50) -> List[HeartbeatLog]:
        """Get logs for a heartbeat"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                """SELECT * FROM heartbeat_logs
                WHERE heartbeat_id = ?
                ORDER BY started_at DESC
                LIMIT ?""",
                (heartbeat_id, limit)
            )
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
        """Update heartbeat log"""
        updates = []
        params = []

        if result is not None:
            updates.append("result = ?")
            params.append(self._serialize_json(result))
        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)
        if completed_at is not None:
            updates.append("completed_at = ?")
            params.append(completed_at.isoformat())

        if updates:
            updates.append("status = ?")
            params.append(status.value)
            params.append(log_id)

            with self._get_connection() as conn:
                conn.execute(
                    f"UPDATE heartbeat_logs SET {', '.join(updates)} WHERE id = ?",
                    params
                )
                conn.commit()

        return await self.get_log(log_id)

    async def get_stats(self) -> dict:
        """Get heartbeat statistics"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
                FROM heartbeats
            """)
            row = cursor.fetchone()

            cursor2 = conn.execute("""
                SELECT COUNT(*) as failed
                FROM heartbeat_logs
                WHERE status = 'failed' AND started_at > datetime('now', '-24 hours')
            """)
            row2 = cursor2.fetchone()

            return {
                "total": row["total"] or 0,
                "active": row["active"] or 0,
                "inactive": row["inactive"] or 0,
                "failed_24h": row2["failed"] or 0,
            }

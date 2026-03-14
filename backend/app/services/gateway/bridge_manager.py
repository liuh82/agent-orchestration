"""Bridge state manager with in-memory cache and DB persistence."""
from __future__ import annotations

import time
import logging
from typing import Dict, Optional, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.gateway_schemas import (
    BridgeInfo, BridgeFilter, BridgeStatus, AdapterInfo, AgentType,
)
from app.services.gateway.db_gateway import GatewayDB

logger = logging.getLogger(__name__)


class BridgeManager:
    """Bridge state manager with memory cache backed by database.

    The db session is request-scoped and must be updated per-request
    via the db property setter. The in-memory cache (_bridges) persists
    across requests as the singleton instance.
    """

    def __init__(self, db: Session, db_gateway: GatewayDB):
        self._db: Optional[Session] = db
        self._db_gateway: Optional[GatewayDB] = db_gateway
        self._bridges: Dict[str, BridgeInfo] = {}

    @property
    def db(self) -> Optional[Session]:
        return self._db

    @db.setter
    def db(self, value: Session) -> None:
        self._db = value

    @property
    def db_gateway(self) -> Optional[GatewayDB]:
        return self._db_gateway

    @db_gateway.setter
    def db_gateway(self, value: GatewayDB) -> None:
        self._db_gateway = value

    # ---- Internal helpers ----

    def _ensure_db_available(self) -> bool:
        """Check if the DB session and gateway are available.

        Returns False if either is None or the session is closed.
        Callers should handle the False case gracefully.
        """
        if self._db is None or self._db_gateway is None:
            return False
        try:
            # Execute a lightweight query to verify connection is alive
            self._db.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    # ---- Registration ----

    def register_bridge(self, bridge_info: BridgeInfo) -> None:
        """Register a Bridge (update memory cache and persist to DB)."""
        self._bridges[bridge_info.bridge_id] = bridge_info
        self.db_gateway.create_bridge(bridge_info)
        logger.info(
            f"Bridge registered: {bridge_info.bridge_id} "
            f"platform={bridge_info.platform} "
            f"adapters={[a.type.value for a in bridge_info.available_adapters]}"
        )

    def update_last_seen(self, bridge_id: str) -> None:
        """Update last_seen timestamp."""
        bridge = self._bridges.get(bridge_id)
        if bridge:
            now = int(time.time())
            bridge.last_seen = now
            self.db_gateway.update_bridge_status(bridge_id, bridge.status.value)

    def set_bridge_offline(self, bridge_id: str) -> None:
        """Set Bridge to offline status."""
        bridge = self._bridges.get(bridge_id)
        if bridge:
            bridge.status = BridgeStatus.OFFLINE
            bridge.active_tasks = 0
            self.db_gateway.update_bridge_status(bridge_id, 'offline')
            logger.info(f"Bridge set offline: {bridge_id}")

    def set_bridge_online(self, bridge_id: str) -> None:
        """Set Bridge to online status."""
        bridge = self._bridges.get(bridge_id)
        if bridge:
            bridge.status = BridgeStatus.ONLINE
            self.db_gateway.update_bridge_status(bridge_id, 'online')
            logger.info(f"Bridge set online: {bridge_id}")

    # ---- Queries ----

    def get_bridge(self, bridge_id: str) -> BridgeInfo | None:
        """Get Bridge info from memory cache."""
        return self._bridges.get(bridge_id)

    def get_available_bridges(
        self, filters: BridgeFilter | None = None
    ) -> list[BridgeInfo]:
        """Get available (online) bridges, optionally filtered."""
        candidates = [
            b for b in self._bridges.values()
            if b.status == BridgeStatus.ONLINE
        ]

        if filters:
            if filters.status:
                candidates = [b for b in candidates if b.status == filters.status]
            if filters.platform:
                candidates = [b for b in candidates if b.platform == filters.platform]
            if filters.min_active_tasks is not None:
                candidates = [
                    b for b in candidates
                    if b.active_tasks < filters.min_active_tasks
                ]

        return candidates

    def get_all_bridges(self) -> list[BridgeInfo]:
        """Get all bridges from memory cache."""
        return list(self._bridges.values())

    # ---- Task counting ----

    def increment_active_tasks(self, bridge_id: str) -> bool:
        """Increment active task count. Returns False if at capacity."""
        bridge = self._bridges.get(bridge_id)
        if not bridge:
            return False
        if bridge.active_tasks >= bridge.max_concurrent:
            logger.warning(
                f"Bridge {bridge_id} at capacity: "
                f"{bridge.active_tasks}/{bridge.max_concurrent}"
            )
            return False
        bridge.active_tasks += 1
        self.db_gateway.increment_active_tasks(bridge_id)
        return True

    def decrement_active_tasks(self, bridge_id: str) -> None:
        """Decrement active task count."""
        bridge = self._bridges.get(bridge_id)
        if bridge and bridge.active_tasks > 0:
            bridge.active_tasks -= 1
        self.db_gateway.decrement_active_tasks(bridge_id)

    # ---- Persistence sync ----

    async def sync_to_db(self) -> None:
        """Sync all in-memory Bridge states to database."""
        for bridge_id, bridge_info in self._bridges.items():
            self.db_gateway.create_bridge(bridge_info)
        logger.debug(f"Synced {len(self._bridges)} bridges to database")

    def load_from_db(self) -> None:
        """Load Bridge records from database into memory cache."""
        records = self.db_gateway.get_all_bridges()
        for record in records:
            adapters = []
            for a in (record.available_adapters or []):
                adapters.append(AdapterInfo(**a))

            self._bridges[record.bridge_id] = BridgeInfo(
                bridge_id=record.bridge_id,
                platform=record.platform,
                hostname=record.hostname,
                os_version=record.os_version,
                node_version=record.node_version,
                bridge_version=record.bridge_version,
                status=BridgeStatus(record.status),
                last_seen=record.last_seen,
                available_adapters=adapters,
                active_tasks=record.active_tasks,
                max_concurrent=record.max_concurrent,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )
        logger.info(f"Loaded {len(records)} bridges from database")

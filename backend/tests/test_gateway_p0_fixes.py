"""Tests for P0 code review fixes: singleton race condition + transaction error handling."""
import threading
import time
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.models.gateway_schemas import (
    BridgeInfo, BridgeStatus, AdapterInfo, AgentType, TaskRequest,
    TaskStatus, TaskPriority,
)
from app.services.gateway.bridge_manager import BridgeManager
from app.services.gateway.db_gateway import GatewayDB
import app.routers.gateway as gateway_mod
from app.routers.gateway import get_bridge_manager


# ---- Helper to create test data ----

def _make_bridge_info(bridge_id: str = "test-bridge-1") -> BridgeInfo:
    return BridgeInfo(
        bridge_id=bridge_id,
        platform="darwin",
        hostname="test-host",
        os_version="1.0",
        node_version="18.0",
        bridge_version="0.1.0",
        status=BridgeStatus.ONLINE,
        last_seen=int(time.time()),
        available_adapters=[AdapterInfo(type=AgentType.CLI, agent_name="cli")],
        active_tasks=0,
        max_concurrent=3,
    )


def _make_task_request() -> TaskRequest:
    return TaskRequest(
        prompt="Fix the bug",
        project_path="/tmp/test",
        agent_type=AgentType.CLI,
        timeout=300,
        priority=TaskPriority.NORMAL,
        source="test",
    )


# ============================================================
# P0-1: Double-Checked Locking singleton test
# ============================================================

class TestBridgeManagerSingletonDCL:
    """Tests for get_bridge_manager double-checked locking."""

    def setup_method(self):
        """Reset global singleton before each test."""
        with gateway_mod._bridge_manager_lock:
            gateway_mod._bridge_manager = None

    def teardown_method(self):
        """Reset global singleton after each test."""
        with gateway_mod._bridge_manager_lock:
            gateway_mod._bridge_manager = None

    def test_singleton_returns_same_instance(self):
        """get_bridge_manager should return the same instance across calls."""
        mock_db = MagicMock(spec=Session)
        mock_gw_db = MagicMock(spec=GatewayDB)

        bm1 = get_bridge_manager(mock_db, mock_gw_db)
        bm2 = get_bridge_manager(mock_db, mock_gw_db)

        assert bm1 is bm2
        assert isinstance(bm1, BridgeManager)

    def test_singleton_thread_safety(self):
        """Concurrent calls to get_bridge_manager should produce the same instance."""
        mock_db = MagicMock(spec=Session)
        mock_gw_db = MagicMock(spec=GatewayDB)

        results = []
        errors = []

        def worker():
            try:
                bm = get_bridge_manager(mock_db, mock_gw_db)
                results.append(bm)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Errors in concurrent access: {errors}"
        assert len(results) == 20
        # All threads should get the exact same instance
        assert all(r is results[0] for r in results), "Not all threads got the same singleton"

    def test_singleton_creates_once(self):
        """BridgeManager constructor should only be called once even with concurrent access."""
        mock_db = MagicMock(spec=Session)
        mock_gw_db = MagicMock(spec=GatewayDB)

        # Get singleton once
        bm1 = get_bridge_manager(mock_db, mock_gw_db)
        bm2 = get_bridge_manager(mock_db, mock_gw_db)

        # Both calls must return the exact same object (no second construction)
        assert bm1 is bm2, "Singleton should not create a new instance on second call"

    def test_singleton_resets_after_global_clear(self):
        """After resetting the global, a new instance should be created."""
        mock_db = MagicMock(spec=Session)
        mock_gw_db = MagicMock(spec=GatewayDB)

        bm1 = get_bridge_manager(mock_db, mock_gw_db)

        # Reset the global singleton via module attribute
        with gateway_mod._bridge_manager_lock:
            gateway_mod._bridge_manager = None

        bm2 = get_bridge_manager(mock_db, mock_gw_db)
        assert bm1 is not bm2, "After reset, a new instance should be created"


# ============================================================
# P0-1 supplement: BridgeManager property tests
# ============================================================

class TestBridgeManagerProperties:
    """Tests for BridgeManager property setters and _ensure_db_available."""

    def teardown_method(self):
        """Reset global singleton after each test."""
        with gateway_mod._bridge_manager_lock:
            gateway_mod._bridge_manager = None

    def test_db_property_setter(self):
        """db setter should update internal reference."""
        mock_db1 = MagicMock(spec=Session)
        mock_db2 = MagicMock(spec=Session)
        mock_gw_db = MagicMock(spec=GatewayDB)

        bm = BridgeManager(mock_db1, mock_gw_db)
        assert bm.db is mock_db1

        bm.db = mock_db2
        assert bm.db is mock_db2

    def test_db_gateway_property_setter(self):
        """db_gateway setter should update internal reference."""
        mock_db = MagicMock(spec=Session)
        mock_gw_db1 = MagicMock(spec=GatewayDB)
        mock_gw_db2 = MagicMock(spec=GatewayDB)

        bm = BridgeManager(mock_db, mock_gw_db1)
        assert bm.db_gateway is mock_gw_db1

        bm.db_gateway = mock_gw_db2
        assert bm.db_gateway is mock_gw_db2

    def test_ensure_db_available_returns_true_when_healthy(self):
        """_ensure_db_available should return True when DB is functional."""
        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = MagicMock()
        mock_gw_db = MagicMock(spec=GatewayDB)

        bm = BridgeManager(mock_db, mock_gw_db)
        assert bm._ensure_db_available() is True
        mock_db.execute.assert_called_once()

    def test_ensure_db_available_returns_false_when_db_is_none(self):
        """_ensure_db_available should return False when db is None."""
        mock_gw_db = MagicMock(spec=GatewayDB)
        bm = BridgeManager(None, mock_gw_db)
        bm._db = None
        assert bm._ensure_db_available() is False

    def test_ensure_db_available_returns_false_when_gateway_is_none(self):
        """_ensure_db_available should return False when db_gateway is None."""
        mock_db = MagicMock(spec=Session)
        bm = BridgeManager(mock_db, None)
        bm._db_gateway = None
        assert bm._ensure_db_available() is False

    def test_ensure_db_available_returns_false_on_db_error(self):
        """_ensure_db_available should return False when DB query fails."""
        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = Exception("connection lost")
        mock_gw_db = MagicMock(spec=GatewayDB)

        bm = BridgeManager(mock_db, mock_gw_db)
        assert bm._ensure_db_available() is False


# ============================================================
# P0-2: Transaction error handling tests
# ============================================================

class TestCreateBridgeTransaction:
    """Tests for create_bridge() transaction error handling."""

    def test_create_bridge_commit_success(self, db):
        """create_bridge should succeed on normal commit."""
        gw_db = GatewayDB(db)
        info = _make_bridge_info("bridge-tx-ok")

        result = gw_db.create_bridge(info)
        assert result.bridge_id == "bridge-tx-ok"
        assert result.status == "online"

    def test_create_bridge_rollback_on_commit_failure(self, db):
        """create_bridge should rollback when commit fails."""
        gw_db = GatewayDB(db)
        info = _make_bridge_info("bridge-tx-fail")

        original_commit = db.commit
        commit_count = [0]

        def failing_commit():
            commit_count[0] += 1
            if commit_count[0] == 1:
                raise Exception("disk full")
            original_commit()

        db.commit = failing_commit

        with pytest.raises(Exception, match="disk full"):
            gw_db.create_bridge(info)

    def test_create_bridge_refresh_failure_does_not_raise(self, db):
        """create_bridge should not raise when refresh fails after successful commit."""
        gw_db = GatewayDB(db)
        info = _make_bridge_info("bridge-refresh-fail")

        original_refresh = db.refresh
        refresh_called = [0]

        def failing_refresh(obj):
            refresh_called[0] += 1
            if refresh_called[0] == 1:
                raise Exception("connection closed after commit")
            original_refresh(obj)

        db.refresh = failing_refresh

        # Should NOT raise despite refresh failure
        result = gw_db.create_bridge(info)
        assert result.bridge_id == "bridge-refresh-fail"
        assert refresh_called[0] == 1  # refresh was attempted and failed

    def test_create_task_refresh_failure_does_not_raise(self, db):
        """create_task should not raise when refresh fails after successful commit."""
        gw_db = GatewayDB(db)
        task = _make_task_request()

        original_refresh = db.refresh
        refresh_called = [0]

        def failing_refresh(obj):
            refresh_called[0] += 1
            if refresh_called[0] == 1:
                raise Exception("connection closed")
            original_refresh(obj)

        db.refresh = failing_refresh

        # Should NOT raise despite refresh failure
        result = gw_db.create_task("task-refresh-1", task, "bridge-1")
        assert result.task_id == "task-refresh-1"

    def test_create_task_rollback_on_commit_failure(self, db):
        """create_task should rollback when commit fails."""
        gw_db = GatewayDB(db)
        task = _make_task_request()

        original_commit = db.commit
        commit_count = [0]

        def failing_commit():
            commit_count[0] += 1
            if commit_count[0] == 1:
                raise Exception("write error")
            original_commit()

        db.commit = failing_commit

        with pytest.raises(Exception, match="write error"):
            gw_db.create_task("task-tx-fail", task, "bridge-1")

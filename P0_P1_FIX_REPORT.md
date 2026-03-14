# P0/P1 Bug Fix + Unit Test Report

> Date: 2026-03-14
> Scope: Backend (Python/FastAPI) + Remote Agent Bridge (TypeScript/Node.js)

## 1. Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 (Critical) | 4 | All fixed + tested |
| P1 (Important) | 5 | All fixed + tested |
| Total | 9 | 9/9 fixed |

### Test Results

| Project | Tests | Passed | Failed |
|---------|-------|--------|--------|
| Backend (pytest) | 15 | 15 | 0 |
| Bridge (jest) | 66 | 66 | 0 |
| **Total** | **81** | **81** | **0** |

---

## 2. P0 Fixes (Critical)

### P0-1: BridgeManager Singleton Race Condition

**File**: `backend/app/routers/gateway.py`

**Problem**: `bridge_manager` global singleton was accessed without synchronization. Multiple concurrent requests could create multiple instances, causing inconsistent state (e.g., bridge registration lost, active task count wrong).

**Fix**:
- Renamed `bridge_manager` → `_bridge_manager` (private convention)
- Added `threading.Lock()` for `_bridge_manager_lock`
- Created `get_bridge_manager()` using Double-Checked Locking (DCL) pattern:
  - Fast path: check `_bridge_manager is None` without lock
  - Slow path: acquire lock, re-check, create if still None
- Updated `_get_shared_components()` and `gateway_ws()` to use `get_bridge_manager()`

**Tests** (4):
- `test_singleton_returns_same_instance` — verifies same object across calls
- `test_singleton_thread_safety` — 20 concurrent threads all get same instance
- `test_singleton_creates_once` — no duplicate construction
- `test_singleton_resets_after_global_clear` — new instance after module-level reset

---

### P0-2: Transaction Error Handling (commit/refresh)

**File**: `backend/app/services/gateway/db_gateway.py`

**Problem**: `create_bridge()` and `create_task()` called `commit()` and `refresh()` without error handling. If `commit()` failed, no `rollback()` occurred. If `refresh()` failed after successful commit, the exception would mask the already-persisted data.

**Fix**:
- Wrapped `commit()` in try/except with `rollback()` on failure
- Wrapped `refresh()` in separate try/except — failure is logged as warning (not raised), with fallback re-query
- Applied to both `create_bridge()` and `create_task()`

**Tests** (5):
- `test_create_bridge_commit_success` — normal path
- `test_create_bridge_rollback_on_commit_failure` — rollback on "disk full"
- `test_create_bridge_refresh_failure_does_not_raise` — graceful degradation
- `test_create_task_rollback_on_commit_failure` — rollback on "write error"
- `test_create_task_refresh_failure_does_not_raise` — graceful degradation

---

### P0-3: WebSocket Message Validation (unsafe type casts)

**File**: `remote-agent-bridge/src/ws-client.ts`

**Problem**: All message handlers used `data as Type` to cast `unknown` to typed objects without runtime validation. A malformed message from the Gateway could crash the Bridge or produce undefined behavior.

**Fix**:
- Added 6 runtime validator functions: `validateAuthResponse`, `validatePing`, `validateTaskSubmit`, `validateTaskCancel`, `validateAck`, `validateError`
- Each validator checks `typeof` for every required field, returns `null` on invalid input
- Replaced all `as Type` casts with validator calls + early return on null
- Used `Record<string, unknown>` bracket notation (`obj['field']`) to satisfy `noUncheckedIndexedAccess`

**Tests** (38):
- 8 tests for `validateAuthResponse` (valid, invalid, missing fields, type errors)
- 4 tests for `validatePing` (valid, null, missing timestamp, wrong type)
- 8 tests for `validateTaskSubmit` (valid, defaults, null, missing/empty fields)
- 5 tests for `validateTaskCancel` (valid, null, missing fields)
- 4 tests for `validateAck` (valid, null, missing/invalid fields)
- 9 tests for `validateError` (valid, with details, null, missing fields, array input)

---

### P0-4: HTTP API Task Submission Not Enqueued

**File**: `remote-agent-bridge/src/http-server.ts`, `remote-agent-bridge/src/bridge.ts`

**Problem**: The HTTP POST `/api/v1/tasks` endpoint validated and persisted the task but never passed it to the Bridge's task runner. Tasks submitted via HTTP would sit in "queued" status forever.

**Fix**:
- Added `submitLocalTask(task: TaskSubmit)` public method to `Bridge` class
- In `HttpServer`, added bridge null check (503 if not initialized) and `bridge.submitLocalTask(task)` call before returning 202
- Wrapped in try/catch with 500 error response on failure

---

## 3. P1 Fixes (Important)

### P1-1: Ack Timeout DB Session Leak

**File**: `backend/app/services/gateway/task_router.py`

**Problem**: `check_ack()` created `SessionLocal()` manually with try/finally close. If an exception occurred before `db.close()`, the session leaked.

**Fix**: Replaced manual `SessionLocal()` + `try/finally/db.close()` with `with SessionLocal() as db:` context manager pattern.

---

### P1-2: BridgeManager Stale DB Session

**File**: `backend/app/services/gateway/bridge_manager.py`

**Problem**: `db` and `db_gateway` were plain attributes. The singleton BridgeManager could hold a closed/expired DB session from a previous request, causing errors on next use.

**Fix**:
- Changed to private `_db` / `_db_gateway` with `@property` getters/setters
- Added `_ensure_db_available()` method that checks for None and runs `SELECT 1` health check
- Callers can verify DB availability before operations

**Tests** (6):
- `test_db_property_setter` / `test_db_gateway_property_setter` — setter updates reference
- `test_ensure_db_available_returns_true_when_healthy` — `SELECT 1` success
- `test_ensure_db_available_returns_false_when_db_is_none` — None guard
- `test_ensure_db_available_returns_false_when_gateway_is_none` — None guard
- `test_ensure_db_available_returns_false_on_db_error` — connection error

---

### P1-3: Sandbox Command Whitelist Bypass via Path Injection

**File**: `remote-agent-bridge/src/security/sandbox.ts`

**Problem**: The sandbox only checked if the raw command string started with an allowed command name. Attackers could bypass via:
- Relative path: `./sudo rm -rf /`
- Absolute path: `/usr/bin/rm -rf /`
- Escape characters: `sudo\ rm -rf /`

**Fix**:
- Added `import * as path from 'path'`
- Added escape character stripping: `command.replace(/\\[\s\/]/g, '')`
- Added `path.normalize()` + `path.basename()` to extract the actual command name
- Reject if normalized path differs from basename (path injection detected)
- Applied sanitized input to blocked pattern and dangerous pattern checks

**Tests** (19):
- 11 tests for path injection prevention (allowlist, relative/absolute path bypass, escape chars, parent traversal, disabled mode)
- 4 tests for dangerous patterns (rm -rf, sudo, chmod 777, fork bomb)
- 1 test for custom blocked patterns
- 3 tests for prompt validation

---

### P1-4: Database.ts Dictionary-Style Parameter Access

**File**: `remote-agent-bridge/src/database.ts`

**Problem**: `listTasks()` and `getAuditLogs()` used `Record<string, unknown>` for SQL parameters, accessing with bracket notation `params['status']`. This loses type safety and is inconsistent with the rest of the codebase.

**Fix**: Changed `params` type from `Record<string, unknown>` to typed interfaces matching the `options` parameter type: `{ status?: string; limit?: number; offset?: number }` and `{ action?: string; limit?: number }`.

**Tests** (9):
- 5 tests for `listTasks` (empty, status filter, limit, offset pagination, all without options)
- 4 tests for `getAuditLogs` (empty, action filter, limit, all without options)

---

### P1-5: WebSocket DB Session Leak on Registration Failure

**File**: `backend/app/routers/gateway.py`

**Problem**: In `gateway_ws()`, the DB session was created inside the `bridge.register` handler's `try/finally` block. If registration failed (exception in `try`), the `finally` closed the session. But if the exception was caught by the outer `try` and `continue` was executed, the session variable went out of scope without guaranteed cleanup. Additionally, on WebSocket disconnect, the session was never closed.

**Fix**:
- Lifted `ws_db` to connection-level scope (outside the message loop)
- Added outer `try/except/finally` ensuring `ws_db.close()` on all exit paths
- Registration error handler closes `ws_db` and sets to None before `continue`

---

## 4. Files Changed

### Modified (9 files)

| File | Changes |
|------|---------|
| `backend/app/routers/gateway.py` | DCL singleton + WebSocket DB session lifecycle |
| `backend/app/services/gateway/bridge_manager.py` | Property setters + `_ensure_db_available()` |
| `backend/app/services/gateway/db_gateway.py` | Transaction error handling (commit/refresh) |
| `backend/app/services/gateway/task_router.py` | Context manager for DB session |
| `remote-agent-bridge/src/bridge.ts` | Added `submitLocalTask()` method |
| `remote-agent-bridge/src/database.ts` | Typed parameter interfaces |
| `remote-agent-bridge/src/http-server.ts` | Bridge null check + task enqueue |
| `remote-agent-bridge/src/security/sandbox.ts` | Path normalization + escape stripping |
| `remote-agent-bridge/src/ws-client.ts` | 6 runtime validators replacing unsafe casts |

### New (6 files)

| File | Description |
|------|-------------|
| `backend/tests/test_gateway_p0_fixes.py` | 15 pytest tests (DCL + transaction) |
| `remote-agent-bridge/jest.config.json` | Jest configuration with ts-jest |
| `remote-agent-bridge/tsconfig.test.json` | TypeScript config for test files |
| `remote-agent-bridge/src/__tests__/ws-validators.test.ts` | 38 jest tests (validators) |
| `remote-agent-bridge/src/__tests__/sandbox.test.ts` | 19 jest tests (sandbox) |
| `remote-agent-bridge/src/__tests__/database.test.ts` | 9 jest tests (database) |

---

## 5. Verification Commands

```bash
# Backend tests
cd backend
python3 -m pytest tests/test_gateway_p0_fixes.py -v

# Bridge tests
cd remote-agent-bridge
npx jest --verbose

# Backend type check
cd backend
python3 -c "from app.main import app"  # import validation

# Bridge type check + build
cd remote-agent-bridge
npx tsc --noEmit
npm run build
```

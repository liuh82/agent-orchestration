"""Gateway router - HTTP API + WebSocket endpoint."""
import asyncio
import logging
import threading
import time
import uuid
from typing import Optional

from fastapi import (
    APIRouter, Query, Request, WebSocket, WebSocketDisconnect, Depends,
)
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import verify_api_key, verify_admin_key, verify_gateway_token
from app.models.gateway_schemas import (
    AgentType, TaskPriority, TaskStatus, BridgeStatus, BridgeInfo,
    AdapterInfo, TaskRequest, TaskInfo, TaskListResponse,
    SubmitTaskRequest, SubmitTaskResponse, TaskStatusResponse,
    BridgeListResponse, BridgeFilter,
)
from app.rate_limit import limiter
from app.services.gateway.ws_server import WSServer
from app.services.gateway.bridge_manager import BridgeManager
from app.services.gateway.task_router import (
    TaskRouter, NoAvailableBridgeError, TaskNotFoundError,
)
from app.services.gateway.db_gateway import GatewayDB

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Gateway"])


# ---- Module-level singletons (initialized during app startup) ----

ws_server: Optional[WSServer] = None
_bridge_manager: Optional[BridgeManager] = None
db_gateway: Optional[GatewayDB] = None
_bridge_manager_lock = threading.Lock()


def init_gateway_services() -> None:
    """Initialize Gateway services. Called during app startup."""
    global ws_server, _bridge_manager, db_gateway

    ws_server = WSServer()
    logger.info("Gateway WebSocket Server initialized")


def get_bridge_manager(db: Session, gw_db: GatewayDB) -> BridgeManager:
    """Get or create the BridgeManager singleton using double-checked locking."""
    global _bridge_manager
    if _bridge_manager is None:
        with _bridge_manager_lock:
            if _bridge_manager is None:
                _bridge_manager = BridgeManager(db, gw_db)
                logger.info("BridgeManager singleton created")
    return _bridge_manager


def _get_shared_components(db: Session):
    """Get shared gateway components with request-scoped DB.

    BridgeManager uses module-level singleton for memory cache consistency.
    DB session is request-scoped via FastAPI Depends.
    """
    gw_db = GatewayDB(db)
    bm = get_bridge_manager(db, gw_db)
    bm.db = db
    bm.db_gateway = gw_db
    ws = ws_server
    tr = TaskRouter(bm, ws, gw_db)
    return gw_db, bm, ws, tr


# ---- Helper functions ----

def _task_record_to_info(record) -> TaskInfo:
    """Convert TaskRecord ORM object to TaskInfo Pydantic model."""
    return TaskInfo(
        task_id=record.task_id,
        bridge_id=record.bridge_id,
        prompt=record.prompt,
        project_path=record.project_path,
        agent_type=record.agent_type,
        timeout=record.timeout,
        priority=record.priority,
        preferred_ide=record.preferred_ide,
        source=record.source,
        callback_id=record.callback_id,
        status=record.status,
        output=record.output,
        error=record.error,
        exit_code=record.exit_code,
        changed_files=record.changed_files,
        duration=record.duration,
        progress=record.progress,
        submitted_at=record.submitted_at,
        started_at=record.started_at,
        completed_at=record.completed_at,
    )


def _bridge_record_to_info(record) -> BridgeInfo:
    """Convert BridgeRecord ORM object to BridgeInfo Pydantic model."""
    adapters = []
    for a in (record.available_adapters or []):
        adapters.append(AdapterInfo(**a))
    return BridgeInfo(
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


# ============ HTTP API ============

@router.post("/tasks", response_model=SubmitTaskResponse)
@limiter.limit("10/minute")
async def submit_task(
    request: Request,
    body: SubmitTaskRequest,
    source: str = Query(default="http", description="Task source"),
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Submit a task to the Gateway."""
    gw_db, bm, ws, tr = _get_shared_components(db)

    task = TaskRequest(
        prompt=body.prompt,
        project_path=body.project_path,
        agent_type=body.agent_type,
        timeout=body.timeout,
        priority=body.priority,
        preferred_ide=body.preferred_ide,
        callback_id=body.callback_id,
        skip_permissions=body.skip_permissions,
        allowed_tools=body.allowed_tools,
        source=source,
    )

    try:
        task_id = await tr.submit_task(task)
        bridge = tr.get_task_bridge(task_id)
        return SubmitTaskResponse(
            success=True,
            task_id=task_id,
            bridge_id=bridge.bridge_id if bridge else None,
            message="Task submitted successfully",
        )
    except NoAvailableBridgeError:
        return JSONResponse(
            status_code=503,
            content=SubmitTaskResponse(
                success=False,
                message="No available Bridge for this task",
            ).model_dump(),
        )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
@limiter.limit("30/minute")
async def get_task_status(
    request: Request,
    task_id: str,
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Query task status."""
    gw_db = GatewayDB(db)
    record = gw_db.get_task(task_id)
    if not record:
        return TaskStatusResponse(success=False, data=None)
    return TaskStatusResponse(success=True, data=_task_record_to_info(record))


@router.get("/tasks", response_model=TaskListResponse)
@limiter.limit("30/minute")
async def list_tasks(
    request: Request,
    status: Optional[TaskStatus] = None,
    bridge_id: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="submitted_at", pattern="^(submitted_at|completed_at|status)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Query task list with filtering and pagination."""
    gw_db = GatewayDB(db)
    records, total = gw_db.list_tasks(
        status=status,
        bridge_id=bridge_id,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return TaskListResponse(
        success=True,
        data=[_task_record_to_info(r) for r in records],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/tasks/{task_id}/cancel")
@limiter.limit("20/minute")
async def cancel_task(
    request: Request,
    task_id: str,
    reason: str = Query(default="user_request"),
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_admin_key),
):
    """Cancel a task."""
    gw_db, bm, ws, tr = _get_shared_components(db)
    try:
        await tr.cancel_task(task_id, reason)
        return {"success": True, "message": "Task cancelled"}
    except TaskNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Task not found"},
        )


@router.get("/bridges", response_model=BridgeListResponse)
@limiter.limit("30/minute")
async def list_bridges(
    request: Request,
    status: Optional[BridgeStatus] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List all Bridges."""
    gw_db = GatewayDB(db)
    filters = BridgeFilter(status=status, platform=platform)
    records = gw_db.get_all_bridges(filters)
    return BridgeListResponse(
        success=True,
        data=[_bridge_record_to_info(r) for r in records],
    )


@router.post("/bridges/{bridge_id}/disconnect")
@limiter.limit("20/minute")
async def force_disconnect_bridge(
    request: Request,
    bridge_id: str,
    _api_key: str = Depends(verify_admin_key),
):
    """Force disconnect a Bridge (admin use)."""
    if ws_server and ws_server.is_connected(bridge_id):
        await ws_server.disconnect(bridge_id)
    return {"success": True, "message": f"Bridge {bridge_id} disconnected"}


# ============ WebSocket Endpoint ============

# Backward compat: also accept ?token=xxx for legacy clients.
# This path will be deprecated in a future release.
_AUTH_TIMEOUT_SECONDS = 10.0


def _make_envelope(msg_type: str, data: dict, reply_msg_id: Optional[str] = None) -> dict:
    """Build a protocol message envelope matching Bridge's expected format."""
    return {
        "msgId": str(uuid.uuid4()),
        "type": msg_type,
        "ts": int(time.time() * 1000),
        "data": data,
        **({"inReplyTo": reply_msg_id} if reply_msg_id else {}),
    }


@router.websocket("/ws")
async def gateway_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None, description="Legacy: API Key (deprecated, prefer auth.request)"),
):
    """Gateway WebSocket connection endpoint.

    Authentication: first-message ``auth.request`` containing the token.
    Legacy fallback: ``?token=xxx`` query parameter (will be removed).

    Protocol:
    1. Connect (no query params required)
    2. Server sends ping, client MUST send ``auth.request`` within timeout
    3. Server responds ``auth.response``
    4. Client sends ``bridge.register``
    5. Server responds ``bridge.registered`` with resumed tasks (if any)
    6. Normal bidirectional communication
    """
    global _bridge_manager

    await websocket.accept()

    # ---- Phase 1: Authentication ----
    authenticated = False
    bridge_id: Optional[str] = None

    # Legacy token via query parameter — fast path for existing clients
    if token and verify_gateway_token(token):
        authenticated = True
        logger.info("Authenticated via legacy query-param token (deprecated)")
    else:
        # First-message authentication: wait for auth.request
        try:
            auth_msg = await asyncio.wait_for(
                websocket.receive_json(), timeout=_AUTH_TIMEOUT_SECONDS,
            )
        except (asyncio.TimeoutError, WebSocketDisconnect):
            logger.warning("WebSocket auth timed out or disconnected")
            try:
                await websocket.close(code=4001, reason="Auth timeout")
            except Exception:
                pass
            return
        except Exception:
            logger.warning("WebSocket auth read error")
            try:
                await websocket.close(code=4001, reason="Auth read error")
            except Exception:
                pass
            return

        msg_type = auth_msg.get("type")
        # Extract payload: Bridge sends {msgId, type, ts, data: {...}}
        payload = auth_msg.get("data", auth_msg)
        auth_token = payload.get("token", "") if isinstance(payload, dict) else ""
        reply_msg_id = auth_msg.get("msgId")

        if msg_type != "auth.request" or not verify_gateway_token(auth_token):
            logger.warning(f"WebSocket auth failed: type={msg_type}")
            await websocket.send_json(
                _make_envelope("auth.response", {
                    "success": False,
                    "error": "Authentication failed",
                }, reply_msg_id),
            )
            try:
                await websocket.close(code=4001, reason="Unauthorized")
            except Exception:
                pass
            return

        # Extract bridge_id from auth payload for early reference
        bridge_id = payload.get("bridgeId") if isinstance(payload, dict) else None

        await websocket.send_json(
            _make_envelope("auth.response", {
                "success": True,
                "bridgeId": bridge_id,
            }, reply_msg_id),
        )
        authenticated = True
        logger.info(f"Authenticated via auth.request: {bridge_id}")

    if not authenticated:
        try:
            await websocket.close(code=4001, reason="Unauthorized")
        except Exception:
            pass
        return

    # ---- Phase 2: Registration & Communication ----
    heartbeat_task = None

    # ---- Message handlers with per-call DB sessions ----

    async def on_bridge_disconnect(bid: str):
        """Handle Bridge disconnect with a short-lived DB session."""
        db = next(get_db())
        try:
            gw_db = GatewayDB(db)
            bm = get_bridge_manager(db, gw_db)
            bm.db = db
            bm.db_gateway = gw_db
            bm.set_bridge_offline(bid)
        except Exception as e:
            logger.error(f"Error setting bridge offline {bid}: {e}")
        finally:
            db.close()

    async def on_task_progress(bid: str, msg: dict):
        """Handle task progress with a short-lived DB session."""
        db = next(get_db())
        try:
            gw_db = GatewayDB(db)
            bm = get_bridge_manager(db, gw_db)
            bm.db = db
            bm.db_gateway = gw_db
            tr = TaskRouter(bm, ws_server, gw_db)
            tr.handle_task_progress(bid, msg)
        except Exception as e:
            logger.error(f"Error handling task progress from {bid}: {e}")
        finally:
            db.close()

    async def on_task_complete(bid: str, msg: dict):
        """Handle task complete with a short-lived DB session."""
        db = next(get_db())
        try:
            gw_db = GatewayDB(db)
            bm = get_bridge_manager(db, gw_db)
            bm.db = db
            bm.db_gateway = gw_db
            tr = TaskRouter(bm, ws_server, gw_db)
            tr.handle_task_complete(bid, msg)
        except Exception as e:
            logger.error(f"Error handling task complete from {bid}: {e}")
        finally:
            db.close()

    async def on_task_ack(bid: str, msg: dict):
        """Handle task ack with a short-lived DB session."""
        db = next(get_db())
        try:
            gw_db = GatewayDB(db)
            bm = get_bridge_manager(db, gw_db)
            bm.db = db
            bm.db_gateway = gw_db
            tr = TaskRouter(bm, ws_server, gw_db)
            tr.handle_task_ack(bid, msg)
        except Exception as e:
            logger.error(f"Error handling task ack from {bid}: {e}")
        finally:
            db.close()

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "bridge.register":
                bridge_id = data.get("bridgeId")
                if not bridge_id:
                    await websocket.send_json({
                        'type': 'error',
                        'code': 'INVALID_REGISTRATION',
                        'message': 'bridgeId is required',
                    })
                    continue

                # Register in WS server
                try:
                    await ws_server.register(bridge_id, websocket)
                except RuntimeError as e:
                    logger.warning(f"Registration rejected: {e}")
                    await websocket.send_json({
                        'type': 'error',
                        'code': 'MAX_CONNECTIONS',
                        'message': str(e),
                    })
                    continue

                # Short-lived DB session for registration
                db = next(get_db())
                try:
                    gw_db = GatewayDB(db)
                    bm = get_bridge_manager(db, gw_db)

                    bm.db = db
                    bm.db_gateway = gw_db
                    bm.load_from_db()

                    # Build BridgeInfo from registration data
                    adapters = []
                    for a in data.get('adapters', []):
                        try:
                            adapters.append(AdapterInfo(
                                type=AgentType(a.get('type', 'cli')),
                                agent_name=a.get('name', ''),
                                version=a.get('version'),
                                executable_path=a.get('executablePath'),
                            ))
                        except ValueError:
                            logger.warning(f"Invalid adapter type: {a.get('type')}")

                    bridge_info = BridgeInfo(
                        bridge_id=bridge_id,
                        platform=data.get('platform', 'unknown'),
                        hostname=data.get('hostname', 'unknown'),
                        os_version=data.get('osVersion'),
                        node_version=data.get('nodeVersion'),
                        bridge_version=data.get('bridgeVersion'),
                        status=BridgeStatus.ONLINE,
                        last_seen=int(time.time()),
                        available_adapters=adapters,
                        active_tasks=data.get('activeTasks', 0),
                        max_concurrent=data.get('maxConcurrent', 3),
                    )
                    bm.register_bridge(bridge_info)

                    # Set up async message handlers (use per-call sessions)
                    ws_server.set_handlers(
                        on_bridge_register=None,
                        on_bridge_disconnect=on_bridge_disconnect,
                        on_task_progress=on_task_progress,
                        on_task_complete=on_task_complete,
                        on_task_ack=on_task_ack,
                    )

                    # Get queued/running tasks for recovery
                    queued = gw_db.get_queued_tasks(bridge_id)
                    running = gw_db.get_running_tasks(bridge_id)
                    resumed_tasks = list(queued) + list(running)

                    # Send registration acknowledgment
                    await websocket.send_json({
                        'type': 'bridge.registered',
                        'bridgeId': bridge_id,
                        'status': 'ready',
                        'resumedTasks': [
                            {
                                'taskId': t.task_id,
                                'prompt': t.prompt,
                                'projectPath': t.project_path,
                                'agentType': t.agent_type,
                                'status': t.status,
                            }
                            for t in resumed_tasks
                        ],
                    })

                    # Resume queued tasks (uses same session — still short-lived)
                    if queued:
                        tr = TaskRouter(bm, ws_server, gw_db)
                        await tr.resume_queued_tasks(bridge_id)

                except Exception as e:
                    logger.error(f"Registration failed for bridge {bridge_id}: {e}")
                    continue
                finally:
                    db.close()

                # Start heartbeat checker
                heartbeat_task = asyncio.create_task(
                    _heartbeat_checker(websocket, bridge_id)
                )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif bridge_id:
                await ws_server.handle_message(bridge_id, data)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {bridge_id}")
        if bridge_id:
            await ws_server.disconnect(bridge_id)
        if heartbeat_task:
            heartbeat_task.cancel()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close(code=4000, reason="Internal error")
        except Exception:
            pass
        if bridge_id:
            await ws_server.disconnect(bridge_id)
        if heartbeat_task:
            heartbeat_task.cancel()


async def _heartbeat_checker(websocket: WebSocket, bridge_id: str, interval: int = 30):
    """Periodic ping to detect silent disconnects."""
    while True:
        await asyncio.sleep(interval)
        try:
            await websocket.send_json({"type": "ping"})
        except Exception:
            logger.warning(f"Heartbeat failed for Bridge {bridge_id}")
            if ws_server:
                await ws_server.disconnect(bridge_id)
            break

"""Gateway router - HTTP API + WebSocket endpoint."""
import asyncio
import logging
import time
from typing import Optional

from fastapi import (
    APIRouter, Query, WebSocket, WebSocketDisconnect, Depends,
)
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import verify_api_key, verify_gateway_token
from app.models.gateway_schemas import (
    AgentType, TaskPriority, TaskStatus, BridgeStatus, BridgeInfo,
    AdapterInfo, TaskRequest, TaskInfo, TaskListResponse,
    SubmitTaskRequest, SubmitTaskResponse, TaskStatusResponse,
    BridgeListResponse, BridgeFilter,
    GatewayError as GatewaySchemaError, GatewayErrorCode,
    GatewayErrorResponse,
)
from app.services.gateway.ws_server import WSServer
from app.services.gateway.bridge_manager import BridgeManager
from app.services.gateway.task_router import (
    TaskRouter, NoAvailableBridgeError, TaskNotFoundError,
)
from app.services.gateway.db_gateway import GatewayDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gateway", tags=["Gateway"])

# ---- Module-level singletons (initialized during app startup) ----

ws_server: Optional[WSServer] = None
bridge_manager: Optional[BridgeManager] = None
task_router: Optional[TaskRouter] = None
db_gateway: Optional[GatewayDB] = None


def init_gateway_services() -> None:
    """Initialize Gateway services. Called during app startup."""
    global ws_server, bridge_manager, task_router, db_gateway

    ws_server = WSServer()

    # Will be properly initialized with db session on first request
    # or during lifespan startup
    logger.info("Gateway WebSocket Server initialized")


def get_gateway_db(db: Session = Depends(get_db)) -> GatewayDB:
    """Get GatewayDB instance for current request."""
    return GatewayDB(db)


def get_components(db: Session = Depends(get_db)):
    """Get all gateway components for current request."""
    gw_db = GatewayDB(db)
    bm = BridgeManager(db, gw_db)
    bm.load_from_db()
    ws = ws_server  # shared singleton
    tr = TaskRouter(bm, ws, gw_db)

    # Wire up callbacks
    tr.handle_task_ack = tr.__class__.handle_task_ack.__get__(tr)
    tr.handle_task_progress = tr.__class__.handle_task_progress.__get__(tr)
    tr.handle_task_complete = tr.__class__.handle_task_complete.__get__(tr)

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
async def submit_task(
    request: SubmitTaskRequest,
    source: str = Query(default="http", description="Task source"),
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Submit a task to the Gateway."""
    gw_db, bm, ws, tr = get_components(db)

    task = TaskRequest(
        prompt=request.prompt,
        project_path=request.project_path,
        agent_type=request.agent_type,
        timeout=request.timeout,
        priority=request.priority,
        preferred_ide=request.preferred_ide,
        callback_id=request.callback_id,
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
        return SubmitTaskResponse(
            success=False,
            message="No available Bridge for this task",
        )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Query task status."""
    gw_db = get_gateway_db(db)
    record = gw_db.get_task(task_id)
    if not record:
        return TaskStatusResponse(success=False, data=None)
    return TaskStatusResponse(success=True, data=_task_record_to_info(record))


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
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
    gw_db = get_gateway_db(db)
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
async def cancel_task(
    task_id: str,
    reason: str = Query(default="user_request"),
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Cancel a task."""
    gw_db, bm, ws, tr = get_components(db)
    try:
        await tr.cancel_task(task_id, reason)
        return {"success": True, "message": "Task cancelled"}
    except TaskNotFoundError:
        return {"success": False, "message": "Task not found"}


@router.get("/bridges", response_model=BridgeListResponse)
async def list_bridges(
    status: Optional[BridgeStatus] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List all Bridges."""
    gw_db = get_gateway_db(db)
    filters = BridgeFilter(status=status, platform=platform)
    records = gw_db.get_all_bridges(filters)
    return BridgeListResponse(
        success=True,
        data=[_bridge_record_to_info(r) for r in records],
    )


@router.post("/bridges/{bridge_id}/disconnect")
async def force_disconnect_bridge(
    bridge_id: str,
    _api_key: str = Depends(verify_api_key),
):
    """Force disconnect a Bridge (admin use)."""
    if ws_server and ws_server.is_connected(bridge_id):
        await ws_server.disconnect(bridge_id)
    return {"success": True, "message": f"Bridge {bridge_id} disconnected"}


# ============ WebSocket Endpoint ============

@router.websocket("/ws")
async def gateway_ws(
    websocket: WebSocket,
    token: str = Query(..., description="API Key for authentication"),
):
    """Gateway WebSocket connection endpoint.

    Authentication: pass token as query parameter.
    Protocol:
    1. Connect with ?token=xxx
    2. Send bridge.register message
    3. Receive ack with resumed tasks (if any)
    4. Receive and execute tasks
    """
    # Handshake authentication
    if not verify_gateway_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    bridge_id = None
    heartbeat_task = None

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
                await ws_server.register(bridge_id, websocket)

                # Register in Bridge manager
                db = next(get_db())
                try:
                    gw_db = GatewayDB(db)
                    bm = BridgeManager(db, gw_db)
                    bm.load_from_db()

                    # Build BridgeInfo from registration data
                    adapters = []
                    for a in data.get('adapters', []):
                        adapters.append(AdapterInfo(
                            type=AgentType(a.get('type', 'cli')),
                            agent_name=a.get('name', ''),
                            version=a.get('version'),
                            executable_path=a.get('executablePath'),
                        ))

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

                    # Build TaskRouter for this session
                    tr = TaskRouter(bm, ws_server, gw_db)

                    # Set up message handlers
                    def on_bridge_disconnect(bid: str):
                        nonlocal heartbeat_task
                        bm.set_bridge_offline(bid)

                    def on_task_progress(bid: str, msg: dict):
                        tr.handle_task_progress(bid, msg)

                    def on_task_complete(bid: str, msg: dict):
                        tr.handle_task_complete(bid, msg)

                    def on_task_ack(bid: str, msg: dict):
                        tr.handle_task_ack(bid, msg)

                    ws_server.set_handlers(
                        on_bridge_register=None,
                        on_bridge_disconnect=on_bridge_disconnect,
                        on_task_progress=on_task_progress,
                        on_task_complete=on_task_complete,
                        on_task_ack=on_task_ack,
                    )

                    # Get queued tasks for recovery
                    queued = gw_db.get_queued_tasks(bridge_id)
                    running = gw_db.get_running_tasks(bridge_id)
                    resumed_tasks = [
                        _task_record_to_info(t)
                        for t in (list(queued) + list(running))
                    ]

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

                    # Resume queued tasks
                    if queued:
                        await tr.resume_queued_tasks(bridge_id)

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

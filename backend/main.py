from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.rate_limit import limiter
from app.routers import agents, tasks, workflows, cost, org, heartbeats, gateway, auth
from app.services.scheduler import scheduler
from app.services.heartbeat import HeartbeatService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    print("Starting heartbeat scheduler...")
    # Initialize heartbeat service
    from app.database import get_db, engine, Base
    from app.models.gateway import BridgeRecord, TaskRecord  # noqa: F401

    # Create gateway tables if not exist
    Base.metadata.create_all(bind=engine, tables=[
        BridgeRecord.__table__,
        TaskRecord.__table__,
    ])
    print("Gateway tables ensured")

    db = next(get_db())
    heartbeat_service = HeartbeatService(db)
    scheduler.set_heartbeat_service(heartbeat_service)

    scheduler.start()
    # Load and schedule all active heartbeats from database
    await scheduler.load_and_schedule_heartbeats()
    print("Heartbeat scheduler started and jobs loaded")

    # Initialize Gateway WebSocket Server
    gateway.init_gateway_services()
    print("Gateway WebSocket Server initialized")

    yield

    # Shutdown
    print("Shutting down Gateway WebSocket Server...")
    print("Shutting down heartbeat scheduler...")
    scheduler.shutdown(wait=True)
    print("Heartbeat scheduler shutdown complete")


app = FastAPI(
    title="AI Agent Orchestrator API",
    description="AI Agent 编排可视化工具后端 API",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(cost.router, prefix="/api/cost", tags=["cost"])
app.include_router(org.router, prefix="/api/org", tags=["organization"])
app.include_router(heartbeats.router, prefix="/api/heartbeats", tags=["heartbeats"])
app.include_router(gateway.router, prefix="/api/gateway", tags=["Gateway"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])


@app.get("/")
async def root():
    return {"message": "AI Agent Orchestrator API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.rate_limit import limiter
from app.routers import agents_legacy, tasks_legacy, workflows, cost, org, heartbeats, gateway, auth
from app.routers import agents as agents_v1, projects, tasks as tasks_v1, jobs
from app.routers import admin, settings as settings_router, notifications, stats
from app.routers import bridges, agent_types, project_documents, task_files, tasks_v3
from app.services.scheduler import scheduler
from app.services.heartbeat import HeartbeatService
# Import workflow engine to register node types
from app.services.workflow_engine import workflow_engine  # noqa: F401


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

    # Run seed data
    from app.services.seed import run_seed
    run_seed(db)
    print("Seed data initialized")

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
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(agents_legacy.router, prefix="/api/agents", tags=["agents"])
app.include_router(tasks_legacy.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["v1-workflows"])
app.include_router(cost.router, prefix="/api/cost", tags=["cost"])
app.include_router(org.router, prefix="/api/org", tags=["organization"])
app.include_router(heartbeats.router, prefix="/api/heartbeats", tags=["heartbeats"])
app.include_router(gateway.router, prefix="/api/gateway", tags=["Gateway"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth-compat"])

# v1 business routes
app.include_router(agents_v1.router, prefix="/api/v1/agents", tags=["v1-agents"])
app.include_router(agents_v1.router, prefix="/api/v1/agent-types", tags=["v1-agent-types"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["v1-projects"])
app.include_router(tasks_v3.router, prefix="/api/v1/tasks", tags=["v3-tasks"])
app.include_router(tasks_v1.router, prefix="/api/v1/projects/{project_id}/tasks", tags=["v1-tasks"])
app.include_router(tasks_v1.router, prefix="/api/v1/tasks", tags=["v1-tasks"])
app.include_router(jobs.router, prefix="/api/v1/tasks/{task_id}/jobs", tags=["v1-jobs"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["v1-jobs"])

# Phase 2: bridges, agent-types, project docs/configs, task files
app.include_router(bridges.router, prefix="/api/v1/bridges", tags=["bridges"])
app.include_router(bridges.router, prefix="/api/bridges", tags=["bridges-compat"])
app.include_router(agent_types.router, prefix="/api/v1/agent-types-manage", tags=["agent-types-manage"])
app.include_router(project_documents.router, prefix="/api/v1/projects/{project_id}", tags=["project-docs"])
app.include_router(task_files.router, prefix="/api/v1/tasks/{task_id}/files", tags=["task-files"])

# Phase 3: task tree, human interventions, batch actions

# v1 admin / settings / notifications / stats routes
app.include_router(admin.router, prefix="/api/v1/admin", tags=["v1-admin"])
app.include_router(settings_router.router, prefix="/api/v1/admin/settings", tags=["v1-settings"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["v1-notifications"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["v1-stats"])


@app.get("/")
async def root():
    return {"message": "AI Agent Orchestrator API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# ── API path compatibility: /api/* → /api/v1/* ──
app.include_router(projects.router, prefix="/api/projects", tags=["projects-compat"])
app.include_router(agents_v1.router, prefix="/api/agent-types", tags=["agent-types-compat"])
app.include_router(tasks_v1.router, prefix="/api/projects/{project_id}/tasks", tags=["tasks-compat"])
app.include_router(tasks_v1.router, prefix="/api/tasks", tags=["tasks-compat"])
app.include_router(agents_v1.router, prefix="/api/agents", tags=["agents-v1-compat"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs-compat"])

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agents, tasks, workflows, cost, org

app = FastAPI(
    title="AI Agent Orchestrator API",
    description="AI Agent 编排可视化工具后端 API",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 前端地址
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

@app.get("/")
async def root():
    return {"message": "AI Agent Orchestrator API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel

from ..models.agent import AgentCreate, AgentUpdate, Agent, AgentStats, AgentLogsRequest
from ..services.agent import AgentService
from ..database import get_db

router = APIRouter()


class AgentResponse(BaseModel):
    success: bool
    data: Optional[Agent] = None
    message: str = ""


@router.get("/", response_model=List[Agent])
async def get_agents(db = Depends(get_db)):
    """获取所有 Agent"""
    agent_service = AgentService(db)
    return agent_service.get_all_agents()


@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, db = Depends(get_db)):
    """创建新 Agent"""
    try:
        agent_service = AgentService(db)
        db_agent = agent_service.create_agent(agent)
        return AgentResponse(
            success=True,
            data=db_agent,
            message="Agent created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str):
    """获取单个 Agent"""
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentResponse(success=True, data=agent)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, agent: AgentUpdate):
    """更新 Agent"""
    updated_agent = await agent_service.update_agent(agent_id, agent)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentResponse(
        success=True,
        data=updated_agent,
        message="Agent updated successfully"
    )


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """删除 Agent"""
    deleted = await agent_service.delete_agent(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent deleted successfully"}


@router.post("/{agent_id}/start")
async def start_agent(agent_id: str):
    """启动 Agent"""
    agent = await agent_service.start_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent started", "data": agent}


@router.post("/{agent_id}/stop")
async def stop_agent(agent_id: str):
    """停止 Agent"""
    agent = await agent_service.stop_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent stopped", "data": agent}


@router.get("/{agent_id}/stats")
async def get_agent_stats(agent_id: str):
    """获取 Agent 性能统计"""
    stats = await agent_service.get_agent_stats(agent_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "success": True,
        "data": stats,
        "message": "Agent statistics retrieved successfully"
    }


@router.get("/{agent_id}/logs")
async def get_agent_logs(agent_id: str, page: int = 1, page_size: int = 50,
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None,
                        level: Optional[str] = None):
    """获取 Agent 运行日志"""
    logs = await agent_service.get_agent_logs(agent_id, page, page_size, start_time, end_time, level)

    return {
        "success": True,
        "data": logs,
        "message": "Agent logs retrieved successfully"
    }
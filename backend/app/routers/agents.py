from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from ..models.agent import AgentCreate, AgentUpdate, Agent
from ..services.agent import AgentService

router = APIRouter()

agent_service = AgentService()


class AgentResponse(BaseModel):
    success: bool
    data: Optional[Agent] = None
    message: str = ""


@router.get("/", response_model=List[Agent])
async def get_agents():
    """获取所有 Agent"""
    return await agent_service.get_all_agents()


@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate):
    """创建新 Agent"""
    try:
        db_agent = await agent_service.create_agent(agent)
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
    # TODO: 实现实际的 Agent 启动逻辑
    return {"success": True, "message": "Agent started"}


@router.post("/{agent_id}/stop")
async def stop_agent(agent_id: str):
    """停止 Agent"""
    # TODO: 实现实际的 Agent 停止逻辑
    return {"success": True, "message": "Agent stopped"}
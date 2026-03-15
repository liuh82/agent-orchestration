import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel

from ..models.agent_legacy import AgentCreate, AgentUpdate, Agent, AgentStats, AgentLogsRequest
from ..models.agent_type import AgentType
from ..services.agent_service import AgentService
from ..database import get_db

router = APIRouter()


class AgentResponse(BaseModel):
    success: bool
    data: Optional[Agent] = None
    message: str = ""


def _parse_json(val: Optional[str]) -> Optional:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


# ── Agent Types (public — all authenticated users) ─────────


@router.get("/types/")
async def list_agent_types(db=Depends(get_db)):
    """获取所有代理类型（公开接口，所有已认证用户可访问）"""
    types = db.query(AgentType).order_by(AgentType.created_at.asc()).all()
    items = []
    for t in types:
        items.append({
            "id": t.id,
            "name": t.name,
            "display_name": t.display_name,
            "protocol": t.protocol,
            "config_schema": _parse_json(t.config_schema),
            "capabilities": _parse_json(t.capabilities) or [],
            "default_models": _parse_json(t.default_models) or [],
            "is_system": t.is_system,
            "created_by": t.created_by,
            "created_at": t.created_at or "",
        })
    return {"success": True, "data": items}


# ── Agent CRUD ─────────────────────────────────────────────


@router.get("/", response_model=List[Agent])
async def get_agents(db = Depends(get_db)):
    """获取所有 Agent"""
    agent_service = AgentService()
    return await agent_service.get_all_agents(db)


@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, db = Depends(get_db)):
    """创建新 Agent"""
    try:
        agent_service = AgentService()
        db_agent = await agent_service.create_agent(db, agent)
        return AgentResponse(
            success=True,
            data=db_agent,
            message="Agent created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db = Depends(get_db)):
    """获取单个 Agent"""
    agent_service = AgentService()
    agent = await agent_service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentResponse(success=True, data=agent)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, agent: AgentUpdate, db = Depends(get_db)):
    """更新 Agent"""
    agent_service = AgentService()
    updated_agent = await agent_service.update_agent(db, agent_id, agent)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentResponse(
        success=True,
        data=updated_agent,
        message="Agent updated successfully"
    )


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, db = Depends(get_db)):
    """删除 Agent"""
    agent_service = AgentService()
    deleted = await agent_service.delete_agent(db, agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent deleted successfully"}


@router.post("/{agent_id}/start")
async def start_agent(agent_id: str, db = Depends(get_db)):
    """启动 Agent"""
    agent_service = AgentService()
    agent = await agent_service.start_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent started", "data": agent}


@router.post("/{agent_id}/stop")
async def stop_agent(agent_id: str, db = Depends(get_db)):
    """停止 Agent"""
    agent_service = AgentService()
    agent = await agent_service.stop_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {"success": True, "message": "Agent stopped", "data": agent}


@router.get("/{agent_id}/stats")
async def get_agent_stats(agent_id: str, db = Depends(get_db)):
    """获取 Agent 性能统计"""
    agent_service = AgentService()
    stats = await agent_service.get_agent_stats(db, agent_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "success": True,
        "data": stats,
        "message": "Agent statistics retrieved successfully"
    }


@router.get("/{agent_id}/logs")
async def get_agent_logs(agent_id: str, page: int = 1, page_size: int = Query(default=50, le=100),
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None,
                        level: Optional[str] = None,
                        db = Depends(get_db)):
    """获取 Agent 运行日志"""
    agent_service = AgentService()
    logs = await agent_service.get_agent_logs(db, agent_id, page, page_size, start_time, end_time, level)

    return {
        "success": True,
        "data": logs,
        "message": "Agent logs retrieved successfully"
    }

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from ..models.cost import CostEntry, CostReport, BudgetConfig, CostAlert
from ..services.cost import CostService

router = APIRouter()

cost_service = CostService()


@router.get("/report")
async def get_cost_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    days: int = Query(default=30, ge=1, le=365)
):
    """获取成本报告"""
    if start_date and end_date:
        if start_date >= end_date:
            raise HTTPException(status_code=400, detail="start_date must be before end_date")
    else:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

    report = await cost_service.get_cost_report(start_date, end_date)
    return {
        "success": True,
        "data": report
    }


@router.post("/budgets", response_model=dict)
async def create_budget(budget: BudgetConfig):
    """创建预算配置"""
    try:
        db_budget = await cost_service.create_budget(budget)
        return {
            "success": True,
            "data": db_budget,
            "message": "Budget created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/budgets", response_model=List[BudgetConfig])
async def get_budgets():
    """获取所有预算配置"""
    # TODO: 从数据库查询预算配置
    return []


@router.get("/alerts", response_model=dict)
async def get_cost_alerts(unread_only: bool = Query(default=False)):
    """获取成本告警"""
    try:
        alerts = await cost_service.check_budget_alerts()

        if unread_only:
            alerts = [alert for alert in alerts if not alert.is_read]

        return {
            "success": True,
            "data": alerts,
            "total": len(alerts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/mark-read")
async def mark_alert_as_read(alert_id: str):
    """标记告警为已读"""
    # TODO: 实现更新告警状态的逻辑
    return {"success": True, "message": "Alert marked as read"}


@router.post("/record", response_model=dict)
async def record_cost(
    agent_id: str,
    task_id: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    metadata: dict = {}
):
    """记录成本"""
    try:
        entry = await cost_service.record_cost(
            agent_id,
            task_id,
            model,
            input_tokens,
            output_tokens,
            metadata
        )

        return {
            "success": True,
            "data": entry,
            "message": "Cost recorded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
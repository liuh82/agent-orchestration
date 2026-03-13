from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from ..models.budget import BudgetCreate, BudgetUpdate, Budget, CostAlert, AgentCostSummary
from ..services.budget_service import BudgetService

router = APIRouter()



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


@router.post("/budget", response_model=dict)
async def create_budget(budget: BudgetCreate):
    """创建预算"""
    try:
        db_budget = await budget_service.create_budget(budget)
        return {
            "success": True,
            "data": db_budget,
            "message": "Budget created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/budget", response_model=List[Budget])
async def get_budgets():
    """获取所有预算"""
    budgets = await budget_service.get_all_budgets()
    return budgets


@router.get("/budget/{budget_id}", response_model=dict)
async def get_budget(budget_id: str):
    """获取单个预算"""
    budget = await budget_service.get_budget(budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {
        "success": True,
        "data": budget,
        "message": "Budget retrieved successfully"
    }


@router.put("/budget/{budget_id}", response_model=dict)
async def update_budget(budget_id: str, budget: BudgetUpdate):
    """更新预算"""
    updated_budget = await budget_service.update_budget(budget_id, budget)
    if not updated_budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {
        "success": True,
        "data": updated_budget,
        "message": "Budget updated successfully"
    }


@router.post("/alert", response_model=dict)
async def create_cost_alert(agent_id: str, tokens_used: int, cost: float):
    """创建成本告警"""
    try:
        # Update daily costs first
        await budget_service.update_daily_costs(agent_id, tokens_used, cost)

        # Then check for budget alerts
        alerts = await budget_service.check_budget_alerts()

        return {
            "success": True,
            "data": alerts,
            "message": "Cost recorded and alerts checked"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alert", response_model=dict)
async def get_cost_alerts():
    """获取所有未确认的成本告警"""
    try:
        alerts = await budget_service.check_budget_alerts()

        return {
            "success": True,
            "data": [alert for alert in alerts if not alert.acknowledged],
            "total": len([alert for alert in alerts if not alert.acknowledged])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alert/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """确认告警"""
    try:
        success = await budget_service.acknowledge_alert(alert_id)
        if not success:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert acknowledged successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/by-agent", response_model=dict)
async def get_cost_by_agent(
    agent_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """按 Agent 统计成本"""
    try:
        summary = await budget_service.get_agent_cost_summary(agent_id, start_date, end_date)

        if not summary:
            raise HTTPException(status_code=404, detail="No cost data found for this agent")

        return {
            "success": True,
            "data": summary,
            "message": "Agent cost summary retrieved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
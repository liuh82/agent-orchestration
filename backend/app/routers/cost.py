from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi import Depends

from ..models.budget import BudgetCreate, BudgetUpdate, Budget, CostAlert, AgentCostSummary
from ..services.budget_service import BudgetService
from ..database import get_db

router = APIRouter()



@router.get("/report")
async def get_cost_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    days: int = Query(default=30, ge=1, le=365),
    db = Depends(get_db)
):
    """获取成本报告"""
    if start_date and end_date:
        if start_date >= end_date:
            raise HTTPException(status_code=400, detail="start_date must be before end_date")
    else:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

    budget_service = BudgetService()
    report = await budget_service.get_cost_summary(db,
                                                  start_date.isoformat() if start_date else None,
                                                  end_date.isoformat() if end_date else None)
    return {
        "success": True,
        "data": report
    }


@router.post("/budget", response_model=dict)
async def create_budget(budget: BudgetCreate, db = Depends(get_db)):
    """创建预算"""
    try:
        budget_service = BudgetService()
        db_budget = await budget_service.create_budget(db, budget)
        return {
            "success": True,
            "data": db_budget,
            "message": "Budget created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/budget", response_model=List[Budget])
async def get_budgets(db = Depends(get_db)):
    """获取所有预算"""
    budget_service = BudgetService()
    budgets = await budget_service.get_all_budgets(db)
    return budgets


@router.get("/budget/{budget_id}", response_model=dict)
async def get_budget(budget_id: str, db = Depends(get_db)):
    """获取单个预算"""
    budget_service = BudgetService()
    budget = await budget_service.get_budget(db, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {
        "success": True,
        "data": budget,
        "message": "Budget retrieved successfully"
    }


@router.put("/budget/{budget_id}", response_model=dict)
async def update_budget(budget_id: str, budget: BudgetUpdate, db = Depends(get_db)):
    """更新预算"""
    budget_service = BudgetService()
    updated_budget = await budget_service.update_budget(db, budget_id, budget)
    if not updated_budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {
        "success": True,
        "data": updated_budget,
        "message": "Budget updated successfully"
    }


@router.delete("/budget/{budget_id}")
async def delete_budget(budget_id: str, db = Depends(get_db)):
    """删除预算"""
    budget_service = BudgetService()
    success = await budget_service.delete_budget(db, budget_id)
    if not success:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {"success": True, "message": "Budget deleted successfully"}


@router.get("/budget/{budget_id}/alerts")
async def get_budget_alerts(budget_id: str, db = Depends(get_db)):
    """获取指定预算的告警"""
    budget_service = BudgetService()
    alerts = await budget_service.get_budget_alerts(db, budget_id)
    return {
        "success": True,
        "data": alerts,
        "total": len(alerts)
    }


@router.post("/alert", response_model=dict)
async def create_cost_alert(agent_id: str, tokens_used: int, cost: float, db = Depends(get_db)):
    """创建成本告警"""
    try:
        budget_service = BudgetService()

        # Update daily costs first
        today = datetime.now().strftime('%Y-%m-%d')
        await budget_service.update_daily_cost(db, agent_id, today, tokens_used, cost)

        # Then check for budget alerts
        alerts = await budget_service.check_budget_threshold(db, agent_id)

        return {
            "success": True,
            "data": alerts,
            "message": "Cost recorded and alerts checked"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alert", response_model=dict)
async def get_cost_alerts(db = Depends(get_db)):
    """获取所有未确认的成本告警"""
    try:
        budget_service = BudgetService()
        alerts = await budget_service.get_budget_alerts(db)

        return {
            "success": True,
            "data": [alert for alert in alerts if not alert.is_resolved],
            "total": len([alert for alert in alerts if not alert.is_resolved])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alert/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, db = Depends(get_db)):
    """确认告警"""
    try:
        budget_service = BudgetService()
        success = await budget_service.acknowledge_alert(db, alert_id)
        if not success:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert acknowledged successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/by-agent", response_model=dict)
async def get_cost_by_agent(
    agent_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db = Depends(get_db)
):
    """按 Agent 统计成本"""
    try:
        budget_service = BudgetService()
        summary = await budget_service.get_agent_cost_summary(db, agent_id, "monthly")

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
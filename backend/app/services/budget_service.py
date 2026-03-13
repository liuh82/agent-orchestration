from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.orm import Session, joinedload
from app.models.orm_models import Budget, CostAlert, DailyCost, Agent, CostEntry
from app.models.budget import BudgetCreate, BudgetUpdate, Budget, CostAlert, AgentCostSummary


class BudgetService:
    def __init__(self):
        # No need for database connection - handled by dependency injection
        pass

    async def get_all_budgets(self, db: Session) -> List[Budget]:
        """获取所有预算"""
        result = db.execute(select(Budget).order_by(Budget.created_at.desc()))
        return result.scalars().all()

    async def get_budget(self, db: Session, budget_id: str) -> Optional[Budget]:
        """获取单个预算"""
        result = db.execute(select(Budget).where(Budget.id == budget_id))
        return result.scalar_one_or_none()

    async def create_budget(self, db: Session, budget: BudgetCreate, agent_id: str = None) -> Budget:
        """创建新预算"""
        budget_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        db_budget = Budget(
            id=budget_id,
            name=budget.name,
            amount=budget.amount,
            currency=budget.currency,
            period=budget.period,
            current_cost=0.0,
            is_triggered=False,
            threshold_percentage=budget.threshold_percentage,
            status='active',
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat(),
            agent_id=agent_id
        )

        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)

        return db_budget

    async def update_budget(self, db: Session, budget_id: str, budget: BudgetUpdate) -> Optional[Budget]:
        """更新预算"""
        existing_budget = await self.get_budget(db, budget_id)
        if not existing_budget:
            return None

        updated_at = datetime.now()

        db.execute(
            update(Budget)
            .where(Budget.id == budget_id)
            .values(
                name=budget.name,
                amount=budget.amount,
                currency=budget.currency,
                period=budget.period,
                threshold_percentage=budget.threshold_percentage,
                status=budget.status,
                updated_at=updated_at.isoformat()
            )
        )
        db.commit()

        return await self.get_budget(db, budget_id)

    async def delete_budget(self, db: Session, budget_id: str) -> bool:
        """删除预算"""
        result = db.execute(delete(Budget).where(Budget.id == budget_id))
        db.commit()
        return result.rowcount > 0

    async def get_cost_summary(self, db: Session, start_date: Optional[str] = None,
                             end_date: Optional[str] = None) -> Dict[str, Any]:
        """获取成本汇总"""
        query = select(
            func.sum(CostEntry.total_cost).label('total_cost'),
            func.sum(CostEntry.input_tokens).label('total_input_tokens'),
            func.sum(CostEntry.output_tokens).label('total_output_tokens'),
            func.count(CostEntry.id).label('total_calls')
        )

        if start_date:
            query = query.where(CostEntry.timestamp >= start_date)
        if end_date:
            query = query.where(CostEntry.timestamp <= end_date)

        result = db.execute(query).scalar_one_or_none()

        return {
            'total_cost': result[0] or 0.0,
            'total_input_tokens': result[1] or 0,
            'total_output_tokens': result[2] or 0,
            'total_calls': result[3] or 0
        }

    async def get_costs_by_agent(self, db: Session, agent_id: str, start_date: Optional[str] = None,
                               end_date: Optional[str] = None, page: int = 1, page_size: int = 50) -> List[Dict[str, Any]]:
        """获取指定 Agent 的成本记录"""
        query = select(CostEntry).where(CostEntry.agent_id == agent_id)

        if start_date:
            query = query.where(CostEntry.timestamp >= start_date)
        if end_date:
            query = query.where(CostEntry.timestamp <= end_date)

        query = query.order_by(CostEntry.timestamp.desc())

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = db.execute(query)
        costs = result.scalars().all()

        return [
            {
                'id': cost.id,
                'agent_id': cost.agent_id,
                'task_id': cost.task_id,
                'model': cost.model,
                'input_tokens': cost.input_tokens,
                'output_tokens': cost.output_tokens,
                'total_cost': cost.total_cost,
                'currency': cost.currency,
                'timestamp': cost.timestamp,
                'metadata': cost.metadata_ if cost.metadata_ else {}
            }
            for cost in costs
        ]

    async def get_agent_cost_summary(self, db: Session, agent_id: str, period: str = "monthly") -> List[AgentCostSummary]:
        """获取 Agent 成本汇总"""
        if period == "daily":
            # Daily cost aggregation
            query = select(
                DailyCost.date,
                func.sum(DailyCost.total_cost).label('daily_cost'),
                func.sum(DailyCost.input_tokens).label('daily_input_tokens'),
                func.sum(DailyCost.output_tokens).label('daily_output_tokens')
            ).where(DailyCost.agent_id == agent_id).group_by(DailyCost.date).order_by(DailyCost.date.desc())
        else:
            # Monthly cost aggregation (would need to extract month from timestamp)
            query = select(
                func.strftime('%Y-%m', CostEntry.timestamp).label('month'),
                func.sum(CostEntry.total_cost).label('monthly_cost'),
                func.sum(CostEntry.input_tokens).label('monthly_input_tokens'),
                func.sum(CostEntry.output_tokens).label('monthly_output_tokens')
            ).where(CostEntry.agent_id == agent_id).group_by(func.strftime('%Y-%m', CostEntry.timestamp))

        result = db.execute(query)
        return [
            AgentCostSummary(
                period=row[0],
                total_cost=row[1] or 0.0,
                total_input_tokens=row[2] or 0,
                total_output_tokens=row[3] or 0
            )
            for row in result.fetchall()
        ]

    async def check_budget_threshold(self, db: Session, budget_id: str) -> Optional[CostAlert]:
        """检查预算阈值并创建告警"""
        budget = await self.get_budget(db, budget_id)
        if not budget or budget.status != 'active':
            return None

        # Calculate current percentage
        if budget.amount > 0:
            percentage = (budget.current_cost / budget.amount) * 100
        else:
            percentage = 0

        # Check if threshold is exceeded
        if percentage >= budget.threshold_percentage and not budget.is_triggered:
            # Create alert
            alert_id = str(uuid4())
            alert = CostAlert(
                id=alert_id,
                budget_id=budget_id,
                current_cost=budget.current_cost,
                threshold_percentage=budget.threshold_percentage,
                message=f'Budget {budget.name} has reached {percentage:.1f}% of its limit',
                is_triggered=True
            )

            db.add(alert)
            db.commit()

            # Update budget triggered status
            db.execute(
                update(Budget)
                .where(Budget.id == budget_id)
                .values(is_triggered=True)
            )
            db.commit()

            return alert

        return None

    async def get_budget_alerts(self, db: Session, budget_id: Optional[str] = None) -> List[CostAlert]:
        """获取预算告警"""
        query = select(CostAlert)
        if budget_id:
            query = query.where(CostAlert.budget_id == budget_id)

        result = db.execute(query.order_by(CostAlert.created_at.desc()))
        return result.scalars().all()

    async def acknowledge_alert(self, db: Session, alert_id: str) -> bool:
        """确认告警"""
        result = db.execute(
            update(CostAlert)
            .where(CostAlert.id == alert_id)
            .values(
                is_resolved=True,
                resolved_at=datetime.now().isoformat()
            )
        )
        db.commit()
        return result.rowcount > 0

    async def get_daily_costs(self, db: Session, agent_id: Optional[str] = None,
                            date: Optional[str] = None, page: int = 1, page_size: int = 50) -> List[Dict[str, Any]]:
        """获取每日成本记录"""
        query = select(DailyCost)

        if agent_id:
            query = query.where(DailyCost.agent_id == agent_id)
        if date:
            query = query.where(DailyCost.date == date)

        query = query.order_by(DailyCost.date.desc())

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = db.execute(query)
        daily_costs = result.scalars().all()

        return [
            {
                'id': cost.id,
                'agent_id': cost.agent_id,
                'budget_id': cost.budget_id,
                'date': cost.date,
                'input_tokens': cost.input_tokens,
                'output_tokens': cost.output_tokens,
                'total_cost': cost.total_cost,
                'currency': cost.currency
            }
            for cost in daily_costs
        ]

    async def update_daily_cost(self, db: Session, agent_id: str, date: str,
                             tokens_used: int, cost: float, currency: str = "USD"):
        """更新每日成本记录"""
        # Try to get existing record
        result = db.execute(
            select(DailyCost).where(
                and_(DailyCost.agent_id == agent_id, DailyCost.date == date)
            )
        )
        existing_cost = result.scalar_one_or_none()

        if existing_cost:
            # Update existing record
            db.execute(
                update(DailyCost)
                .where(DailyCost.id == existing_cost.id)
                .values(
                    input_tokens=DailyCost.input_tokens + tokens_used,
                    output_tokens=DailyCost.output_tokens + tokens_used,
                    total_cost=DailyCost.total_cost + cost
                )
            )
        else:
            # Create new record
            new_cost = DailyCost(
                id=str(uuid4()),
                agent_id=agent_id,
                date=date,
                input_tokens=tokens_used,
                output_tokens=tokens_used,
                total_cost=cost,
                currency=currency
            )
            db.add(new_cost)

        db.commit()
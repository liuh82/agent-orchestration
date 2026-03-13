from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4
from sqlalchemy import select, update, delete, func, and_, or_, desc
from sqlalchemy.orm import Session
from app.models.orm_models import Budget as BudgetORM, CostAlert as CostAlertORM, DailyCost as DailyCostORM, CostEntry
from app.models.budget import BudgetCreate, BudgetUpdate, Budget, CostAlert, AgentCostSummary


class BudgetService:
    def __init__(self):
        # No need for database connection - handled by dependency injection
        pass

    async def get_all_budgets(self, db: Session) -> List[Budget]:
        """获取所有预算"""
        result = db.execute(select(BudgetORM).order_by(desc(BudgetORM.created_at)))
        budget_orms = result.scalars().all()

        budgets = []
        for budget_orm in budget_orms:
            budgets.append(Budget(
                id=budget_orm.id,
                name=budget_orm.name,
                agent_id=budget_orm.agent_id,
                amount=budget_orm.amount,
                currency=budget_orm.currency,
                period=budget_orm.period,
                current_cost=budget_orm.current_cost,
                is_triggered=budget_orm.is_triggered,
                threshold_percentage=budget_orm.threshold_percentage,
                status=budget_orm.status,
                created_at=datetime.fromisoformat(budget_orm.created_at),
                updated_at=datetime.fromisoformat(budget_orm.updated_at)
            ))
        return budgets

    async def get_budget(self, db: Session, budget_id: str) -> Optional[Budget]:
        """获取单个预算"""
        result = db.execute(select(BudgetORM).where(BudgetORM.id == budget_id))
        budget_orm = result.scalar_one_or_none()
        if not budget_orm:
            return None

        return Budget(
            id=budget_orm.id,
            name=budget_orm.name,
            agent_id=budget_orm.agent_id,
            amount=budget_orm.amount,
            currency=budget_orm.currency,
            period=budget_orm.period,
            current_cost=budget_orm.current_cost,
            is_triggered=budget_orm.is_triggered,
            threshold_percentage=budget_orm.threshold_percentage,
            status=budget_orm.status,
            created_at=datetime.fromisoformat(budget_orm.created_at),
            updated_at=datetime.fromisoformat(budget_orm.updated_at)
        )

    async def create_budget(self, db: Session, budget: BudgetCreate, agent_id: str = None) -> Budget:
        """创建新预算"""
        budget_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        db_budget = BudgetORM(
            id=budget_id,
            name=budget.name,
            amount=budget.amount,
            currency=budget.currency,
            period=budget.period,
            current_cost=0.0,
            is_triggered=False,
            threshold_percentage=budget.threshold_percentage,
            status=budget.status,
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat(),
            agent_id=agent_id
        )

        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)

        return await self.get_budget(db, budget_id)

    async def update_budget(self, db: Session, budget_id: str, budget: BudgetUpdate) -> Optional[Budget]:
        """更新预算"""
        result = db.execute(select(BudgetORM).where(BudgetORM.id == budget_id))
        budget_orm = result.scalar_one_or_none()
        if not budget_orm:
            return None

        updated_at = datetime.now()

        if budget.name:
            budget_orm.name = budget.name
        if budget.amount:
            budget_orm.amount = budget.amount
        if budget.currency:
            budget_orm.currency = budget.currency
        if budget.period:
            budget_orm.period = budget.period
        if budget.threshold_percentage:
            budget_orm.threshold_percentage = budget.threshold_percentage
        if budget.status:
            budget_orm.status = budget.status
        budget_orm.updated_at = updated_at.isoformat()

        db.commit()
        return await self.get_budget(db, budget_id)

    async def delete_budget(self, db: Session, budget_id: str) -> bool:
        """删除预算"""
        result = db.execute(delete(BudgetORM).where(BudgetORM.id == budget_id))
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

        result = db.execute(query).one_or_none()

        if result is None:
            return {
                'total_cost': 0.0,
                'total_input_tokens': 0,
                'total_output_tokens': 0,
                'total_calls': 0
            }

        return {
            'total_cost': float(result.total_cost or 0.0),
            'total_input_tokens': int(result.total_input_tokens or 0),
            'total_output_tokens': int(result.total_output_tokens or 0),
            'total_calls': int(result.total_calls or 0)
        }

    async def get_costs_by_agent(self, db: Session, agent_id: str, start_date: Optional[str] = None,
                               end_date: Optional[str] = None, page: int = 1, page_size: int = 50) -> List[Dict[str, Any]]:
        """获取指定 Agent 的成本记录"""
        query = select(CostEntry).where(CostEntry.agent_id == agent_id)

        if start_date:
            query = query.where(CostEntry.timestamp >= start_date)
        if end_date:
            query = query.where(CostEntry.timestamp <= end_date)

        query = query.order_by(desc(CostEntry.timestamp))

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
        # Get agent name
        from app.models.orm_models import Agent as AgentORM
        agent_result = db.execute(select(AgentORM).where(AgentORM.id == agent_id))
        agent_orm = agent_result.scalar_one_or_none()
        agent_name = agent_orm.name if agent_orm else "Unknown"

        if period == "daily":
            # Daily cost aggregation
            query = select(
                DailyCostORM.date,
                func.sum(DailyCostORM.total_cost).label('daily_cost'),
                func.sum(DailyCostORM.input_tokens).label('daily_input_tokens'),
                func.sum(DailyCostORM.output_tokens).label('daily_output_tokens')
            ).where(DailyCostORM.agent_id == agent_id).group_by(DailyCostORM.date).order_by(desc(DailyCostORM.date))
        else:
            # Monthly cost aggregation
            query = select(
                func.substr(CostEntry.timestamp, 1, 7).label('month'),
                func.sum(CostEntry.total_cost).label('monthly_cost'),
                func.sum(CostEntry.input_tokens).label('monthly_input_tokens'),
                func.sum(CostEntry.output_tokens).label('monthly_output_tokens')
            ).where(CostEntry.agent_id == agent_id).group_by(func.substr(CostEntry.timestamp, 1, 7))

        result = db.execute(query)
        rows = result.all()

        return [
            AgentCostSummary(
                agent_id=agent_id,
                agent_name=agent_name,
                period=row[0],
                total_cost=float(row[1] or 0.0),
                total_input_tokens=int(row[2] or 0),
                total_output_tokens=int(row[3] or 0)
            )
            for row in rows
        ]

    async def check_budget_threshold(self, db: Session, budget_id: str) -> Optional[CostAlert]:
        """检查预算阈值并创建告警"""
        budget_orm = await self._get_budget_orm(db, budget_id)
        if not budget_orm or budget_orm.status != 'active':
            return None

        # Calculate current percentage
        if budget_orm.amount > 0:
            percentage = (budget_orm.current_cost / budget_orm.amount) * 100
        else:
            percentage = 0

        # Check if threshold is exceeded
        if percentage >= budget_orm.threshold_percentage and not budget_orm.is_triggered:
            # Create alert
            alert_id = str(uuid4())
            alert_orm = CostAlertORM(
                id=alert_id,
                budget_id=budget_id,
                current_cost=budget_orm.current_cost,
                threshold_percentage=budget_orm.threshold_percentage,
                message=f'Budget {budget_orm.name} has reached {percentage:.1f}% of its limit',
                is_resolved=False
            )

            db.add(alert_orm)
            db.commit()

            # Update budget triggered status
            db.execute(
                update(BudgetORM)
                .where(BudgetORM.id == budget_id)
                .values(is_triggered=True)
            )
            db.commit()

            budget = await self.get_budget(db, budget_id)
            return CostAlert(
                id=alert_orm.id,
                budget_id=alert_orm.budget_id,
                current_cost=alert_orm.current_cost,
                threshold_percentage=alert_orm.threshold_percentage,
                message=alert_orm.message,
                is_resolved=alert_orm.is_resolved,
                created_at=datetime.fromisoformat(alert_orm.created_at),
                resolved_at=datetime.fromisoformat(alert_orm.resolved_at) if alert_orm.resolved_at else None
            )

        return None

    async def get_budget_alerts(self, db: Session, budget_id: Optional[str] = None) -> List[CostAlert]:
        """获取预算告警"""
        query = select(CostAlertORM)
        if budget_id:
            query = query.where(CostAlertORM.budget_id == budget_id)

        query = query.order_by(desc(CostAlertORM.created_at))
        result = db.execute(query)
        alert_orms = result.scalars().all()

        alerts = []
        for alert_orm in alert_orms:
            alerts.append(CostAlert(
                id=alert_orm.id,
                budget_id=alert_orm.budget_id,
                current_cost=alert_orm.current_cost,
                threshold_percentage=alert_orm.threshold_percentage,
                message=alert_orm.message,
                is_resolved=alert_orm.is_resolved,
                created_at=datetime.fromisoformat(alert_orm.created_at),
                resolved_at=datetime.fromisoformat(alert_orm.resolved_at) if alert_orm.resolved_at else None
            ))

        return alerts

    async def acknowledge_alert(self, db: Session, alert_id: str) -> bool:
        """确认告警"""
        result = db.execute(
            update(CostAlertORM)
            .where(CostAlertORM.id == alert_id)
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
        query = select(DailyCostORM)

        if agent_id:
            query = query.where(DailyCostORM.agent_id == agent_id)
        if date:
            query = query.where(DailyCostORM.date == date)

        query = query.order_by(desc(DailyCostORM.date))

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
            select(DailyCostORM).where(
                and_(DailyCostORM.agent_id == agent_id, DailyCostORM.date == date)
            )
        )
        existing_cost = result.scalar_one_or_none()

        if existing_cost:
            # Update existing record
            existing_cost.input_tokens = existing_cost.input_tokens + tokens_used
            existing_cost.output_tokens = existing_cost.output_tokens + tokens_used
            existing_cost.total_cost = existing_cost.total_cost + cost
        else:
            # Create new record
            new_cost = DailyCostORM(
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

    async def _get_budget_orm(self, db: Session, budget_id: str) -> Optional[BudgetORM]:
        """获取预算 ORM 对象"""
        result = db.execute(select(BudgetORM).where(BudgetORM.id == budget_id))
        return result.scalar_one_or_none()

import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from ..models.budget import BudgetCreate, BudgetUpdate, Budget, CostAlert, AgentCostSummary


class BudgetService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()

        # Budgets table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                alert_threshold REAL DEFAULT 0.8,
                enabled BOOLEAN DEFAULT TRUE,
                created_at TEXT,
                updated_at TEXT,
                current_cost REAL DEFAULT 0.0,
                is_triggered BOOLEAN DEFAULT FALSE
            )
        ''')

        # Cost alerts table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cost_alerts (
                id TEXT PRIMARY KEY,
                budget_id TEXT NOT NULL,
                amount REAL NOT NULL,
                percentage REAL NOT NULL,
                message TEXT NOT NULL,
                triggered_at TEXT NOT NULL,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_at TEXT,
                FOREIGN KEY (budget_id) REFERENCES budgets (id)
            )
        ''')

        # Daily cost tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_costs (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                total_tokens INTEGER DEFAULT 0,
                total_cost REAL DEFAULT 0.0,
                task_count INTEGER DEFAULT 0,
                created_at TEXT,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
            )
        ''')

        self.conn.commit()

    async def get_all_budgets(self) -> List[Budget]:
        """获取所有预算"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM budgets ORDER BY created_at DESC')
        rows = cursor.fetchall()

        budgets = []
        for row in rows:
            budget = Budget(
                id=row[0],
                name=row[1],
                amount=row[2],
                period=row[3],
                alert_threshold=row[4],
                enabled=bool(row[5]),
                created_at=datetime.fromisoformat(row[6]),
                updated_at=datetime.fromisoformat(row[7]),
                current_cost=row[8] if len(row) > 8 else 0.0,
                is_triggered=bool(row[9]) if len(row) > 9 else False
            )
            budgets.append(budget)

        return budgets

    async def get_budget(self, budget_id: str) -> Optional[Budget]:
        """获取单个预算"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM budgets WHERE id = ?', (budget_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Budget(
            id=row[0],
            name=row[1],
            amount=row[2],
            period=row[3],
            alert_threshold=row[4],
            enabled=bool(row[5]),
            created_at=datetime.fromisoformat(row[6]),
            updated_at=datetime.fromisoformat(row[7]),
            current_cost=row[8] if len(row) > 8 else 0.0,
            is_triggered=bool(row[9]) if len(row) > 9 else False
        )

    async def create_budget(self, budget: BudgetCreate) -> Budget:
        """创建新预算"""
        budget_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO budgets (id, name, amount, period, alert_threshold, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            budget_id,
            budget.name,
            budget.amount,
            budget.period,
            budget.alert_threshold,
            budget.enabled,
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_budget(budget_id)

    async def update_budget(self, budget_id: str, budget: BudgetUpdate) -> Optional[Budget]:
        """更新预算"""
        existing_budget = await self.get_budget(budget_id)
        if not existing_budget:
            return None

        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE budgets
            SET name = COALESCE(?, name),
                amount = COALESCE(?, amount),
                period = COALESCE(?, period),
                alert_threshold = COALESCE(?, alert_threshold),
                enabled = COALESCE(?, enabled),
                updated_at = ?
            WHERE id = ?
        ''', (
            budget.name,
            budget.amount,
            budget.period,
            budget.alert_threshold,
            budget.enabled,
            updated_at.isoformat(),
            budget_id
        ))
        self.conn.commit()

        return await self.get_budget(budget_id)

    async def check_budget_alerts(self) -> List[CostAlert]:
        """检查预算告警"""
        alerts = []
        budgets = await self.get_all_budgets()

        for budget in budgets:
            if not budget.enabled:
                continue

            threshold_amount = budget.amount * budget.alert_threshold

            if budget.current_cost >= threshold_amount:
                # Create alert if not already triggered
                if not budget.is_triggered:
                    alert = await self._create_alert(budget, budget.current_cost)
                    alerts.append(alert)

        return alerts

    async def _create_alert(self, budget: Budget, current_cost: float) -> CostAlert:
        """创建预算告警"""
        alert_id = str(uuid4())
        percentage = (current_cost / budget.amount) * 100
        message = f"Budget {budget.name} has reached {percentage:.1f}% of its limit (${current_cost:.2f}/${budget.amount:.2f})"
        triggered_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO cost_alerts (id, budget_id, amount, percentage, message, triggered_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            alert_id,
            budget.id,
            current_cost,
            percentage,
            message,
            triggered_at.isoformat()
        ))

        # Mark budget as triggered
        cursor.execute('''
            UPDATE budgets
            SET is_triggered = TRUE, current_cost = ?
            WHERE id = ?
        ''', (current_cost, budget.id))

        self.conn.commit()

        return CostAlert(
            id=alert_id,
            budget_id=budget.id,
            amount=current_cost,
            percentage=percentage,
            message=message,
            triggered_at=triggered_at
        )

    async def acknowledge_alert(self, alert_id: str) -> bool:
        """确认告警"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE cost_alerts
            SET acknowledged = TRUE, acknowledged_at = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), alert_id))
        self.conn.commit()

        return cursor.rowcount > 0

    async def get_agent_cost_summary(self, agent_id: str, start_date: Optional[datetime] = None,
                                   end_date: Optional[datetime] = None) -> Optional[AgentCostSummary]:
        """获取 Agent 成本汇总"""
        cursor = self.conn.cursor()

        query = '''
            SELECT total_tokens, total_cost, task_count
            FROM daily_costs
            WHERE agent_id = ?
        '''
        params = [agent_id]

        if start_date:
            query += ' AND date >= ?'
            params.append(start_date.date().isoformat())

        if end_date:
            query += ' AND date <= ?'
            params.append(end_date.date().isoformat())

        cursor.execute(query, params)
        rows = cursor.fetchall()

        if not rows:
            return None

        # Sum up all records
        total_tokens = sum(row[0] for row in rows)
        total_cost = sum(row[1] for row in rows)
        task_count = sum(row[2] for row in rows)

        # Get agent name
        cursor.execute('SELECT name FROM agents WHERE id = ?', (agent_id,))
        agent_name = cursor.fetchone()[0]

        return AgentCostSummary(
            agent_id=agent_id,
            agent_name=agent_name,
            total_tokens=total_tokens,
            total_cost=total_cost,
            task_count=task_count,
            avg_task_cost=total_cost / task_count if task_count > 0 else 0.0
        )

    async def update_daily_costs(self, agent_id: str, tokens_used: int, cost: float):
        """更新每日成本"""
        today = datetime.now().date().isoformat()

        cursor = self.conn.cursor()

        # Check if record exists for today
        cursor.execute('''
            SELECT id FROM daily_costs
            WHERE date = ? AND agent_id = ?
        ''', (today, agent_id))

        existing = cursor.fetchone()

        if existing:
            # Update existing record
            cursor.execute('''
                UPDATE daily_costs
                SET total_tokens = total_tokens + ?,
                    total_cost = total_cost + ?,
                    task_count = task_count + 1
                WHERE id = ?
            ''', (tokens_used, cost, existing[0]))
        else:
            # Create new record
            daily_id = str(uuid4())
            created_at = datetime.now()
            cursor.execute('''
                INSERT INTO daily_costs (id, date, agent_id, total_tokens, total_cost, task_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (daily_id, today, agent_id, tokens_used, cost, 1, created_at.isoformat()))

        self.conn.commit()

        # Update budget costs
        await self._update_budget_costs()
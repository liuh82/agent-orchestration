import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4

from ..models.cost import CostEntry, CostReport, BudgetConfig, CostAlert


class CostService:
    """成本控制服务"""

    def __init__(self):
        self.conn = sqlite3.connect('costs.db', check_same_thread=False)
        self._init_db()
        self._token_prices = {
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
        }

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cost_entries (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_cost REAL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                timestamp TEXT,
                metadata TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budget_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                period TEXT NOT NULL,
                alert_threshold REAL NOT NULL,
                notifications TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cost_alerts (
                id TEXT PRIMARY KEY,
                budget_id TEXT NOT NULL,
                message TEXT NOT NULL,
                current_cost REAL NOT NULL,
                threshold REAL NOT NULL,
                timestamp TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                metadata TEXT
            )
        ''')
        self.conn.commit()

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """计算成本"""
        price_info = self._token_prices.get(model)
        if not price_info:
            return 0.0

        return (input_tokens * price_info["input"] +
                output_tokens * price_info["output"]) / 1000  # 转换为美元

    async def record_cost(self, agent_id: str, task_id: str, model: str,
                         input_tokens: int, output_tokens: int, metadata: Dict = None) -> CostEntry:
        """记录成本"""
        cost = self._calculate_cost(model, input_tokens, output_tokens)

        entry = CostEntry(
            id=str(uuid4()),
            agent_id=agent_id,
            task_id=task_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_cost=cost,
            currency="USD",
            timestamp=datetime.now(),
            metadata=metadata or {}
        )

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO cost_entries (id, agent_id, task_id, model, input_tokens,
                                    output_tokens, total_cost, currency, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            entry.id,
            entry.agent_id,
            entry.task_id,
            entry.model,
            entry.input_tokens,
            entry.output_tokens,
            entry.total_cost,
            entry.currency,
            entry.timestamp.isoformat(),
            str(entry.metadata)
        ))
        self.conn.commit()

        return entry

    async def get_cost_report(self, start_date: datetime, end_date: datetime) -> CostReport:
        """生成成本报告"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT model, SUM(input_tokens), SUM(output_tokens), SUM(total_cost)
            FROM cost_entries
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY model
        ''', (start_date.isoformat(), end_date.isoformat()))

        model_data = cursor.fetchall()
        total_input_tokens = sum(row[1] for row in model_data)
        total_output_tokens = sum(row[2] for row in model_data)
        total_cost = sum(row[3] for row in model_data)

        by_model = {row[0]: {"input_tokens": row[1], "output_tokens": row[2], "cost": row[3]}
                   for row in model_data}

        # 获取 Agent 成本分布
        cursor.execute('''
            SELECT agent_id, SUM(total_cost)
            FROM cost_entries
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY agent_id
        ''', (start_date.isoformat(), end_date.isoformat()))

        by_agent = {row[0]: row[1] for row in cursor.fetchall()}

        return CostReport(
            period_start=start_date,
            period_end=end_date,
            total_cost=total_cost,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            by_agent=by_agent,
            by_model=by_model,
            created_at=datetime.now()
        )

    async def create_budget(self, budget: BudgetConfig) -> BudgetConfig:
        """创建预算配置"""
        budget.id = str(uuid4())
        budget.created_at = datetime.now()
        budget.updated_at = budget.created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO budget_configs (id, name, amount, currency, period,
                                       alert_threshold, notifications, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            budget.id,
            budget.name,
            budget.amount,
            budget.currency,
            budget.period,
            budget.alert_threshold,
            str(budget.notifications),
            budget.created_at.isoformat(),
            budget.updated_at.isoformat()
        ))
        self.conn.commit()

        return budget

    async def check_budget_alerts(self) -> List[CostAlert]:
        """检查预算告警"""
        alerts = []

        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM budget_configs')
        budgets = cursor.fetchall()

        for budget_row in budgets:
            budget = BudgetConfig(
                id=budget_row[0],
                name=budget_row[1],
                amount=budget_row[2],
                currency=budget_row[3],
                period=budget_row[4],
                alert_threshold=budget_row[5],
                notifications=budget_row[6].split(',') if budget_row[6] else [],
                created_at=datetime.fromisoformat(budget_row[7]),
                updated_at=datetime.fromisoformat(budget_row[8])
            )

            # 计算当前周期内的成本
            period_start = self._get_period_start(budget.period)
            period_end = datetime.now()

            cursor.execute('''
                SELECT SUM(total_cost)
                FROM cost_entries
                WHERE timestamp BETWEEN ? AND ?
                AND currency = ?
            ''', (period_start.isoformat(), period_end.isoformat(), budget.currency))

            current_cost = cursor.fetchone()[0] or 0.0

            # 检查是否超过阈值
            threshold_amount = budget.amount * budget.alert_threshold

            if current_cost >= threshold_amount:
                alert = CostAlert(
                    id=str(uuid4()),
                    budget_id=budget.id,
                    message=f"预算 '{budget.name}' 已达到 {current_cost:.2f}{budget.currency}，阈值: {threshold_amount:.2f}{budget.currency}",
                    current_cost=current_cost,
                    threshold=threshold_amount,
                    timestamp=datetime.now(),
                    is_read=False,
                    metadata={"budget_name": budget.name}
                )
                alerts.append(alert)

                # 创建告警记录
                cursor.execute('''
                    INSERT INTO cost_alerts (id, budget_id, message, current_cost,
                                           threshold, timestamp, is_read, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    alert.id,
                    alert.budget_id,
                    alert.message,
                    alert.current_cost,
                    alert.threshold,
                    alert.timestamp.isoformat(),
                    alert.is_read,
                    str(alert.metadata)
                ))
                self.conn.commit()

        return alerts

    def _get_period_start(self, period: str) -> datetime:
        """获取周期开始时间"""
        now = datetime.now()
        if period == "daily":
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "weekly":
            # 返回本周一的日期
            days_since_monday = (now.weekday() + 6) % 7
            return (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "monthly":
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "yearly":
            return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return now - timedelta(days=30)  # 默认30天
# 紧急修复：后端启动失败 — ORM foreign_keys 配置错误

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题描述
上次修复（commit 8d80649）后，后端启动失败。

## 错误信息
```
sqlalchemy.exc.ArgumentError: Column expression expected for argument 'foreign_keys'; got 'TaskAssignment.task_id'.
```

触发位置：`main.py` lifespan → `scheduler.load_and_schedule_heartbeats()` → `heartbeat_service.get_active_heartbeats()` → SQLAlchemy mapper 配置

## 根因
文件：`backend/app/models/orm_models.py` 第 83-84 行

```python
assignments: Mapped[List["TaskAssignment"]] = relationship(
    "TaskAssignment", back_populates="task", foreign_keys=["TaskAssignment.task_id"],
```

问题：`foreign_keys` 参数传了 `["TaskAssignment.task_id"]`（字符串列表），SQLAlchemy 2.x 期望的是列对象或正确的字符串表达式。

## 修复方案
检查 `orm_models.py` 中**所有** relationship 的 `foreign_keys` 用法，确保：
1. 字符串格式用 `"TaskAssignment.task_id"`（不用列表）或直接引用列对象
2. Task 和 TaskAssignment 之间的双向 relationship 不冲突
3. TaskAssignment 的 task_id ForeignKey 和 Task 的 assignments relationship 指向一致

具体建议：
```python
# Task 模型中
assignments: Mapped[List["TaskAssignment"]] = relationship(
    "TaskAssignment", back_populates="task", foreign_keys="[TaskAssignment.task_id]"
)

# 或者用列对象引用
from .orm_models import TaskAssignment  # 如果可以导入
assignments: Mapped[List["TaskAssignment"]] = relationship(
    "TaskAssignment", back_populates="task", foreign_keys=[TaskAssignment.task_id]
)
```

注意：如果用字符串，确保格式是 `"[TaskAssignment.task_id]"`（列表的字符串形式），而不是 `["TaskAssignment.task_id"]`（字符串列表）。

## 验证
修改后必须**重启后端**验证（不能用 --reload 热更新，因为 ORM mapper 是启动时加载的）：

```bash
cd backend
python3 -c "from app.models.orm_models import *; print('ORM OK')"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8082 &
sleep 3
curl -s -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@2026"}' | head -c 200
```

如果登录返回 200 和 token，说明后端正常启动。

## 完成后
commit 推送通知我。推送后我会重启后端服务。

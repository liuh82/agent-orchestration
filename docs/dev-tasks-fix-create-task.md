# 紧急修复：创建任务后端 ORM 报错

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题
前端点击「创建任务」提交后，后端返回 500 错误：
```
Can't execute sync rule for source column 'tasks.id'; mapper 'Mapper[Task(tasks)]' does not map this column.
Try using an explicit `foreign_keys` collection which does not include destination column 'task_assignments.task_id' (or use a viewonly=True relation).
```

## 复现
```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"Admin@2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
curl -s -L -X POST "http://localhost:8082/api/tasks/" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"test task","description":"test"}'
```

## 分析
问题出在 `backend/app/models/orm_models.py` 的 `TaskAssignment` 模型：

`TaskAssignment.task_id` 有 `ForeignKey("tasks.id")`，而 `Task.assignments` relationship 和 `TaskAssignment.task` relationship 的 back_populates 设置可能导致 SQLAlchemy 的 sync rule 冲突。

`Task` 模型有多个指向 `agents` 表的外键（`assignee_id` 和 `agent_id`），已经在 relationship 上显式指定了 `foreign_keys`。但 `TaskAssignment` 的 relationship 可能也需要类似的处理。

## 修复方案
检查并修复 `orm_models.py` 中 `Task` 和 `TaskAssignment` 的 relationship 定义。可能的修复方向：

1. 在 `TaskAssignment.task` relationship 上添加 `foreign_keys=[task_id]`
2. 或者在 `Task.assignments` relationship 上检查是否需要 viewonly=True 或其他配置
3. 确认 Alembic 迁移中 `task_assignments` 表的 `task_id` 外键定义正确

## 验证
修复后，上面的 curl 命令应该返回成功创建的任务对象（HTTP 200/201，包含 `"code":0`）。

## 注意
- 只修改 ORM 模型的 relationship 定义
- 不要删除 task_assignments 表或修改其字段
- 不要改 API 路由或前端代码
- 修复后 commit 推送通知我

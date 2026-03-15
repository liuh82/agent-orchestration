# Phase 3 - 后端：任务树 + 人工干预 API

## 任务目标

实现任务三层级查询 API、人工干预决策 API、批量操作 API。

## 修改文件清单

```
backend/app/routers/tasks.py              # 扩展
backend/app/services/task_service.py       # 新建/扩展
backend/app/models/human_intervention.py   # ORM（Phase 0 已创建）
```

## API 端点

### 任务树查询

```
GET /api/v1/tasks/tree
```

**响应结构：**
```json
{
  "code": 0,
  "data": [
    {
      "project_id": "uuid",
      "project_name": "项目A",
      "project_status": "active",
      "task_stats": { "running": 2, "completed": 5, "failed": 1, "pending_human": 1 },
      "tasks": [
        {
          "id": "uuid",
          "title": "任务标题",
          "status": "running",
          "priority": "high",
          "agent": { "id": "uuid", "name": "agent-1", "status": "online", "model": "claude-sonnet" },
          "progress": 60,
          "started_at": "2026-03-15T10:00:00",
          "duration": 120,
          "agent_executions": [
            {
              "agent_id": "uuid",
              "agent_name": "agent-1",
              "status": "running",
              "logs": [
                { "timestamp": "...", "level": "info", "message": "..." }
              ],
              "output_files": [
                { "file_id": "uuid", "file_name": "result.py", "file_type": "output" }
              ]
            }
          ],
          "human_intervention": {
            "id": "uuid",
            "status": "pending",
            "context": { "reason": "需要确认方案", "code_snippet": "..." },
            "created_at": "2026-03-15T10:05:00"
          }
        }
      ]
    }
  ]
}
```

**查询逻辑：**
1. 查询用户有权限的项目列表
2. 对每个项目，查询其下所有任务（status + agent信息 + 进度）
3. 对每个任务，查询 agent_executions（日志+产出文件）
4. 对 status=pending_human 的任务，关联 human_interventions 数据
5. 按项目分组返回

**权限：** user 只返回自己项目的任务，admin 返回全部

### 人工干预

```
POST /api/v1/tasks/{task_id}/approve
  Body: { "comment": "审批意见（可选）" }
  逻辑：更新 human_intervention.status → approved，恢复任务状态为 running

POST /api/v1/tasks/{task_id}/reject
  Body: { "comment": "修改意见", "attachment_ids": ["uuid1", "uuid2"] }
  Content-Type: multipart/form-data（有附件时）
  逻辑：更新 human_intervention.status → rejected，记录 comment 和 attachments

GET /api/v1/tasks/pending-interventions
  响应：待处理的人工干预列表（status=pending）
```

### 批量操作

```
POST /api/v1/tasks/batch-action
  Body: { "task_ids": ["uuid1", "uuid2"], "action": "pause" | "cancel" }
  逻辑：
    - pause: 更新所有任务 status → paused
    - cancel: 更新所有任务 status → cancelled
  返回：{ "code": 0, "data": { "success_count": 2, "failed_count": 0, "failed_ids": [] } }
```

## 任务状态扩展

现有状态：pending / running / completed / failed / cancelled
**新增：** `pending_human` — 等待人工审批
**新增：** `paused` — 已暂停

## 约束

- Python 兼容 3.9
- 批量操作事务性：全部成功或全部失败（SQLite 单写锁，逐条更新但包裹在 try/except 中）
- 人工干预 context 字段存 JSON，包含 reason 和 code_snippet
- 任务树查询需要优化 N+1 问题（用 JOIN 或批量查询）

## 验收标准

- [ ] GET /api/v1/tasks/tree 返回正确的三层级数据
- [ ] user 只看到自己的项目，admin 看到全部
- [ ] 审批通过后任务恢复运行
- [ ] 驳回后记录意见和附件
- [ ] 待处理干预列表正确过滤
- [ ] 批量暂停/取消正确执行
- [ ] 部分失败时返回 failed_count 和 failed_ids

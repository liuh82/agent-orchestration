# 紧急修复：后端多处 500 错误

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题 1：创建任务 ORM 报错（已出过提示词 dev-tasks-fix-create-task.md）
POST /api/tasks/ 返回 500：
```
Can't execute sync rule for source column 'tasks.id'; mapper 'Mapper[Task(tasks)]' does not map this column.
```

## 问题 2：工作流模板接口被动态路由拦截
GET /api/workflows/templates 返回 500。

**根因**：FastAPI 路由声明顺序问题。`/{workflow_id}` 在 `/templates` 之前声明，导致 `/workflows/templates` 被匹配为 `/{workflow_id}`（workflow_id="templates"），然后 `get_workflow("templates")` 失败。

文件：`backend/app/routers/workflows.py`

**修复**：将 `/templates` 相关路由移到 `/{workflow_id}` 之前，即：
```python
# 先声明 /templates 路由
@router.get("/templates")
@router.get("/templates/{template_id}")
@router.post("/templates/")
@router.delete("/templates/{template_id}")

# 再声明动态路由
@router.get("/{workflow_id}")
@router.put("/{workflow_id}")
@router.delete("/{workflow_id}")
```

## 问题 3：async/await 不匹配
`workflows.py` 中多个路由用 `await` 调用非 async 的 service 方法：

```python
# workflow_service.get_all_workflows() 是 sync 方法，不需要 await
return await workflow_service.get_all_workflows()
# 应该改为
return workflow_service.get_all_workflows()
```

检查 `backend/app/services/workflow.py` 中所有方法是否为 async，如果不是就去掉路由中的 `await`。

同样检查 `get_workflow(workflow_id)` 的错误 — 返回 None 时不应该 await。

## 修复原则
1. 调整 workflows.py 中路由声明顺序，静态路径在动态路径之前
2. 去掉非 async 方法上的 await
3. 修复 orm_models.py 中 Task/TaskAssignment 的 relationship 配置（问题 1）
4. 不要改变 API 路径或前端代码
5. 修改完后本地验证：
   ```bash
   # 测试创建任务
   TOKEN=$(curl -s -X POST http://localhost:8082/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"Admin@2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
   curl -s -L -X POST "http://localhost:8082/api/tasks/" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"test task","description":"test"}'
   
   # 测试模板列表
   curl -s -L "http://localhost:8082/api/workflows/templates" -H "Authorization: Bearer $TOKEN"
   
   # 测试工作流列表
   curl -s -L "http://localhost:8082/api/workflows/" -H "Authorization: Bearer $TOKEN"
   ```

## 完成后
commit 推送通知我。

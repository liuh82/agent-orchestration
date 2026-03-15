# CC 补漏修复提示词 — agent-orchestration 第二轮

项目路径: /Users/lh8/projects/agent-orchestration/

上一轮修复后验证发现以下问题仍未解决，请逐个修复。

---

## 修复 1：workflows.py — workflow_service 未定义

文件: `backend/app/routers/workflows.py`

当前问题：第23行及多处使用了 `workflow_service`，但文件中没有定义也没有 import。运行时 NameError。

当前代码（第1-24行）：
```python
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.workflow import WorkflowDefinition, WorkflowTemplate
from ..services.workflow import WorkflowService
from ..services.workflow_engine_registry import workflow_engine_registry

router = APIRouter()

class WorkflowResponse(BaseModel):
    success: bool
    data: Optional[WorkflowDefinition] = None
    message: str = ""

@router.get("/", response_model=List[WorkflowDefinition])
async def get_workflows():
    """获取所有工作流"""
    return await workflow_service.get_all_workflows()  # ← 这里 workflow_service 未定义
```

修复方案（二选一）：
- **方案A（推荐）**：模块级创建实例
```python
from ..database import SessionLocal

workflow_service = WorkflowService(SessionLocal())
```
加在 `router = APIRouter()` 之后

- **方案B**：每个路由用依赖注入
```python
from fastapi import Depends
from ..database import get_db

def get_workflow_service(db = Depends(get_db)):
    return WorkflowService(db)
```
然后每个路由加 `service: WorkflowService = Depends(get_workflow_service)` 参数

---

## 修复 2：tasks.py — execute/pause/resume/cancel 空实现

文件: `backend/app/routers/tasks.py`

当前问题：第78-103行，四个操作只返回固定 JSON，没有调用任何 service 方法。

当前代码：
```python
@router.post("/{task_id}/execute")
async def execute_task(task_id: str, db = Depends(get_db)):
    # TODO: 实现任务执行逻辑
    return {"success": True, "message": "Task execution started"}

@router.post("/{task_id}/pause")
async def pause_task(task_id: str, db = Depends(get_db)):
    # TODO: 实现任务暂停逻辑
    return {"success": True, "message": "Task paused"}

@router.post("/{task_id}/resume")
async def resume_task(task_id: str, db = Depends(get_db)):
    # TODO: 实现任务恢复逻辑
    return {"success": True, "message": "Task resumed"}

@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str, db = Depends(get_db)):
    # TODO: 实现任务取消逻辑
    return {"success": True, "message": "Task cancelled"}
```

修复方案：
1. 先检查 `backend/app/services/task.py` 是否已有 `execute_task`、`pause_task`、`resume_task`、`cancel_task` 方法
2. 如果有，在路由中调用对应的 service 方法
3. 如果没有，先在 service 层添加这些方法（参考 `tasks_legacy.py` 中的实现），然后在路由中调用
4. 添加状态校验：不能执行 pending 状态的任务，不能恢复非 paused 状态的任务等

示例：
```python
@router.post("/{task_id}/execute")
async def execute_task(task_id: str, db = Depends(get_db)):
    service = TaskService(db)
    task = await service.execute_task(task_id)
    if not task:
        raise HTTPException(status_code=400, detail="无法执行任务，请检查任务状态")
    return {"success": True, "task_id": task_id, "status": task.status}
```

---

## 修复 3：heartbeat.py — update_log 变量名冲突

文件: `backend/app/services/heartbeat.py`

当前问题：项目中有多个方法使用 `result = self.db.execute(...)` 模式。需要找到名为 `update_log` 的方法，检查是否存在参数 `result` 与局部变量 `result` 冲突。

修复步骤：
1. 在文件中搜索 `def update_log` 方法
2. 如果该方法有参数叫 `result`，将其重命名为 `log_result`
3. 将方法内 `self.db.execute(...)` 的返回值赋给 `db_result` 而不是 `result`
4. 检查整个文件中所有 `result = self.db.execute(...)` 的地方，确保不与参数名冲突

如果 `update_log` 方法不存在（可能改名或合并到其他方法），请检查所有接收 `result: Optional[dict]` 类型参数的方法。

---

## 修复 4：frontend/src/api/client.ts — 启用认证 + 调整 timeout

文件: `frontend/src/api/client.ts`

当前问题：
1. 认证代码被注释（第13-17行）
2. timeout 为 10000ms 太短
3. 缺少 401 响应处理

当前代码：
```typescript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
```

修复为：
```typescript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    } else {
      const storedKey = localStorage.getItem('api_key');
      if (storedKey) {
        config.headers['X-API-Key'] = storedKey;
      }
    }
    return config;
  },
```

同时在响应拦截器中添加 401 处理：
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('api_key');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);
```

---

## 修复 5：remote-agent-bridge/src/config/defaults.ts — Token + 认证 + 沙箱

文件: `remote-agent-bridge/src/config/defaults.ts`

### 5a. Gateway Token 默认为空（第17行）
当前：
```typescript
gateway: {
    url: 'wss://81.70.98.45:18789',
    token: '',
```

修复为：
```typescript
gateway: {
    url: process.env.OC_GATEWAY_URL || '',
    token: process.env.OC_GATEWAY_TOKEN || '',
```

### 5b. HTTP 认证默认禁用（约第53行）
当前：
```typescript
auth: {
      enabled: false,
      apiKey: '',
},
```

修复为：
```typescript
auth: {
      enabled: process.env.NODE_ENV === 'production',
      apiKey: process.env.OC_HTTP_API_KEY || '',
},
```

### 5c. 沙箱命令白名单宽松（约第78行）
当前：
```typescript
allowedCommands: ['codex', 'pi', 'openclaw', 'npx', 'npm', 'python', 'python3'],
```

修复为：
```typescript
allowedCommands: ['codex', 'pi', 'openclaw'],
```

### 5d. 在文件末尾 export 之前添加配置验证函数
```typescript
export function validateConfig(config: BridgeConfig): void {
  if (!config.gateway.token && config.gateway.url) {
    throw new Error('OC_GATEWAY_TOKEN must be set when gateway URL is configured');
  }
}
```

---

## 修复 6：agents.py — 分页参数加上限

文件: `backend/app/routers/agents.py`

搜索 `page_size` 参数定义，加上限：
```python
page_size: int = Query(default=50, le=100),
```

确保已 import Query: `from fastapi import APIRouter, HTTPException, Depends, Query`

---

## 完成后

1. 后端语法检查：`find backend/app -name "*.py" -exec python3 -m py_compile {} \;`
2. 前端类型检查：`cd frontend && npx tsc --noEmit`
3. 确认无报错后推送 git

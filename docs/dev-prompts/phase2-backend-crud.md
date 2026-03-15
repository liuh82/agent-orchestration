# Phase 2 - 后端：核心 CRUD API

## 任务目标

实现项目管理（含文档库/Agent配置/任务文件）、Agent CRUD（含类型管理/配置Schema）、Bridge 用户隔离 CRUD、文件上传下载 API。

## 修改/新建文件清单

```
backend/app/models/project_document.py       # ORM（Phase 0 已创建，完善）
backend/app/models/agent_config_file.py       # ORM
backend/app/models/task_file.py               # ORM
backend/app/routers/projects.py              # 扩展：文档/配置/文件子路由
backend/app/routers/agents.py                # 扩展：bridge_id、配置Schema
backend/app/routers/bridges.py               # 新建：Bridge CRUD
backend/app/routers/files.py                 # 新建：文件上传下载
backend/app/routers/agent_types.py           # 新建：Agent类型管理
backend/app/services/file_service.py         # 新建：文件存储服务
backend/app/main.py                          # 注册新路由
backend/requirements.txt                     # python-multipart（文件上传）
```

## 项目文档 API

```
GET    /api/v1/projects/{project_id}/documents?doc_type=
POST   /api/v1/projects/{project_id}/documents       # 文本或 multipart 文件
GET    /api/v1/projects/{project_id}/documents/{doc_id}
PUT    /api/v1/projects/{project_id}/documents/{doc_id}
DELETE /api/v1/projects/{project_id}/documents/{doc_id}
```

**doc_type 枚举：** `overview` | `architecture` | `spec` | `dependency` | `custom`

**POST 支持两种模式：**
- Content-Type: application/json → `{ "doc_type": "overview", "title": "...", "content": "markdown..." }`
- Content-Type: multipart/form-data → `{ "doc_type", "title", "file" }`，自动检测 MIME 类型存 file_path

## Agent 配置文件 API

```
GET    /api/v1/projects/{project_id}/agent-configs?agent_type_id=&config_type=
POST   /api/v1/projects/{project_id}/agent-configs
GET    /api/v1/projects/{project_id}/agent-configs/{config_id}
PUT    /api/v1/projects/{project_id}/agent-configs/{config_id}
DELETE /api/v1/projects/{project_id}/agent-configs/{config_id}
```

**config_type 枚举：** `CLAUDE.md` | `SOUL.md` | `AGENTS.md` | `opencode.json` | `custom`

## 任务文件 API

```
GET    /api/v1/tasks/{task_id}/files?file_type=
POST   /api/v1/tasks/{task_id}/files              # multipart
GET    /api/v1/tasks/{task_id}/files/{file_id}/download
DELETE /api/v1/tasks/{task_id}/files/{file_id}
```

**file_type 枚举：** `prompt` | `input` | `reference` | `constraint` | `output`

## 文件上传下载服务

```python
# backend/app/services/file_service.py

UPLOAD_DIR = "uploads"  # 相对于 backend 目录

class FileService:
    ALLOWED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx", ".json", ".yaml", ".yml",
                          ".py", ".js", ".ts", ".png", ".jpg", ".jpeg", ".gif"}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    def save_file(self, file: UploadFile) -> dict:
        """保存文件，返回 { file_id, file_path, file_size, mime_type }"""
        # 路径: uploads/{year}/{month}/{day}/{uuid}{ext}

    def get_file_path(self, file_id: str) -> Optional[str]:
        """根据 file_id 获取文件路径"""

    def delete_file(self, file_path: str) -> bool:
        """删除物理文件"""
```

## Agent CRUD 更新

现有 `POST /api/v1/agents` 请求体增加 `bridge_id`：
```json
{
  "name": "my-agent",
  "agent_type_id": "type-cc",
  "bridge_id": "bridge-xxx",    // 新增，替代 bridge_url
  "model": "claude-sonnet-4-20250514",
  "timeout": 300,
  "max_retries": 3,
  "config": { ... }
}
```

**逻辑变更：**
- 创建时 `bridge_id` 关联 gateway_bridges 表
- 详情返回中包含绑定 Bridge 的名称、状态、最后活跃时间

## Agent 类型管理 API

```
GET    /api/v1/agent-types
POST   /api/v1/agent-types         # admin only
PUT    /api/v1/agent-types/{id}    # admin only
DELETE /api/v1/agent-types/{id}    # admin only
GET    /api/v1/agent-types/{id}/schema  # 返回 JSON Schema
```

**AgentType 数据结构：**
```json
{
  "id": "type-cc",
  "name": "claude-code",
  "display_name": "Claude Code",
  "protocol": "stdio",
  "capabilities": ["code_generation", "file_edit", "terminal"],
  "preset_models": ["claude-sonnet-4-20250514", "claude-opus-4-20250115"],
  "config_schema": {
    "type": "object",
    "properties": {
      "model": { "type": "string", "title": "模型" },
      "timeout": { "type": "integer", "title": "超时(秒)", "default": 300 }
    },
    "required": ["model"]
  },
  "created_at": "...",
  "updated_at": "..."
}
```

## Bridge 用户隔离 CRUD

```
GET    /api/v1/bridges              # 只返回当前用户的Bridge
POST   /api/v1/bridges              # 创建Bridge + 生成API Key
PUT    /api/v1/bridges/{bridge_id}  # 只能操作自己的
DELETE /api/v1/bridges/{bridge_id}  # 只能操作自己的
GET    /api/v1/bridges/{bridge_id}/tasks  # 该Bridge上的任务
```

**POST 创建逻辑：**
1. 生成 UUID 作为 bridge_id
2. 生成 API Key（随机字符串）
3. 创建 gateway_bridges 记录，user_id = current_user.id
4. 返回配置指引：
```json
{
  "code": 0,
  "data": {
    "bridge_id": "xxx",
    "api_key": "xxx",
    "ws_url": "ws://81.70.98.45:8082/ws/gateway",
    "setup_command": "npm install -g @liuh82/oc-bridge && oc-bridge setup --url ws://81.70.98.45:8082/ws/gateway --token xxx",
    "install_guide": "1. npm install -g @liuh82/oc-bridge\n2. oc-bridge setup --url <ws_url> --token <api_key>\n3. oc-bridge start"
  }
}
```

**管理员路由：**
```
GET    /api/v1/admin/bridges              # 全部Bridge
GET    /api/v1/admin/gateway/status       # Gateway服务状态
DELETE /api/v1/admin/bridges/{bridge_id}  # 删除任意Bridge
```

## 路由注册

```python
# backend/main.py 新增
from app.routers import bridges, files, agent_types
app.include_router(bridges.router, prefix="/api/v1/bridges", tags=["bridges"])
app.include_router(bridges.router, prefix="/api/bridges", tags=["bridges-compat"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(agent_types.router, prefix="/api/v1/agent-types", tags=["agent-types"])
```

## 约束

- Python 兼容 3.9：`Optional[str]`
- 所有查询加用户隔离（`WHERE user_id = :current_user_id`），admin 绕过
- 文件上传校验：扩展名白名单 + 大小限制 10MB + 文件名消毒
- API 响应格式：`{ "code": 0, "data": ..., "message": "..." }`
- Bridge 的 ws_url 和 setup_command 从配置文件读取，不硬编码

## 验收标准

- [ ] 项目文档 CRUD 正常（文本和文件两种模式）
- [ ] Agent 配置文件 CRUD 正常
- [ ] 任务文件上传/下载/删除正常
- [ ] Agent 创建时可选 Bridge，bridge_id 正确写入
- [ ] Agent 类型管理 CRUD 正常（admin才能操作）
- [ ] Agent 类型 config_schema 正确返回
- [ ] Bridge CRUD 用户隔离正确
- [ ] 创建 Bridge 返回完整配置指引
- [ ] 管理员可查看全部 Bridge 和 Gateway 状态

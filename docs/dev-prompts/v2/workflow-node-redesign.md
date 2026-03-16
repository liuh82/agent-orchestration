# Nexus 工作流编辑器 — 完整改造方案

> 基于 2026-03-16 讨论整理
> 状态：待确认

---

## 一、产品愿景

Nexus 是一个 **AI Agent 统一调度平台**，支持多种入口触发工作流：

**多入口模式：**
- **Nexus 前端**：用户直接创建项目 → 描述需求 → 工作流自动触发 → Agent 完成需求分析/方案设计/开发实现
- **OpenClaw 对话**：用户与 OpenClaw 沟通 → 确定需求 → OpenClaw 在 Nexus 创建项目+任务 → 工作流触发 → Agent 执行
- **Webhook/API**：外部系统触发 → 创建任务 → 工作流执行
- **定时触发**：Cron 调度 → 自动执行巡检/报告等任务

**核心能力：**
1. Agent 调度（Claude Code、Codex、OpenCode 等，本地+远程）
2. 工作流编排（可视化编辑器，支持复杂分支/合并）
3. 项目/任务全生命周期管理
4. Git 集成（自动建分支、commit、push、PR）
5. OpenClaw 可选集成（独立/只读/汇总/审批/托管 五级权限）
6. 多端部署（Web → Mac 桌面版）

### 使用场景

| 场景 | 说明 |
|------|------|
| 软件开发 | 需求→架构→前后端并行开发→Review→测试→部署 |
| 数据收集 | Webhook→HTTP请求→数据清洗→存储 |
| 内容创作 | 调研→大纲→写作→审校→发布 |
| 自动化运维 | 定时触发→巡检→报告→告警 |

### 分阶段落地

**第一阶段（核心）**：
- 项目管理 + 任务追踪
- 工作流编辑器（节点配置贴合 Nexus 业务）
- 本地单/多 Agent 工作流（异构：CC + Codex 等）
- Agent 实时日志流（WebSocket，替代终端查看）
- 文件输入/输出
- 基础 Git 集成（项目级配置 + 自动建分支）
- Fork/Join 并行分支
- 连线箭头 + 标签 + 样式区分
- OpenClaw 集成权限配置（项目级五级权限）

**第二阶段（管理）**：
- 多项目管理（本地 + 远程）
- OpenClaw 代理审批（工作流 → OpenClaw → 回调）
- 进度汇总报告
- 项目 Git 配置 UI

**第三阶段（增强）**：
- 远程 Agent 管理增强
- 通知 + 审批链路完善
- 子工作流复用模板
- 工作流执行监控大屏

**第四阶段（桌面版）**：
- **Mac 桌面应用**（基于 Electron 或 Tauri）
- 原生 macOS 风格 UI（毛玻璃、暗色模式、动画过渡）
- 本地 Agent 进程管理（前台终端可见 / 后台运行可切换）
- 系统托盘 + 通知中心集成
- 本地文件系统直接访问
- 离线能力（本地缓存 + 断线重连）

---

## 二、节点类型完整清单

### 2.1 触发器节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| manual_trigger | 手动触发 | ✅ | ✅ | 否 |
| cron_trigger | 定时触发 | ✅ | ✅ | 否 |
| webhook_trigger | Webhook 触发 | ✅ | ❌ | 新增前端 |

### 2.2 数据流节点（新增/改造）

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| **input** | 输入节点（项目/任务/文件上下文） | ❌ 新增 | ❌ 新增 | **全新** |
| **context_output** | 上下文输出（传给下游 Agent） | ❌ 新增 | ❌ 新增 | **全新** |
| **result_output** | 结果输出（写回任务/文件/通知） | ❌ 新增 | ❌ 新增 | **全新** |

### 2.3 Agent 节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| agent | Agent 执行 | ✅ | ✅ | **配置面板改造** |

### 2.4 逻辑控制节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| if | 条件分支 | ✅ | ✅ | 配置优化 |
| switch | 多路分支 | ✅ | ✅ | 配置优化 |
| loop | 循环 | ✅ | ✅ | 配置优化 |
| wait | 等待 | ✅ | ✅ | 配置优化 |
| **fork** | 分发网关（并行分发） | ❌ 新增 | ❌ 新增 | **全新** |
| **join** | 汇合网关（等待合并） | ❌ 新增 | ❌ 新增 | **全新** |

### 2.5 数据节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| http_request | HTTP 请求 | ✅ | ✅ | 配置优化 |
| code | 代码执行 | ✅ | ✅ | 配置优化 |
| transform | 数据转换 | ✅ | ❌ | 新增前端 |

### 2.6 工作流节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| sub_workflow | 子工作流 | ✅ | ✅ | **配置面板改造** |

### 2.7 输出节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| output | 输出结果 | ✅ | ✅ | 拆分为两种（见 2.2） |
| notification | 通知发送 | ✅ | ❌ | 新增前端 |

### 2.8 其他节点

| 节点 | 说明 | 后端实现 | 前端实现 | 需改造 |
|------|------|---------|---------|--------|
| human | 人工审批 | ✅ | ❌ | 新增前端 |
| timer | 定时器 | ✅ | ❌ | 新增前端 |
| parallel | 并行（已有） | ✅ | ❌ | 被 fork/join 替代 |
| condition | 条件（通用） | ✅ | ❌ | 与 if/switch 合并 |

---

## 三、各节点详细配置

### 3.1 input（输入节点）— 新增

**用途**：从项目/任务中提取上下文作为工作流起点

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "输入" },
    "source": {
      "type": "string", "title": "数据来源",
      "enum": ["project", "task", "manual", "upstream"],
      "default": "project"
    },
    "fields": {
      "type": "array", "title": "提取字段",
      "description": "选择要提取的字段",
      "items": { "type": "string" },
      "default": ["title", "description"]
    },
    "includeFiles": {
      "type": "boolean", "title": "包含附件文件",
      "default": true
    },
    "template": {
      "type": "string", "title": "组装模板（可选）",
      "description": "用 {{ field }} 引用字段，组装为 Agent 可读的文本"
    },
    "outputAlias": {
      "type": "string", "title": "输出变量名",
      "default": "input"
    }
  },
  "required": ["source"]
}
```

**可提取字段**：

项目级（source=project）：
- `project.name` — 项目名称
- `project.description` — 项目描述
- `project.documents[]` — 项目文档库（prompt/reference/constraint 等）

任务级（source=task）：
- `task.title` — 任务标题
- `task.description` — 任务描述
- `task.requirements` — 需求详情
- `task.input_files[]` — 任务附件（文件内容/路径）
- `task.action_params` — 执行参数

**执行逻辑**：
1. 从 DB 查询对应项目/任务
2. 按 fields 提取数据，includeFiles 时加载文件内容（文本文件读内容，二进制文件给路径）
3. 有 template 时用模板组装，否则直接输出结构化 JSON
4. 输出变量名为 outputAlias（默认 `input`）

**前端配置面板**：
- 数据来源：Radio（项目/任务/手动/上游）
- 提取字段：Checkbox 多选，按来源动态显示可选项
- 包含文件：Switch 开关
- 组装模板：TextArea，支持 `{{ }}` 语法提示

---

### 3.2 agent（Agent 节点）— 改造

**改造要点**：去掉 LLM API 参数，贴合 Nexus Agent 体系

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "Agent" },
    "agentSelectMode": {
      "type": "string", "title": "选择方式",
      "enum": ["existing", "type"],
      "default": "existing"
    },
    "agentId": {
      "type": "string", "title": "选择已有 Agent",
      "description": "从已注册的 Agent 列表中选择"
    },
    "agentType": {
      "type": "string", "title": "Agent 类型",
      "enum": ["cc", "codex", "opencode", "openclaw", "custom"],
      "description": "未选已有 Agent 时使用"
    },
    "prompt": {
      "type": "string", "title": "执行指令",
      "description": "支持 {{ variable }} 语法引用上游输出"
    },
    "model": {
      "type": "string", "title": "模型",
      "description": "留空则使用 Agent 默认模型"
    },
    "timeout": {
      "type": "integer", "title": "超时时间(秒)",
      "default": 300, "minimum": 30, "maximum": 3600
    },
    "workDir": {
      "type": "string", "title": "工作目录（可选）",
      "description": "Agent 执行的本地/远程工作目录"
    },
    "envVars": {
      "type": "object", "title": "环境变量（可选）",
      "description": "key: value 形式的额外环境变量"
    },
    "outputFormat": {
      "type": "string", "title": "输出格式",
      "enum": ["full", "content_only", "files_only", "summary"],
      "default": "full"
    },
    "outputAlias": {
      "type": "string", "title": "输出变量名",
      "default": "agent_output"
    },
    "gitEnabled": {
      "type": "boolean", "title": "启用 Git 操作",
      "description": "执行完后自动 commit + push",
      "default": false
    }
  },
  "required": ["prompt"]
}
```

**前端配置面板**：
```
┌─ Agent 选择 ───────────────────────────┐
│  ○ 选择已有 Agent：[下拉列表，显示名称+类型+状态] │
│  ○ 选择 Agent 类型：[cc/codex/opencode/…]    │
└─────────────────────────────────────────┘
┌─ 执行指令 ──────────────────────────────┐
│  [TextArea — prompt 模板，支持 {{ }} 提示]  │
└─────────────────────────────────────────┘
┌─ 执行配置 ──────────────────────────────┐
│  模型：[留空用默认]    超时：[300s]       │
│  工作目录：[可选]                         │
│  环境变量：[可选，key=value]              │
│  ☐ 启用 Git（执行完自动 commit/push）     │
└─────────────────────────────────────────┘
┌─ 输出配置 ──────────────────────────────┐
│  输出格式：○ 全部 ○ 仅内容 ○ 仅文件 ○ 摘要│
│  输出变量名：[agent_output]              │
└─────────────────────────────────────────┘
```

**后端执行逻辑改造**：
1. 选择已有 Agent：查 Bridge 状态，通过 Gateway 派发
2. 选择类型：创建临时 Bridge 连接（或从同类型空闲 Agent 中选一个）
3. prompt 模板渲染：用 variable_resolver 解析 `{{ input.xxx }}`
4. 输出收集：根据 outputFormat 提取对应数据
5. Git 操作：如果 gitEnabled 且项目有 Git 配置，执行后自动 git add/commit/push

**输出数据结构**：
```json
{
  "agent_id": "xxx",
  "agent_type": "cc",
  "content": "Agent 返回的主要文本内容",
  "files_changed": ["path/to/file1.ts", "path/to/file2.ts"],
  "exit_code": 0,
  "duration_ms": 15000,
  "model": "claude-sonnet",
  "git_commit": "abc123",
  "git_branch": "wf/task-001/cc-1",
  "git_pr_url": "https://github.com/xxx/pull/42"
}
```

---

### 3.3 context_output（上下文输出）— 新增

**用途**：将 Agent 处理结果封装为结构化上下文，传给下游 Agent

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "上下文输出" },
    "extractFields": {
      "type": "array", "title": "提取字段",
      "description": "从上游输出中提取哪些字段",
      "items": { "type": "string" },
      "default": ["content", "files_changed"]
    },
    "instructions": {
      "type": "string", "title": "补充指令",
      "description": "给下游 Agent 的额外说明，如'基于以上代码审查结果修复问题'"
    },
    "outputAlias": {
      "type": "string", "title": "输出变量名",
      "default": "context"
    }
  }
}
```

**输出数据**：
```json
{
  "content": "...",
  "files_changed": [...],
  "instructions": "基于以上架构设计完成前端开发",
  "source_node": "node_1",
  "context_type": "architecture_design"
}
```

---

### 3.4 result_output（结果输出）— 新增

**用途**：工作流最终结果，写回任务/项目/文件

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "结果输出" },
    "target": {
      "type": "string", "title": "写回目标",
      "enum": ["task_result", "task_documents", "project_documents", "file", "none"],
      "default": "task_result"
    },
    "format": {
      "type": "string", "title": "输出格式",
      "enum": ["json", "text", "markdown"],
      "default": "markdown"
    },
    "filePath": {
      "type": "string", "title": "文件路径（target=file 时）"
    },
    "docType": {
      "type": "string", "title": "文档类型（target=task/project_documents 时）",
      "enum": ["output", "report", "log", "custom"],
      "default": "output"
    },
    "notify": {
      "type": "boolean", "title": "发送通知",
      "default": false
    },
    "notifyChannel": {
      "type": "string", "title": "通知渠道（notify=true 时）",
      "description": "留空使用项目默认通知渠道"
    }
  }
}
```

---

### 3.5 fork（分发网关）— 新增

**用途**：将上游数据分发到多个并行分支

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "Fork" },
    "mode": {
      "type": "string", "title": "分发模式",
      "enum": ["broadcast", "distribute"],
      "default": "broadcast",
      "description": "broadcast: 所有分支收到相同数据; distribute: 每个分支收到不同数据"
    },
    "branchCount": {
      "type": "integer", "title": "分支数量",
      "default": 2, "minimum": 2, "maximum": 10
    },
    "branchData": {
      "type": "array", "title": "分支数据（distribute 模式）",
      "description": "每个分支各自的附加数据",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string", "title": "分支标签" },
          "data": { "type": "string", "title": "附加数据（支持 {{ }} ）" }
        }
      }
    }
  },
  "required": ["branchCount"]
}
```

**前端**：
- 输出端口数量 = branchCount，动态可调
- 每个输出端口可标注标签（如"前端"、"后端"）
- 可视化显示分支数量

**后端**：
- broadcast：所有下游节点收到相同的 upstream_outputs
- distribute：第 N 个分支额外注入 branchData[N] 的数据

---

### 3.6 join（汇合网关）— 新增

**用途**：等待所有并行分支完成后合并结果

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "Join" },
    "mode": {
      "type": "string", "title": "等待模式",
      "enum": ["all", "any", "n_of_m"],
      "default": "all"
    },
    "requiredCount": {
      "type": "integer", "title": "完成数量（n_of_m 模式）",
      "default": 2
    },
    "mergeStrategy": {
      "type": "string", "title": "合并策略",
      "enum": ["append", "merge", "custom"],
      "default": "append"
    },
    "extractFields": {
      "type": "array", "title": "自定义提取字段（merge=custom 时）",
      "items": { "type": "string" }
    },
    "timeout": {
      "type": "integer", "title": "超时时间(秒)",
      "default": 3600
    },
    "onTimeout": {
      "type": "string", "title": "超时策略",
      "enum": ["fail", "continue_with_ready", "skip"],
      "default": "continue_with_ready"
    }
  },
  "required": ["mode"]
}
```

**前端**：
- 输入端口自动识别所有连入的边（不需要手动配置）
- 显示当前等待状态（已完成的分支数/总分支数）

**后端**：
- 引擎层面，Join 节点在所有上游完成后才执行
- 合并时按分支顺序编号：`branch_0`, `branch_1`, ...
- 输出：`{ branch_0: {...}, branch_1: {...}, merged: [...] }`

---

### 3.7 sub_workflow（子工作流）— 改造

**CONFIG_SCHEMA**：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "子工作流" },
    "workflowId": { "type": "string", "title": "选择工作流" },
    "variables": {
      "type": "object", "title": "工作流变量",
      "description": "传递给子工作流的变量，支持 {{ }} 引用"
    },
    "passUpstream": {
      "type": "boolean", "title": "传递上游上下文",
      "default": true
    },
    "sync": {
      "type": "boolean", "title": "等待完成",
      "default": true
    },
    "onFailure": {
      "type": "string", "title": "失败策略",
      "enum": ["abort", "skip", "retry"],
      "default": "abort"
    },
    "retryCount": {
      "type": "integer", "title": "重试次数",
      "default": 1
    }
  },
  "required": ["workflowId"]
}
```

---

### 3.8 其他节点配置优化

#### http_request — 补充配置
```json
{
  "headers": { "type": "object", "title": "请求头" },
  "responseFormat": { "type": "string", "enum": ["json", "raw", "text"], "default": "json" }
}
```

#### code — 补充配置
```json
{
  "workDir": { "type": "string", "title": "工作目录" },
  "injectEnv": { "type": "boolean", "title": "注入上游上下文为环境变量", "default": false }
}
```

#### if / switch — 条件表达式增强
支持引用上游输出：
```
{{ node_1.output.status }} == "success"
{{ node_2.output.score }} > 0.8
{{ node_3.output.files }} contains "README.md"
```

#### loop — 列表来源增强
```
{{ input.task_ids }}          — 引用上游输出的数组
["item1", "item2", "item3"]   — 手动 JSON 数组
```

#### wait — 支持人工审批模式
```json
{
  "waitType": { "type": "string", "enum": ["delay", "approval"], "default": "delay" },
  "notifyChannel": { "type": "string", "title": "审批通知渠道" }
}
```

---

## 四、连线样式

### 4.1 方向箭头
- 类型：`smoothstep`（当前已有）
- 箭头：加大尺寸，颜色跟随源节点颜色
- 动画：数据流经时流动动画（执行状态）

### 4.2 边标签
- 点击边可编辑标签
- 常用预设标签：`context`、`files`、`result`、`approval`
- 标签显示在边的中点

### 4.3 边样式区分
| 数据类型 | 样式 | 颜色 |
|---------|------|------|
| 上下文 | 实线 | #6366f1 (brand) |
| 文件 | 双线（粗线） | #22c55e (success) |
| 结果 | 实线 | #475569 (gray) |
| 审批 | 虚线 | #d97706 (warning) |
| 分支 | 点线 | #94a3b8 (muted) |

---

## 五、Git 集成

### 5.1 项目级配置

```
┌─ 项目 Git 配置 ──────────────────────────┐
│ 启用 Git：☑                                │
│ 平台：GitHub / Gitee / 自建               │
│ 仓库地址：git@github.com:xxx/yyy.git       │
│ 默认分支：develop                          │
│ 认证方式：SSH Key / Token                  │
└───────────────────────────────────────────┘
┌─ 分支策略 ────────────────────────────────┐
│ ○ 自动建分支（推荐，支持并发）              │
│   分支名模板：wf/{task_id}/{agent_id}     │
│ ○ 直接推送固定分支（单 Agent 场景）        │
└───────────────────────────────────────────┘
┌─ 推送后操作 ──────────────────────────────┐
│ □ 自动创建 PR / MR                       │
│ □ 执行完自动 merge                       │
│ ◉ 仅推送（手动处理）                      │
└───────────────────────────────────────────┘
```

### 5.2 数据库变更

```sql
-- 项目表新增字段
ALTER TABLE projects ADD COLUMN git_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN git_platform VARCHAR(20);  -- github/gitee/custom
ALTER TABLE projects ADD COLUMN git_repo_url VARCHAR(500);
ALTER TABLE projects ADD COLUMN git_default_branch VARCHAR(100) DEFAULT 'develop';
ALTER TABLE projects ADD COLUMN git_auth_type VARCHAR(20);  -- ssh_key/token/password
ALTER TABLE projects ADD COLUMN git_auth_value TEXT;        -- 加密存储
ALTER TABLE projects ADD COLUMN git_branch_strategy VARCHAR(20) DEFAULT 'auto_branch';  -- auto_branch/direct
ALTER TABLE projects ADD COLUMN git_branch_template VARCHAR(200) DEFAULT 'wf/{task_id}/{agent_id}';
ALTER TABLE projects ADD COLUMN git_post_push VARCHAR(20) DEFAULT 'push_only';  -- push_only/create_pr/auto_merge
```

### 5.3 Agent 节点 Git 执行流程

1. **前置**：Agent 端 `git checkout {auto_branch_name}`（从默认分支创建新分支）
2. **执行**：Agent 在工作目录完成任务
3. **后置**：`git add -A && git commit -m "feat: {task_title}" && git push origin {branch}`
4. **可选**：通过 GitHub/Gitee API 创建 PR
5. **结果收集**：commit hash、branch name、PR URL 写入节点输出

---

## 六、OpenClaw 代理审批（第二阶段）

### 6.1 审批流程

```
工作流执行 → human/wait 节点 → 暂停
    ↓
Nexus HTTP 回调 → OpenClaw session
    ↓
OpenClaw 分析上下文（Agent 做了什么、代码变更、审批请求）
    ↓
OpenClaw 决策（approve/reject + 理由）
    ↓
OpenClaw HTTP 回调 → Nexus
    ↓
工作流继续（记录审批决策）
```

### 6.2 OpenClaw 作为审批角色

- OpenClaw 在 Nexus 中注册为特殊 `approver` 类型
- 审批策略：`human`（等你）、`openclaw`（AI 代理）、`both`（AI 先审批，关键操作再转你）
- 审批报告：每次审批汇总成报告，定时或按需发给你

---

## 七、执行上下文数据流

### 7.1 完整工作流示例：软件开发

```
[manual_trigger]
    ↓ context: { project_id, task_id, trigger_type, user_id }

[input — source=project+task]
    → 查 DB → output: { title, description, files, requirements }
    ↓

[agent — 架构设计 Agent(CC)]
    → prompt: "完成以下需求的架构设计：{{ input.description }}"
    → output: { content: "架构方案...", files_changed: ["arch.md", "plan.md"] }
    ↓

[context_output]
    → extractFields: [content, files_changed]
    → instructions: "按以上架构方案实现"
    ↓

[fork — branchCount=2, mode=broadcast]
    ├→ 分支1: { 上游数据 + branch_label: "前端" }
    └→ 分支2: { 上游数据 + branch_label: "后端" }

    ├→ [agent — 前端开发 Agent(CC)]
    │     → prompt: "完成前端开发：{{ context.instructions }}"
    │     → gitEnabled: true → auto branch → commit/push
    │     → output: { files_changed: [...], git_pr_url: "..." }
    │
    └→ [agent — 后端开发 Agent(Codex)]
          → prompt: "完成后端开发：{{ context.instructions }}"
          → gitEnabled: true → auto branch → commit/push
          → output: { files_changed: [...], git_pr_url: "..." }

[join — mode=all, merge=append]
    → output: { branch_0: {...}, branch_1: {...}, merged: [...] }
    ↓

[agent — Code Review Agent(CC)]
    → prompt: "Review 以下代码变更：{{ join.merged }}"
    → output: { content: "Review 结果...", issues: [...] }
    ↓

[result_output — target=task_documents, notify=true]
    → 将 Review 结果存为任务文档
    → 发送通知
```

### 7.2 变量引用语法

```
{{ input.field }}                    — 输入节点输出
{{ agent_output.content }}           — Agent 节点输出
{{ node_id.output.field_name }}      — 任意节点输出引用
{{ node_id.output }}                 — 节点完整输出
{{ join.branch_0.content }}          — Join 分支输出
{{ project.name }}                   — 项目级变量（引擎自动注入）
{{ task.title }}                     — 任务级变量（引擎自动注入）
{{ env.SOME_VAR }}                   — 环境变量
```

---

## 八、实现优先级排序

### P0 — 第一阶段核心（必须）
1. **input 节点**（后端+前端）— 数据流起点
2. **agent 节点配置改造**（前端面板）— 贴合 Nexus Agent 体系
3. **context_output 节点**（后端+前端）— 上下文传递
4. **result_output 节点**（后端+前端）— 结果写回
5. **fork 节点**（后端+前端）— 并行分发
6. **join 节点**（后端+前端）— 并行汇合
7. **sub_workflow 配置改造**（前端面板）
8. **连线样式增强**（箭头+标签+样式）

### P1 — 第一阶段补充
9. **Git 集成**（项目配置 UI + Agent 节点 Git 流程）
10. **webhook_trigger 前端**
11. **transform 前端**
12. **notification 前端**
13. **human 前端**
14. **timer 前端**
15. **现有节点配置优化**（if/switch/loop/wait/http/code）

### P2 — 第二阶段
16. **多项目管理**
17. **OpenClaw 代理审批**
18. **进度汇总报告**

### P3 — 第三阶段
19. **远程 Agent 管理**
20. **工作流模板库**
21. **执行监控大屏**

---

## 九、现有后端节点实现状态

所有节点已有后端实现（CONFIG_SCHEMA + execute）：

| 类型名 | 文件 | 状态 |
|--------|------|------|
| agent | agent.py | ✅ 需改造执行逻辑 |
| code | code_node.py | ✅ |
| condition | condition.py | ✅（考虑与 if 合并） |
| http_request | http_node.py | ✅ |
| human | human.py | ✅ |
| if | if_node.py | ✅ |
| loop | loop_node.py | ✅ |
| notification | notification.py | ✅ |
| output | output_node.py | ✅（拆分） |
| parallel | parallel.py | ✅（被 fork/join 替代） |
| sub_workflow | sub_workflow_node.py | ✅ |
| switch | switch_node.py | ✅ |
| timer | timer.py | ✅ |
| transform | transform.py | ✅ |
| manual_trigger | triggers.py | ✅ |
| cron_trigger | triggers.py | ✅ |
| webhook_trigger | triggers.py | ✅ |
| wait | wait_node.py | ✅ |

**需新增后端**：input, context_output, result_output, fork, join


---

## 十、Agent 运行模式

### 10.1 前台 vs 后台

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 前台（foreground） | Agent 进程在前台运行，输出实时可见 | 本地开发调试 |
| 后台（background） | Agent 进程后台运行，日志通过 Nexus 收集 | 服务器部署、批量执行 |

**实际方案**：
- Agent 通过 Bridge 注册后始终后台运行
- Nexus 前端提供**实时日志流**（WebSocket 推送），UI 展示效果接近终端
- 本地调试时，用户也可直接在本机开 Claude Code 终端查看，Nexus 只负责调度

**Agent 节点配置新增**：
```json
{
  "runMode": {
    "type": "string",
    "title": "运行模式",
    "enum": ["foreground", "background"],
    "default": "background",
    "description": "foreground: 本地终端可见; background: 后台运行，日志回传 Nexus"
  }
}
```

### 10.2 实时日志流

- WebSocket 端点：`ws://host/ws/workflow-executions/{execution_id}/logs`
- 推送内容：Agent stdout/stderr、节点状态变更、进度百分比
- 前端：终端风格的日志面板，支持搜索、过滤、自动滚动

---

## 十一、OpenClaw 集成权限

### 11.1 项目级权限配置

每个项目可独立配置 OpenClaw 的访问权限，五级递进：

| 级别 | 名称 | 说明 |
|------|------|------|
| `none` | 独立管理 | OpenClaw 完全无法访问此项目 |
| `readonly` | 只读观察 | 可查询项目状态、任务列表、执行记录 |
| `summary` | 进度汇总 | 只读 + 可获取详细进度，生成汇总报告 |
| `approval` | 代理审批 | 汇总 + 可接收审批请求并回复（不能创建/调度） |
| `full` | 全程托管 | 审批 + 可创建任务、触发工作流、管理 Agent |

### 11.2 前端配置

项目设置页面：
```
┌─ OpenClaw 集成 ──────────────────────────┐
│ 启用 OpenClaw 集成：☑                     │
│ 权限级别：                                │
│  ○ 独立管理 — OpenClaw 无法访问           │
│  ○ 只读观察 — 可查看项目状态               │
│  ○ 进度汇总 — 可读取进度并汇报             │
│  ○ 代理审批 — 可代替你审批                 │
│  ○ 全程托管 — 调度+审批+汇报全部接管       │
└───────────────────────────────────────────┘
```

### 11.3 技术实现

- 数据库：`projects` 表新增 `openclaw_permission` 字段（VARCHAR(20), 默认 `none`）
- OpenClaw 通过专用 API Token 调用 Nexus API
- Nexus 中间件校验：根据项目的 `openclaw_permission` 过滤可访问的 API
- 审批回调：Nexus → OpenClaw Webhook → OpenClaw 处理 → 回调 Nexus → 工作流继续

---

## 十二、Mac 桌面版规划

### 12.1 技术选型

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Tauri**（推荐） | 包体小（~10MB）、性能好、Rust 后端安全、原生系统调用 | 生态较新 |
| Electron | 生态成熟、Node.js 全栈 | 包体大（~150MB）、内存占用高 |

**建议选 Tauri**：包体小、启动快、内存低，适合工具型应用。前端代码可直接复用现有 React 代码。

### 12.2 macOS 原生体验

- **外观**：遵循 Apple Human Interface Guidelines
  - SF Pro 字体
  - 毛玻璃效果（vibrancy）
  - 原生窗口控制（红绿灯按钮）
  - 暗色/亮色模式跟随系统
  - 弹窗/菜单使用原生组件
- **交互**：
  - 系统托盘常驻，显示运行状态
  - 通知中心推送（Agent 完成、审批请求等）
  - 全局快捷键（Cmd+Shift+N 快速新建任务等）
  - 拖拽文件到窗口上传
- **性能**：
  - 冷启动 < 2s
  - 内存占用 < 100MB（空闲）
  - 后台 CPU < 1%

### 12.3 桌面版独有功能

| 功能 | 说明 |
|------|------|
| 本地 Agent 管理 | 直接管理本机 Claude Code / Codex 进程 |
| 终端面板 | 内嵌终端，可前台启动 Agent 直接查看 |
| 本地 Git | 直接调用本地 git 命令行（无需 API） |
| 文件系统 | 直接访问本地文件，拖拽上传 |
| 离线模式 | 本地缓存项目/任务数据，断线重连同步 |
| 系统通知 | macOS 通知中心推送 |

### 12.4 架构

```
┌─ Tauri 壳 ───────────────────────────┐
│  ┌─ WebView（React 前端）──────────┐ │
│  │  复用现有 React 代码             │ │
│  │  + 桌面版专属组件（终端面板等）   │ │
│  └────────────────────────────────┘ │
│  ┌─ Rust 后端 ────────────────────┐  │
│  │  本地进程管理                    │  │
│  │  Git 操作                       │  │
│  │  文件系统访问                    │  │
│  │  系统托盘/通知                   │  │
│  │  与 Nexus Server 同步            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
         ↕ API/WebSocket
    Nexus Server（云端/自建）
```

### 12.5 开发路径

1. **验证**：先用 Tauri 打包现有前端，确认兼容性
2. **适配**：macOS 原生样式调整（字体、窗口、毛玻璃）
3. **增强**：加入终端面板、本地 Agent 管理
4. **优化**：离线缓存、性能优化、签名公证
5. **发布**：DMG / Homebrew 分发

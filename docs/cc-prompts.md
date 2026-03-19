# Nexus CC Prompts (精简拆分版)

Project: /Users/lh8/projects/agent-orchestration
顺序: 迭代一 → 二 → 三 → 四 → 五 → 七

IMPORTANT: All code comments, commit messages, and explanations must be in Chinese (简体中文).
Read CLAUDE.md first before each task.
Do NOT push after commit.

=====================================================================

## 迭代一 — 任务 1/2: 实时输出流 + 结构化结果

实现任务实时输出流，参考 CCG Workflow (github.com/fengshao1227/ccg-workflow) 的 SSE 架构。

1. oc-bridge: 新建 `agent/output-parser.ts`，解析 CC stream-json 行为结构化事件(CCEvent)和聚合结果(StructuredResult)
2. oc-bridge: types.ts 新增 TaskProgress 消息类型
3. oc-bridge: claude-code.ts 每行输出解析后通过 onProgress 回调
4. oc-bridge: task-manager.ts 发送 TaskProgress 到 WebSocket
5. 后端: gateway_tasks 表加 result_data TEXT 列(alembic 迁移)
6. 后端: gateway.py 新增 SSE 端点 GET /api/gateway/tasks/{task_id}/stream

验证: `cd bridges/oc-bridge && npm run build` && `cd backend && python3 -c "from app.models.gateway import *; print('OK')"`
Commit: `feat(P0): 实时任务输出流 + 结构化结果`

---------------------------------------------------------------------

## 迭代一 — 任务 2/2: 前端实时输出页

基于后端 SSE 端点实现前端实时任务输出展示。

1. hooks/useTaskStream.ts — 连接 SSE，解析事件类型
2. components/tasks/ToolUseCard.tsx — 工具调用可折叠卡片(Write绿/Edit黄/Bash蓝/Read灰)
3. components/tasks/FileChangeList.tsx — 文件修改列表(created✨/edited✏️/deleted🗑️)
4. TaskDetailPage.tsx — 新增"实时输出"tab，自动滚动到底部

验证: `cd frontend && npm run build`
Commit: `feat(P0): 前端任务实时输出展示`

---------------------------------------------------------------------

## 迭代二: 断点续传 + 依赖链

实现任务超时优雅退出、断点续传和任务依赖链。

1. oc-bridge task-manager: 优雅超时(SIGINT→等30s→SIGKILL)，保存 partial_result
2. gateway_schemas: TaskStatus 加 'blocked'，SubmitTaskRequest 加 depends_on，新增 ResumeTaskRequest
3. task_router: depends_on 验证→blocked 状态；依赖完成后自动路由；新增 resume_task 从原任务上下文恢复
4. gateway.py: POST /api/gateway/tasks/{task_id}/resume
5. Alembic: parent_task_id 列

验证: `cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"`
Commit: `feat(P0): 任务断点续传 + 依赖链 + 优雅超时`

---------------------------------------------------------------------

## 迭代三: 重试 + 路由 + 成本

实现自动重试、智能路由和成本追踪。

1. task_router: max_retries(默认0)，失败时指数退避重试，切换 bridge
2. task_router: select_bridge 按活跃任务数升序 + 任务类型亲和性
3. gateway_tasks 加 cost_usd 列 + Alembic 迁移
4. 前端: TaskDetailPage 显示费用

验证: `cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"` && `cd frontend && npm run build`
Commit: `feat(P1): 自动重试 + 智能路由 + 成本追踪`

---------------------------------------------------------------------

## 迭代四 — 任务 1/2: 安全沙盒 + 分页日志

参考 CCG "外部模型只返回 patch，Claude 审核后 apply" 模式。

1. gateway.py: GET /api/gateway/tasks/{id}/logs 分页查询进度事件
2. SubmitTaskRequest 加 sandbox_mode
3. sandbox 模式: 工作目录隔离到 /tmp/nexus-sandbox-{task_id}/，执行后 diff 生成 patch
4. 新增 apply-patch / discard-patch API

验证: `cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"` && `cd bridges/oc-bridge && npm run build`
Commit: `feat(P1): 安全沙盒模式 + 分页日志`

---------------------------------------------------------------------

## 迭代四 — 任务 2/2: 仪表板

1. Bridge 状态组件(在线/离线/活跃任务数/后端类型)，定时轮询
2. 任务时间线(按时间排序，显示耗时/费用/状态，支持过滤)
3. 仪表板页面(Bridge状态 + 时间线 + 费用汇总)

验证: `cd frontend && npm run build`
Commit: `feat(P1): 仪表板 — Bridge 状态 + 任务时间线`

---------------------------------------------------------------------

## 迭代五 — 任务 1/3: BaseAgent 接口 + 重构 Claude Code

参考 CCG codeagent-wrapper/config.go 的 Backend interface 设计模式。

在 oc-bridge 中建立多后端抽象层，为后续接入 Codex/OpenCode 打基础。

1. 新建 `agent/base.ts`，定义：
   ```typescript
   interface CCEvent {
     type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done';
     subtype?: string;
     content: string;
     toolName?: string;
     toolInput?: any;
     isError?: boolean;
     costUsd?: number;
     tokenUsage?: { input: number; output: number };
   }

   interface StructuredResult {
     filesModified: Array<{ path: string; action: 'created' | 'edited' | 'deleted' }>;
     commandsRun: Array<{ command: string; exitCode: number }>;
     errors: string[];
     summary: string;
     tokenUsage: { input: number; output: number };
     costUsd: number;
   }

   interface BaseAgent {
     name: string;
     command: string;
     buildArgs(prompt: string, options: AgentOptions): string[];
     parseStreamLine(line: string): CCEvent | null;
     buildStructuredResult(events: CCEvent[]): StructuredResult;
     detectPresence(): Promise<boolean>;
   }

   interface AgentOptions {
     workdir?: string;
     timeout?: number;
     skipPermissions?: boolean;
     sandboxMode?: boolean;
     extraEnv?: Record<string, string>;
   }
   ```

2. 重构 `agent/claude-code.ts`，实现 BaseAgent 接口：
   - buildArgs: `['--print', '--verbose', '--output-format', 'stream-json', prompt]`
   - parseStreamLine: 解析 CC stream-json 格式（参考现有 output-parser.ts 逻辑）
   - detectPresence: `which claude` 检查
   - 把现有 ClaudeCodeRunner 的进程管理逻辑保留，但 stdin/stdout 处理改用 BaseAgent 方法

3. 新建 `agent/registry.ts`：
   ```typescript
   const agentRegistry = new Map<string, () => BaseAgent>();
   function registerAgent(agent: BaseAgent) { ... }
   function getAgent(name: string): BaseAgent { ... }
   function getAvailableAgents(): Promise<BaseAgent[]> { ... }
   ```
   注册 ClaudeCodeAgent 为默认

验证: `cd bridges/oc-bridge && npm run build`
Commit: `refactor: BaseAgent 接口 + 重构 ClaudeCode 实现`

---------------------------------------------------------------------

## 迭代五 — 任务 2/3: Codex CLI 适配器

⚠️ 先调研：运行 `codex --help` 查看当前 CLI 参数和 `--json` 输出格式，以及 `codex --full-auto` 的行为。

新建 `agent/codex-code.ts`，实现 BaseAgent 接口：

1. buildArgs:
   - 主模式: `['--full-auto', '--json', prompt]`
   - 如果有 workdir: 加 `--cwd` 或通过环境变量指定
   - skipPermissions: codex 原生支持 `--approval-mode full-auto`

2. parseStreamLine:
   - Codex JSON stream 格式与 CC 不同，需要根据实际 help 输出解析
   - 常见格式: `{"type":"content","content":"..."}`
   - 映射为统一的 CCEvent 格式

3. buildStructuredResult:
   - 从 Codex 事件流中提取文件修改、命令执行、token 用量

4. detectPresence: 检查 `codex` 命令是否存在

5. 在 registry.ts 中注册 `codex` 后端

验证: `cd bridges/oc-bridge && npm run build`
Commit: `feat: Codex CLI 适配器`

---------------------------------------------------------------------

## 迭代五 — 任务 3/3: OpenCode 适配 + 配置管理 + 前端

⚠️ 先调研：访问 https://github.com/opencode-ai/opencode 查看 CLI 用法，运行 `opencode --help`（如果已安装）。

1. 新建 `agent/opencode.ts`，实现 BaseAgent 接口（同 Codex 模式）

2. 新建 `config/agent-config.ts`：
   - 路径: `~/.oc-bridge/agents.json`
   - 内容: 每个后端的独立配置（enabled, command_path, default_args, timeout, env_vars）
   - AgentConfigManager: load/save/reload

3. 更新 `cli/start.ts`：
   - 启动时调用 detectPresence() 检测所有已注册后端
   - 心跳消息中上报可用后端列表

4. 后端: SubmitTaskRequest 新增 `backend` 字段（可选，默认 'claude'）
   - task_router 根据 backend 字段筛选 bridge

5. 前端: agent 节点配置面板新增后端选择下拉框
   - 选项: Claude / Codex / OpenCode / 自动（由 bridge 决定）

验证: `cd bridges/oc-bridge && npm run build` && `cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"` && `cd frontend && npm run build`
Commit: `feat: OpenCode 适配 + 后端配置管理 + 前端选择器`

---------------------------------------------------------------------

## 迭代七 — 任务 1/4: spec 约束分析节点

OPSX 约束驱动开发的第一步：把模糊需求转化为精确约束集。
参考: OPSX (fission-ai/opsx) 的 spec-research + CCG 的 /ccg:enhance 命令。

新建 `backend/app/services/workflow_engine/nodes/spec_node.py`：

```python
@NodeRegistry.register("spec", label="约束分析", category="quality", icon="search")
```

CONFIG_SCHEMA:
```python
{
    "requirement": {"type": "string", "required": True, "description": "需求描述"},
    "scope": {"type": "string", "enum": ["full", "backend", "frontend", "infrastructure"], "default": "full"},
    "parallel_models": {"type": "boolean", "default": False, "description": "是否用多模型并行提取约束"},
    "max_constraints": {"type": "integer", "default": 20, "description": "最大约束数"}
}
```

execute() 实现三个步骤：

**Step 1 — _enhance_prompt(requirement, scope):**
- 将模糊需求扩展为结构化需求
- 输出: {goal, background, scope, constraints_hint, acceptance_criteria}
- 如果 parallel_models=True，用两个模型分别增强，合并去重

**Step 2 — _extract_constraints(enhanced, scope):**
- 从增强需求中提取约束，6 个维度:
  - functional(功能性): 系统必须实现什么行为
  - security(安全性): 认证、授权、数据保护、输入验证
  - performance(性能): 响应时间、吞吐量、资源限制
  - compatibility(兼容性): 浏览器、API 版本、数据格式
  - architecture(架构): 模块化、可扩展、技术栈约束
  - testing(可测试性): 需要什么测试覆盖
- 每个约束: {id: "C01", text, category, priority: "MUST"|"SHOULD"|"MAY", verifiable: bool, anti_pattern: str}
- anti_pattern 描述"错误的实现方式"，帮执行者避坑

**Step 3 — _define_criteria(constraints):**
- 为每个 verifiable=True 的约束定义成功判据
- 每个判据: {id: "S01", text, constraint_ids: ["C01"], verification_method: "test"|"code_review"|"api_test"|"manual"}
- 可选 PBT 属性: pbt_properties[{name, property, input_space, invariant}]

返回 NodeResult:
```python
{
    "enhanced_requirement": {...},
    "constraints": [...],        # 全部约束
    "success_criteria": [...],   # 成功判据
    "summary": "共提取 12 个约束(8 MUST, 3 SHOULD, 1 MAY)，8 个成功判据"
}
```

在 `__init__.py` 注册。

验证: `cd backend && python3 -c "from app.services.workflow_engine.nodes.spec_node import SpecNode; print('OK')"`
Commit: `feat(P0): spec 约束分析节点 — 需求 → 精确约束集`

---------------------------------------------------------------------

## 迭代七 — 任务 2/4: plan 零决策计划节点

OPSX 第二步：把约束集转化为机械可执行的计划。执行者不需要做任何判断。

新建 `backend/app/services/workflow_engine/nodes/plan_node.py`：

```python
@NodeRegistry.register("plan", label="零决策计划", category="quality", icon="clipboard")
```

CONFIG_SCHEMA:
```python
{
    "analysis_depth": {"type": "string", "enum": ["quick", "normal", "deep"], "default": "normal"},
    "include_tests": {"type": "boolean", "default": True},
    "target_framework": {"type": "string", "default": "", "description": "目标技术栈，如 fastapi/react"}
}
```

execute() 实现：

**Step 1 — 读取上游输入:**
- 从 context.input_data 获取 spec 节点输出的 constraints 和 success_criteria

**Step 2 — _build_zero_decision_plan(constraints, criteria, depth, framework):**

每个计划步骤必须 ZERO-DECISION（零决策）：
```python
{
    "step_number": 1,
    "action": "create_file" | "edit_file" | "delete_file" | "run_command" | "install_dep",
    "description": "人类可读的简要说明",
    "file": "path/to/file",           # create_file/edit_file/delete_file 时必填
    "exact_content": "...",            # create_file 时的完整文件内容
    "search_content": "...",           # edit_file 时要查找的内容
    "replace_content": "...",          # edit_file 时替换为的内容
    "command": "npm install xxx",      # run_command/install_dep 时的命令
    "constraint_ids": ["C01", "C02"],  # 这个步骤满足了哪些约束
    "verification_command": "pytest tests/test_auth.py",  # 执行后如何验证
    "rollback": "rm src/auth.py"       # 如果这步失败如何回滚
}
```

**Step 3 — _detect_conflicts(plan):**
- 检查步骤之间是否有冲突（同一文件被多次修改、依赖顺序问题）
- 如果有冲突，合并步骤或标记为 [需人工确认]

**Step 4 — 生成测试步骤（如果 include_tests=True）:**
- 为每个 verifiable 的成功判据生成对应的测试步骤
- 包括：单元测试、集成测试、边界测试

返回 NodeResult:
```python
{
    "constraints_count": 12,
    "plan_steps": [...],
    "conflicts": [],
    "estimated_files": 8,
    "estimated_commands": 5,
    "summary": "共 15 个执行步骤，0 个冲突，预计修改 8 个文件"
}
```

在 `__init__.py` 注册。

验证: `cd backend && python3 -c "from app.services.workflow_engine.nodes.plan_node import PlanNode; print('OK')"`
Commit: `feat(P0): plan 零决策计划节点 — 约束集 → 机械执行计划`

---------------------------------------------------------------------

## 迭代七 — 任务 3/4: review 交叉验证节点

OPSX 第三步：用两个模型独立审查执行结果，交叉验证约束合规性。

新建 `backend/app/services/workflow_engine/nodes/review_node.py`：

```python
@NodeRegistry.register("review", label="交叉验证", category="quality", icon="shield")
```

CONFIG_SCHEMA:
```python
{
    "review_dimensions": {
        "type": "array",
        "items": {"type": "string"},
        "default": ["spec_compliance", "logic_correctness", "security", "maintainability"]
    },
    "fail_on_critical": {"type": "boolean", "default": True, "description": "存在 Critical 时节点返回 FAILED"},
    "reviewer_a_model": {"type": "string", "default": "", "description": "审查者A的模型（空则用默认）"},
    "reviewer_b_model": {"type": "string", "default": "", "description": "审查者B的模型（空则用默认）"}
}
```

execute() 实现：

**Step 1 — 组装审查上下文:**
```
审查上下文 = {
    原始需求: spec.enhanced_requirement,
    约束列表: spec.constraints,
    执行计划: plan.plan_steps,
    实际执行结果: context.input_data.result 或上游 agent 节点输出
}
```

**Step 2 — 构建审查 prompt（给两个模型同一个 prompt）:**
```
你是代码审查专家。请从以下维度审查代码变更是否满足所有约束。

审查维度: {review_dimensions}
约束列表: {constraints}

对每个约束，判断:
- compliant: 完全满足 / partially_compliant: 部分满足 / non_compliant: 不满足
- severity: "critical" / "major" / "minor" / "info"
- finding: 具体问题描述
- suggestion: 修复建议（如果是 non_compliant 或 partially_compliant）

以 JSON 格式返回审查结果。
```

**Step 3 — 合并两个审查结果:**
- 两个审查者都认为 critical → 一定是 critical
- 一个 critical + 一个 non_compliant → critical
- 两个都 major → major
- 去重：相同文件的相同问题只保留一个

**Step 4 — 输出:**
```python
{
    "review_a": {"findings": [...], "summary": "..."},
    "review_b": {"findings": [...], "summary": "..."},
    "merged_findings": [...],
    "compliance": {"compliant": 8, "partial": 2, "non_compliant": 1, "total": 11},
    "critical_count": 1,
    "status": "FAILED"  # fail_on_critical=True 且 critical_count>0 时
}
```

如果 fail_on_critical=True 且 critical_count > 0，返回 NodeStatus.FAILED。

在 `__init__.py` 注册。

验证: `cd backend && python3 -c "from app.services.workflow_engine.nodes.review_node import ReviewNode; print('OK')"`
Commit: `feat(P0): review 交叉验证节点 — 双模型独立审查`

---------------------------------------------------------------------

## 迭代七 — 任务 4/4: verify 约束验证 + artifact 管理

OPSX 最后一步：自动化验证每个约束是否满足，管理 spec artifact 生命周期。

**Part A — verify_node.py:**

新建 `backend/app/services/workflow_engine/nodes/verify_node.py`：

```python
@NodeRegistry.register("verify", label="约束验证", category="quality", icon="check-circle")
```

CONFIG_SCHEMA:
```python
{
    "auto_fix": {"type": "boolean", "default": False, "description": "验证失败时自动修复"},
    "generate_pbt": {"type": "boolean", "default": False, "description": "为约束生成属性测试"},
    "verification_methods": {
        "type": "object",
        "default": {"code_review": True, "test_execution": True, "static_analysis": False}
    }
}
```

execute() 实现：

**Step 1 — 从上游读取:**
- success_criteria (来自 spec 节点)
- merged_findings (来自 review 节点，如果有)
- 实际执行结果

**Step 2 — 逐条验证:**
每个成功判据验证过程:
```python
{
    "criterion_id": "S01",
    "text": "...",
    "method": "code_review" | "test_execution" | "static_analysis",
    "result": "passed" | "failed" | "warning",
    "evidence": "验证依据（测试输出/代码片段/静态分析结果）",
    "fix_suggestion": "失败时的修复建议"
}
```

**Step 3 — 汇总:**
```python
{
    "results": [...],
    "passed": 7,
    "failed": 1,
    "warning": 2,
    "total": 10,
    "pass_rate": 0.7,
    "auto_fixes_applied": 0,       # auto_fix 模式下自动修复的数量
    "pbt_tests_generated": [...]   # generate_pbt 模式下生成的测试
}
```

**Part B — spec_artifact.py + spec 路由:**

新建 `backend/app/models/spec_artifact.py`：
```python
class SpecArtifact(Base):
    __tablename__ = "spec_artifacts"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    change_id = Column(String, index=True)           # 变更批次 ID
    artifact_type = Column(String)                    # constraint_set / plan / review / verification
    content = Column(Text)                            # JSON 格式的完整内容
    constraints = Column(Text)                        # JSON: 约束列表快照
    success_criteria = Column(Text)                   # JSON: 成功判据快照
    status = Column(String, default="draft")          # draft / approved / archived
    parent_artifact_id = Column(String, nullable=True) # 关联上游 artifact
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

Alembic 迁移。

新建 `backend/app/routers/spec.py`：
- `POST /api/v1/specs/changes` — 创建变更（传入需求描述，关联 project）
- `GET /api/v1/specs/changes` — 列出变更
- `GET /api/v1/specs/changes/{id}` — 变更详情
- `POST /api/v1/specs/changes/{id}/artifacts` — 添加 artifact（spec/plan/review/verify 各阶段的输出）
- `GET /api/v1/specs/changes/{id}/artifacts` — 列出 artifacts
- `POST /api/v1/specs/changes/{id}/archive` — 归档变更

在 main app 中注册 spec 路由。

在 `__init__.py` 注册 verify 节点。

验证:
- `cd backend && python3 -c "from app.services.workflow_engine.nodes.verify_node import VerifyNode; print('OK')"`
- `cd backend && python3 -c "from app.models.spec_artifact import SpecArtifact; print('OK')"`
Commit: `feat(P0): verify 约束验证节点 + spec artifact 管理系统`

# 迭代三 P1：工作流增强

## 背景
T2 已完成，P0 全部修复。本 prompt 处理 3 个 P1 级别增强功能。

## 修复 1：Git 集成（agent 节点 gitEnabled）

**目标**：当 agent 节点启用 `gitEnabled: true` 时，自动为任务创建 Git 分支并提交变更。

**需要修改的文件**：
- `backend/app/services/workflow_engine/nodes/agent.py` — 在 execute() 中实现 Git 逻辑

**实现方案**：
```python
async def execute(self, context: NodeContext) -> NodeResult:
    # ... 现有逻辑 ...

    git_enabled = context.node_config.get("gitEnabled", False)

    if git_enabled and self.work_dir:
        # 1. 创建分支（基于当前分支）
        branch_name = f"agent-{context.node_id[:8]}-{int(time.time())}"
        run_git_cmd(["git", "checkout", "-b", branch_name], cwd=self.work_dir)

        # 2. 执行 agent（现有逻辑）
        # ...

        # 3. 执行完成后，检查是否有变更并提交
        result = run_git_cmd(["git", "status", "--porcelain"], cwd=self.work_dir)
        if result.strip():
            run_git_cmd(["git", "add", "-A"], cwd=self.work_dir)
            run_git_cmd(["git", "commit", "-m", f"Agent {context.node_id}: {task_summary[:50]}"], cwd=self.work_dir)
            output_data["git_branch"] = branch_name
            output_data["git_commit"] = get_git_head(self.work_dir)
        else:
            output_data["git_branch"] = branch_name
            output_data["git_commit"] = None
```

**辅助函数**（放在 agent.py 底部）：
```python
import subprocess
import shutil

def run_git_cmd(args: list, cwd: str) -> str:
    """Run a git command and return stdout."""
    if not shutil.which("git"):
        return ""
    try:
        result = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""

def get_git_head(cwd: str) -> str:
    """Get current HEAD commit hash (short)."""
    return run_git_cmd(["git", "rev-parse", "--short", "HEAD"], cwd)
```

**关键点**：
- `work_dir` 来自 `context.node_config.get("workDir")`，如果为空则跳过 Git 操作
- 不做 push（只本地创建分支+提交）
- 不做 merge 回主分支（需要人工审核）
- 错误时 log warning 但不中断 agent 执行

## 修复 2：Projects 表添加 Git 相关字段

**需要修改的文件**：
- `backend/app/models/project.py` — 添加字段

**添加字段**：
```python
# Git 相关
git_repo_url: Mapped[Optional[str]] = mapped_column(String(500))
git_default_branch: Mapped[Optional[str]] = mapped_column(String(100))
git_auto_merge: Mapped[bool] = mapped_column(Boolean, default=False)
```

**注意**：SQLite 支持 `ALTER TABLE ADD COLUMN`，但需要在应用启动时自动迁移。检查项目是否有自动迁移机制，如果没有，在 `app/database.py` 或启动代码中添加：
```python
# SQLite auto-migration for new columns
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN git_repo_url VARCHAR(500)"))
except Exception:
    pass  # Column already exists
# 同理 git_default_branch, git_auto_merge
```

## 修复 3：Join 节点超时策略

**问题**：join 节点的 CONFIG_SCHEMA 有 `timeout` 和 `onTimeout` 字段，但引擎层没有实现超时逻辑。如果某个分支永远不完成，join 会永远等待。

**需要修改的文件**：
- `backend/app/services/workflow_engine/engine.py` — 在 `_handle_join_upstream` 中实现超时

**实现方案**：
```python
# 在 _handle_join_upstream 方法中，当第一个分支到达时启动超时计时
import asyncio

# 存储超时任务：{execution_id: {join_node_id: asyncio.Task}}
_join_timeout_tasks: Dict[str, Dict[str, asyncio.Task]] = {}

# 在 _handle_join_upstream 中：
join_config = join_node_def.get("data", join_node_def.get("config", {}))
join_timeout = join_config.get("timeout", 3600)  # 默认 1 小时
on_timeout = join_config.get("onTimeout", "continue_with_ready")

# 第一个分支到达时启动超时
if reported == 1:
    async def timeout_handler():
        await asyncio.sleep(join_timeout)
        # 超时触发
        if should_execute:
            return  # 已正常完成
        # 处理超时
        if on_timeout == "fail":
            self._fail_execution(execution_id, db, f"Join node {join_node_id} timed out")
        elif on_timeout == "continue_with_ready":
            # 用已收集的数据执行 join
            await self._execute_join_node(...)
        elif on_timeout == "skip":
            pass  # 跳过 join 节点

    if execution_id not in _join_timeout_tasks:
        _join_timeout_tasks[execution_id] = {}
    _join_timeout_tasks[execution_id][join_node_id] = asyncio.create_task(timeout_handler())

# join 正常执行时取消超时
if should_execute:
    timeout_task = _join_timeout_tasks.get(execution_id, {}).pop(join_node_id, None)
    if timeout_task and not timeout_task.done():
        timeout_task.cancel()

# 执行结束时清理
_join_timeout_tasks.pop(execution_id, None)
```

## 验收标准

1. **Git 集成**：agent 节点 gitEnabled=true + workDir 设置后，执行后 output_data 包含 git_branch 和 git_commit
2. **Projects 表**：新增 3 个 Git 字段，启动时自动迁移，不报错
3. **Join 超时**：join 节点可以设置 timeout，超时后按 onTimeout 策略处理
4. Python 编译通过
5. 后端启动正常

## 禁止事项
- 不要自动 push 到远程仓库
- 不要自动 merge 分支
- 不要修改前端代码（P1 前端适配后续再做）
- 不要删除已有功能

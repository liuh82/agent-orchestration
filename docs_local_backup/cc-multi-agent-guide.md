# 在 VSCode 中使用 CC 进行多 Agent 并行开发

## 适用场景

Nexus 项目前后端并行开发：后端 CC + 前端 CC 同时工作，互不干扰。

---

## 方案一：多终端标签页（最简单推荐 ✅）

### 操作步骤

1. **打开 VSCode 终端面板** — `Ctrl+`` ` 或菜单 Terminal → New Terminal

2. **拆分终端** — 点击终端面板右上角的 `+` 旁边的下拉箭头，选 **Split Terminal**（或快捷键在终端面板里右键选 Split）

3. **现在你有两个终端面板**，分别启动 CC：

   **终端 1（后端）**：
   ```bash
   cd agent-orchestration
   cc
   ```
   
   **终端 2（前端）**：
   ```bash
   cd agent-orchestration
   cc
   ```

4. **给每个 CC 下不同指令**：
   
   **终端 1**：
   > 读取 `docs/backend-r1-infrastructure.md`，按里面的任务清单完成所有工作。完成后不要 git commit，等我确认。
   
   **终端 2**：
   > 读取 `docs/frontend-r1-infrastructure.md`，按里面的任务清单完成所有工作。完成后不要 git commit，等我确认。

5. **各自独立工作**，完成后你手动统一 commit：
   ```bash
   git add backend/
   git commit -m "feat(backend): R1 infrastructure"
   
   git add frontend/
   git commit -m "feat(frontend): R1 infrastructure"
   ```

### 优缺点
- ✅ 最简单，零配置
- ✅ 两个 CC 上下文完全隔离
- ✅ 各自输出可见，方便监控
- ❌ 终端多了一占屏幕空间

---

## 方案二：VSCode 任务配置（可重复启动）

### 创建 `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "CC: Backend Agent",
      "type": "shell",
      "command": "cc",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "presentation": {
        "group": "backend"
      },
      "problemMatcher": []
    },
    {
      "label": "CC: Frontend Agent",
      "type": "shell",
      "command": "cc",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "presentation": {
        "group": "frontend"
      },
      "problemMatcher": []
    },
    {
      "label": "CC: Start Both Agents",
      "dependsOn": ["CC: Backend Agent", "CC: Frontend Agent"],
      "problemMatcher": []
    }
  ]
}
```

### 使用方式

1. `Ctrl+Shift+P` → 输入 **Tasks: Run Task**
2. 选 **CC: Start Both Agents** → 自动打开两个终端并启动 CC
3. 或分别启动 **CC: Backend Agent** 和 **CC: Frontend Agent**

---

## 方案三：CC Headless 模式（自动化脚本）

### 单次执行命令

```bash
# 后端 R1 — 直接执行完输出结果
cc -p "读取 docs/backend-r1-infrastructure.md，按里面的任务清单完成所有工作。完成后不要 git commit。" --allowedTools "Edit,Write,Bash"

# 前端 R1
cc -p "读取 docs/frontend-r1-infrastructure.md，按里面的任务清单完成所有工作。完成后不要 git commit。" --allowedTools "Edit,Write,Bash"
```

### 参数说明

| 参数 | 说明 |
|------|------|
| `-p "prompt"` | 直接给提示词，非交互模式 |
| `--allowedTools` | 限制可用工具，避免乱操作 |
| `--print` | 只输出文本，不执行（预览） |
| `--output-format json` | JSON 输出，方便脚本解析 |
| `--max-turns 50` | 限制最大轮数 |
| `--continue` | 继续上一次对话 |
| `--resume session-id` | 恢复指定会话 |

### 串行执行脚本 `run-dev.sh`

```bash
#!/bin/bash
set -e

PROJECT_DIR="/path/to/agent-orchestration"
cd "$PROJECT_DIR"

echo "========== Backend R1 =========="
cc -p "读取 docs/backend-r1-infrastructure.md，按里面的任务清单完成所有工作。完成后不要 git commit。" \
   --allowedTools "Edit,Write,Bash"

echo "========== Backend R1 done, committing... =========="
git add backend/
git commit -m "feat(backend): R1 infrastructure"

echo "========== Frontend R1 =========="
cc -p "读取 docs/frontend-r1-infrastructure.md，按里面的任务清单完成所有工作。完成后不要 git commit。" \
   --allowedTools "Edit,Write,Bash"

echo "========== Frontend R1 done, committing... =========="
git add frontend/
git commit -m "feat(frontend): R1 infrastructure"

echo "========== R1 Complete =========="
```

```bash
chmod +x run-dev.sh
./run-dev.sh
```

---

## 方案四：CC 子 Agent / Team 功能

### CC 内置 Agent 管理

CC 支持在对话中管理子任务：

```
> /agents
```
查看和管理可用的 agent。

### 让 CC 自己拆分子任务

在 CC 对话中直接说：

> 你是 Nexus 项目的后端开发 agent。完成以下任务：
> 1. 读取 docs/backend-r1-infrastructure.md
> 2. 按任务清单逐步完成
> 3. 每完成一个模块告诉我进度
> 4. 完成后不要 git commit

### CC 并行子 Agent（如果 CC 版本支持）

较新版本的 CC 支持在对话中生成子 Agent：

```
> 帮我启动一个子 agent 专门处理后端 R1 的任务
> 同时我再处理前端的事情
```

CC 会 fork 出一个子进程来独立处理后端任务。

### 使用 `.clinerules` 或 `CLAUDE.md` 约束行为

在项目根目录创建 `CLAUDE.md`：

```markdown
# Nexus 项目开发规则

## Git 规则
- 不要自动 git commit，等我确认
- commit message 格式：feat(模块): 描述

## 工作范围
- 后端 agent 只修改 backend/ 目录
- 前端 agent 只修改 frontend/ 目录
- 不要交叉修改对方目录

## 验证
- 完成每个模块后运行测试确认
- 后端：python -c "import app; print('OK')"
- 前端：npm run build 确认无报错
```

这样无论哪个 CC 启动都会自动读到这些规则。

---

## 💡 实战建议

### 推荐工作流

```
┌─────────────────────────────────────────────────┐
│  VSCode                                          │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ Terminal 1      │  │ Terminal 2      │       │
│  │ CC: Backend     │  │ CC: Frontend    │       │
│  │ R1 → R2 → R3    │  │ R1 → R2 → R3    │       │
│  │ → R4            │  │ → R4            │       │
│  └────────┬────────┘  └────────┬────────┘       │
│           │                    │                 │
│           ▼                    ▼                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Terminal 3: Git & Deploy                │    │
│  │ git add → commit → push → deploy       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 三个终端的职责

| 终端 | 职责 | 命令 |
|------|------|------|
| Terminal 1 | 后端 CC | `cc` → 喂 backend-r*.md |
| Terminal 2 | 前端 CC | `cc` → 喂 frontend-r*.md |
| Terminal 3 | 你自己控制 | git commit / npm run build / 部署 |

### CC 会话管理技巧

```bash
# 查看历史会话
cc --resume

# 恢复上次后端会话
cc --continue

# 如果 CC 中途断了，恢复继续
cc --resume <session-id>
```

### 防冲突铁律

1. **后端 CC 只改 `backend/`**，**前端 CC 只改 `frontend/`**
2. **共同依赖的文件**（如 `package.json` 根目录的）只让一个 CC 改，另一个需要时你手动同步
3. **git commit 由你统一做**，不让 CC 碰 git
4. **每个轮次完成先验证再进下一轮**

---

## 常见问题

### Q: 两个 CC 同时跑会不会互相锁文件？
A: 只要改不同目录就不会。后端改 `backend/`，前端改 `frontend/`，零冲突。

### Q: CC 会不会自动 git commit？
A: 默认会问你要不要。加上 `CLAUDE.md` 里的规则可以禁止。也可以用 `--allowedTools` 去掉 Bash 权限。

### Q: 中途断了怎么恢复？
A: `cc --continue` 继续上次会话。CC 会记住上下文。

### Q: Token 够用吗？
A: 分轮提示词已经控制了上下文大小（5-10KB/轮），CC 的上下文窗口够用。一轮做完清上下文，开新会话喂下一轮。

### Q: 怎么看两个 CC 的进度？
A: VSCode 终端面板支持多标签，切着看就行。也可以用方案三的 headless 模式，输出到文件。

---

## 快速启动清单

- [ ] 安装 CC（已装跳过）
- [ ] 项目根目录创建 `CLAUDE.md`（开发规则）
- [ ] VSCode 打开两个终端
- [ ] 终端 1 启动 CC，喂 backend-r1
- [ ] 终端 2 启动 CC，喂 frontend-r1
- [ ] 终端 3 留给 git 和部署
- [ ] R1 完成 → 你 commit → R2 → ...

# Nexus V3 迭代二 — Claude Code 执行指南

> 日期：2026-03-16
> 决策确认：任务拆分✅ 工作流编辑器完全重写✅ 数据库清空重建✅ 先做低风险修复✅
> 开发方式：本地 Claude Code → git push → 服务器自动拉取

---

## 零、Claude Code 环境准备

### 0.1 安装

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### 0.2 认证

```bash
claude
# 首次使用会打开浏览器进行 Anthropic 账号认证
# 或者设置 API Key：
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### 0.3 关于 Team 功能

Claude Code Team 主要是 Anthropic 的付费方案（多人共享 API 额度），技术上不需要特殊启用。
项目级指令通过 CLAUDE.md 实现，Claude Code 会自动读取。

---

## 一、开发流程

```
Mac 本地                         GitHub                    服务器
┌──────────────┐   git push    ┌────────┐   auto-pull    ┌──────────────┐
│ VSCode       │ ───────────→  │  Repo  │ ────────────→  │ 自动拉取     │
│ + Claude Code│               │        │   (每2分钟)     │ 热重载生效   │
└──────────────┘               └────────┘                └──────────────┘
```

### 每个任务的完整流程

```bash
# Step 1: 拉取最新代码（确保有最新的 prompt 文件）
git pull

# Step 2: 在项目目录打开 VSCode
# 打开 agent-orchestration 文件夹

# Step 3: 打开 Claude Code 面板
# 侧边栏点击 Claude Code 图标（或 Cmd+Shift+P → "Claude: Open"）

# Step 4: 粘贴 prompt
# 在 Claude Code 对话框中粘贴对应任务的 prompt
# prompt 内容就是 docs/dev-prompts/v2/ 下对应文件的内容
# 按 Enter 发送

# Step 5: 等待 Claude Code 执行
# 它会自动读取项目文件、修改代码
# 完成后列出修改文件清单

# Step 6: 检查变更
# 在 VSCode 的 Source Control（源代码管理）面板查看 git diff
# 确认改动正确

# Step 7: 提交并推送
git add .
git commit -m "feat(模块): 描述"
git push origin main

# Step 8: 验证
# 打开浏览器 http://81.70.98.45:9443 检查对应功能
# 服务器每2分钟自动拉取，也可以告诉助手手动拉
```

### 如果用终端（不用 VSCode）

```bash
git pull
cd /你的/agent-orchestration/路径

# 方式A：直接传入 prompt 文件
claude -p "$(cat docs/dev-prompts/v2/task-t1-architecture.md)"

# 方式B：交互式（粘贴 prompt）
claude
# 然后粘贴 prompt 内容

# 完成后检查
git diff --stat
git add .
git commit -m "docs: T1 架构文档v4"
git push origin main
```

---

## 二、任务列表和 Prompt 文件

所有 prompt 文件位于 `docs/dev-prompts/v2/` 目录：

| 序号 | 任务 | Prompt 文件 | 说明 |
|------|------|------------|------|
| T1 | 更新架构设计文档 | task-t1-architecture.md | 纯文档，不改代码 |
| T2 | 数据库清空重建 | task-t2-db-migration.md | 依赖T1 |
| T3 | 后台管理页修复 | task-t3-admin-fixes.md | 4个修复项 |
| T4 | Dashboard默认展示 | task-t4-dashboard.md | 低风险 |
| T5 | 通知通道配置修复 | task-t5-notification.md | 低风险 |
| T6 | Gateway Bridge CRUD | task-t6-gateway-bridge.md | 低风险 |
| T8 | 工作流编辑器重写 | task-t8-workflow-editor.md | 重写，参照n8n |
| T9 | 工作流执行引擎升级 | task-t9-workflow-engine.md | 后端引擎 |
| T10 | 任务实例化机制 | task-t10-task-instance.md | 依赖T2+T8+T9 |

---

## 三、执行顺序

### 第一轮：验证流程（建议先跑这2个）

**T1 先跑**（必须第一个，其他任务依赖它）

```bash
git pull
claude -p "$(cat docs/dev-prompts/v2/task-t1-architecture.md)"
# 等完成，检查 docs/architecture-v4.md 是否生成
git add .
git commit -m "docs: T1 架构设计文档v4"
git push origin main
```

**T1 完成后跑 T3**（验证 Claude Code 执行质量）

```bash
claude -p "$(cat docs/dev-prompts/v2/task-t3-admin-fixes.md)"
# 等完成，VSCode 里查看 diff
git add .
git commit -m "fix(admin): T3 后台管理页修复"
git push origin main
# 浏览器验证 http://81.70.98.45:9443/admin
```

### 第二轮：低风险修复（T1+T3 没问题的话，可以并行跑）

T3 完成后告诉我，我帮你手动拉取服务器代码并验证。
确认 T3 质量OK，再继续 T4、T5、T6。

### 第三轮：大重构（低风险都跑完后）

T2（数据库）→ T8（编辑器）+ T9（引擎）并行 → T10（实例化）

---

## 四、每个任务完成后

### 4.1 在 Claude Code 对话中确认
- 问它：列出所有修改的文件
- 问它：完成标准 checklist 是否都满足
- 如果有没完成的，用 `claude --resume` 继续

### 4.2 在 VSCode 中检查
- 源代码管理面板看 diff
- 重点检查：有没有误删其他文件、有没有改到不该改的模块

### 4.3 提交
```bash
git add .
git commit -m "feat(模块): 简短描述"
git push origin main
```

### 4.4 通知助手验证
push 完在飞书告诉我，我帮你：
1. 手动 `git pull` 拉取代码（不用等2分钟）
2. 检查后端/前端服务是否正常
3. 如有问题反馈给你

---

## 五、常见问题

### Q: Claude Code 执行到一半停了？
A: 大任务可能需要较长时间。等一下，如果真的断了：
```bash
claude --resume "继续完成之前的任务"
```

### Q: Claude Code 改错了？
A: 立即 `git checkout .` 恢复，然后优化 prompt 重新执行：
```bash
git checkout .
claude -p "$(cat docs/dev-prompts/v2/对应文件.md)"
```

### Q: push 时提示冲突？
A: 说明服务器上有了新的 commit（可能是助手手动改的）：
```bash
git pull --rebase origin main
# 解决冲突后再 push
git push origin main
```

### Q: 怎么判断 Claude Code 完成了？
A: Claude Code 会在对话中明确告诉你完成了，并列出修改的文件。如果不确定，问它：
```
你完成任务了吗？请列出所有修改的文件。
```

### Q: Claude Code 会自动 git commit 吗？
A: 不会。CLAUDE.md 里禁止了自动 commit，必须手动提交。

### Q: 服务器代码多久同步一次？
A: 每2分钟自动检查一次。但 push 完后直接告诉助手，我帮你立即拉取，更快。

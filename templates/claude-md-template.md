# 🏗️ Claude Code 项目模板 — CLAUDE.md 快速启动

> 从 CCDesk 实战 + CCBP 20.3k stars 方法论提炼。复制到新项目，填 `[ ]` 即可。
> **版本**: v1.0 · **更新**: 2026-03-23 · **来源**: 20+ 项目实战经验

---

## 使用方法

```bash
# 1. 复制到新项目根目录
cp claude-md-template.md your-project/CLAUDE.md

# 2. 按 [TODO] 标记填写项目信息
# 3. 删除注释行（以 <!-- 开头的行）
# 4. 提交到 git
```

---

## 模板开始 👇

```markdown
# [项目名称]

<!-- ⚠️ 启动时先读 AGENTS.md（如果存在），这是文档导航索引 -->

<!-- 💡 规则用代码块包裹 — CC 80% 概率忽略 MUST 全大写指令，但会遵守代码块里的规则 -->

---

## 不可违反的规则

\`\`\`
以下规则违反 = bug。每次犯错后更新此文件记录教训。

1. [TODO: 列出 3-5 条最关键的禁止项]
   例：禁止 inline style / 禁止改 class selector 名 / 禁止 any 类型
2. [TODO: 数值从哪里取？]
   例：设计稿路径: /path/to/design.html — 每个值从设计稿提取，不猜
3. [TODO: 构建验证命令]
   例：改完必须 tsc --noEmit && npm run build 通过
\`\`\`

---

## 架构

- **框架**: [TODO: 例 React 18 + TypeScript + Zustand]
- **布局**: [TODO: 简述主要组件和布局结构]
- **CSS**: [TODO: CSS Modules / Tailwind / Styled Components]
- **构建**: [TODO: npm run build (Vite)，用户用 xxx 打包]

\`\`\`
src/
├── [TODO: 简化目录结构，5-8 行即可]
├── components/    # 组件
├── stores/        # 状态管理
├── hooks/         # 自定义 hooks
├── styles/        # 全局样式/变量
└── types/         # TypeScript 类型
\`\`\`

---

## [关键资源]（如果适用）

\`\`\`
⚠️ 只读以下路径，旧版本路径不要再读

[TODO: 设计稿/文档/API 规范等资源路径]
例：
Light 设计稿: /path/to/design-light.html
API 文档: docs/api-spec.md
\`\`\`

---

## 修改验证流程

\`\`\`
修改代码 → 必须按顺序执行：

1. [TODO: 编译检查命令] 例 npx tsc --noEmit
2. [TODO: 构建命令] 例 npm run build
3. [TODO: 测试命令] 例 npm test（如果有）
4. [TODO: 视觉验证/截图] 例 bash scripts/screenshot.sh
5. 自 Review: [TODO: 3-5 条关键检查项]
   例：有没有 inline style？数值对不对？构建通过吗？
6. 有差异 → 修复 → 从步骤 1 重来
7. 全部通过 → git commit
\`\`\`

复杂任务先输出计划，确认后再执行。

---

## 工作习惯

- Plan-Then-Execute：复杂任务先输出计划再动手
- Git Worktree：并行任务用独立 worktree
- 上下文管理：\`/clear\` 清理，复杂任务拆 sub-agent
- 踩坑记录：犯错后记录到 Gotchas 段

---

## 相关文档

| 文档 | 内容 |
|------|------|
| \`AGENTS.md\` | 项目导航索引（启动时必读，如果存在） |
| \`docs/[TODO]\` | [TODO: 项目文档说明] |
```

---

## 模板结束 👆

---

## 编写原则（给人类的参考）

### 1. 长度控制

| 文件 | 目标行数 | 超过怎么办 |
|------|---------|-----------|
| CLAUDE.md | **< 200 行** | 精简，详细内容放 docs/ |
| 规则代码块 | **< 10 行** | 只保留最关键的 3-5 条 |

### 2. 规则书写技巧

```
# ❌ CC 容易忽略
- 你 MUST NOT 改 class selector 名
- NEVER 用 inline style

# ✅ CC 更容易遵守
```代码块包裹
禁止改 class selector 名 — TSX 引用会断裂
禁止 inline style — 优先级混乱
```
```

### 3. 命令用代码块不用普通文本

```
# ❌ 普通文本，CC 可能当散文读
构建验证：先跑 npx tsc --noEmit，再跑 npm run build

# ✅ 代码块，CC 会当作命令执行
```bash
npx tsc --noEmit && npm run build
```
```

### 4. 分层策略

```
CLAUDE.md (< 200 行) — 约束 + 路径 + 流程
AGENTS.md — 文档导航索引（需在 CLAUDE.md 里手动指定读取）
docs/*.md — 详细内容（CC 按需读）
```

### 5. 踩坑记录格式

```markdown
## Gotchas

| 问题 | 原因 | 规则 |
|------|------|------|
| [具体问题] | [根本原因] | [预防规则] |
```

---

## Command / Agent / Skill 何时用

| 场景 | 用什么 | 示例 |
|------|--------|------|
| 用户显式触发的工作流入口 | **Command** | `/align-design` 对齐设计稿 |
| 需要独立上下文的复杂任务 | **Agent** | UI 验证循环、代码审查 |
| 可复用的专业流程 | **Skill** | 设计 token 提取、截图对比 |

### 编排关系

```
用户 /command → Command 编排（准备参数） → Agent 执行（独立上下文） → Skill 产出
```

---

## 高频踩坑 Top 10（从 20+ 项目提炼）

| # | 问题 | 预防 |
|---|------|------|
| 1 | inline style 覆盖 CSS | 禁止 inline style |
| 2 | 改 class selector 名 → TSX 断裂 | 只改 property 值 |
| 3 | 猜数值不查设计稿/文档 | 数值必须从源提取 |
| 4 | JS/CSS 同步值不一致 | 两边改同一处或用变量 |
| 5 | 用错资源版本（旧设计稿等） | 路径标注版本 + 标注不要读的路径 |
| 6 | CLAUDE.md 太长 CC 忽略后半 | < 200 行 |
| 7 | CLAUDE.md 全大写 MUST 被忽略 | 用代码块包裹 |
| 8 | CC 不自动读 AGENTS.md | CLAUDE.md 里手动指定 |
| 9 | 不验证就提交 | 强制验证流程 |
| 10 | 上下文污染 | /clear + sub-agent 隔离 |

---

## 持续改进记录

| 日期 | 版本 | 改动 |
|------|------|------|
| 2026-03-23 | v1.0 | 初始版，基于 CCDesk + CCBP 20.3k stars |

---

*从实战中来，到实战中去。每个项目用完后更新踩坑记录。*

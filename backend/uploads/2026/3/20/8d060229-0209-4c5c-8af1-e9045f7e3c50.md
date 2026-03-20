# CCDesk v0.2.0 架构设计 — Cline 风格聊天 UI

> 基于 Cline (Claude Dev) 界面参考，重构 CCDesk 前端交互层。
> 日期：2026-03-20

---

## 一、现状分析

### v0.1.0 问题
- **终端风格 UI 无法交互**：tmux 分屏 + TerminalView 在 Tauri WebView 中渲染正常但输入/快捷键全部失效
- **设计方向偏差**：以终端模拟器思路设计，但 CC CLI 输出是 JSON stream 而非纯文本终端
- **功能缺失**：设置入口不可见、会话管理未接通、输入框无法使用

### Cline 参考设计的优势
- **聊天式交互**：消息列表 + 底部输入框，用户直觉操作
- **结构化输出**：AI 回复支持 markdown 渲染、代码块语法高亮、工具调用折叠展示
- **文件集成**：右侧面板展示文件树 + diff 视图
- **工具栏清晰**：项目路径、模型选择、操作按钮一目了然
- **审批机制**：工具调用前用户可预览 diff 并 Approve/Reject
- **上下文管理**：token 使用量可视化、对话压缩

---

## 二、整体布局

```
┌──────────────────────────────────────────────────────┐
│  Toolbar（项目路径 | 分支 | 模型选择 | token bar | ⚙️）│
├──────────┬───────────────────────┬───────────────────┤
│          │                       │                   │
│ Sidebar  │    Chat Area          │  Tool Panel       │
│ ──────── │                       │  ──────────────   │
│ Sessions │  User Message         │  Files (文件树)   │
│          │  ┌──────────────┐     │                   │
│ History  │  │ Hello       │     │  ─── OR ───       │
│          │  └──────────────┘     │                   │
│          │                       │  Diff (变更预览)  │
│          │  Assistant Message    │                   │
│          │  ┌──────────────┐     │                   │
│          │  │ I'll help... │     │                   │
│          │  │ ┌──────────┐ │     │                   │
│          │  │ │ code     │ │     │                   │
│          │  │ └──────────┘ │     │                   │
│          │  └──────────────┘     │                   │
│          │                       │                   │
│          ├───────────────────────┤                   │
│          │  Input Area           │                   │
│          │  ┌─────────────────┐  │                   │
│          │  │ @ Type or /cmd  │  │                   │
│          │  └─────────────────┘  │                   │
│          │  [📎] [Auto-accept]  │                   │
│          │  [▶ Send]  [⏹ Stop]  │                   │
│          │                       │                   │
└──────────┴───────────────────────┴───────────────────┘
```

### 三栏布局
| 区域 | 宽度 | 可折叠 | 说明 |
|------|------|--------|------|
| Sidebar | 240px | ✅ Cmd+B | 会话列表 + 历史记录 |
| Chat Area | flex:1 | ❌ | 消息列表 + 输入框 |
| Tool Panel | 300px | ✅ Cmd+Shift+F | 文件树 / Diff 视图 |

---

## 三、功能清单

### 3.1 核心功能（P0 — 必须实现）

| # | 功能 | 说明 |
|---|------|------|
| 1 | **聊天式消息展示** | 用户消息 + AI 回复交替展示，支持 Markdown 渲染 |
| 2 | **流式输出** | AI 回复逐字显示，实时打字效果 |
| 3 | **代码块语法高亮** | 多语言语法高亮 + 复制按钮 + 行号 |
| 4 | **底部输入框** | 多行 textarea，Enter 发送，Shift+Enter 换行 |
| 5 | **CC CLI 进程管理** | 启动/停止/重启 CC 进程，stream-json 输出解析 |
| 6 | **工具调用展示** | Read/Write/Edit/Bash 等工具调用以折叠块展示 |
| 7 | **项目选择** | 选择本地项目目录作为工作目录 |

### 3.2 增强功能（P1 — 重要）

| # | 功能 | 说明 |
|---|------|------|
| 8 | **工具调用审批（Permission Prompt）** | Write/Edit/Bash 等操作前弹出 diff/命令预览，用户 Approve/Reject/Edit |
| 9 | **@ 文件引用** | 输入框中 `@filename` 自动补全，将文件内容注入上下文 |
| 10 | **Diff 预览** | Write/Edit 操作前展示 diff（绿增红删），支持部分编辑后批准 |
| 11 | **会话管理** | 新建/删除/重命名会话，按项目+时间分组 |
| 12 | **会话持久化** | SQLite 存储消息历史，重启不丢失 |
| 13 | **停止生成** | AI 回复中可点击 ⏹ 或按 Escape 停止 |
| 14 | **Auto-accept 模式** | 设置中可配置自动批准工具调用（分工具类型） |

### 3.3 体验优化（P2 — 锦上添花）

| # | 功能 | 说明 |
|---|------|------|
| 15 | **Token 使用量条** | Toolbar 中显示 context window 使用进度条 |
| 16 | **消息编辑** | 点击已发送的用户消息可编辑，重新生成 AI 回复 |
| 17 | **对话压缩（Compact）** | 一键压缩长对话，释放 context window |
| 18 | **斜杠命令** | `/clear` 清空、`/model` 切换模型、`/compact` 压缩 |
| 19 | **错误重试** | 工具调用失败时显示红色错误 + Retry 按钮 |
| 20 | **文件树面板** | 右侧面板显示项目文件树，点击查看文件内容 |
| 21 | **成本估算** | 根据模型 + token 用量显示当前会话费用 |
| 22 | **全局搜索** | Cmd+K 搜索历史会话内容 |

### 3.4 未来功能（P3 — 后续版本）

| # | 功能 | 说明 |
|---|------|------|
| 23 | **MCP 工具集成** | 接入 MCP 协议外部工具服务器 |
| 24 | **多模型切换** | 输入框旁快速切换 Claude/GPT/Gemini |
| 25 | **主题切换** | Dark/Light 主题 + 自定义 |
| 26 | **快捷指令模板** | 保存常用 prompt 模板，一键调用 |
| 27 | **拖拽文件** | 拖拽文件到输入框自动添加 @引用 |

---

## 四、组件架构

```
src/
├── app/
│   ├── App.tsx                  # 三栏布局 + 全局状态
│   ├── App.css
│   └── theme/                   # 主题系统（保留现有）
├── components/
│   ├── Toolbar/
│   │   ├── Toolbar.tsx          # 顶部工具栏
│   │   ├── TokenBar.tsx         # Token 使用量进度条
│   │   └── Toolbar.css
│   ├── Sidebar/
│   │   ├── Sidebar.tsx          # 左侧边栏容器
│   │   ├── SessionList.tsx      # 会话列表（按项目+时间分组）
│   │   ├── SessionItem.tsx      # 单个会话条目
│   │   └── Sidebar.css
│   ├── Chat/
│   │   ├── ChatView.tsx         # 聊天主容器（消息列表 + 输入）
│   │   ├── MessageList.tsx      # 消息列表（虚拟滚动）
│   │   ├── MessageBubble.tsx    # 单条消息（用户/AI）
│   │   ├── AssistantContent.tsx # AI 回复渲染（Markdown + 工具调用）
│   │   ├── ToolCallBlock.tsx    # 工具调用折叠块
│   │   ├── PermissionPrompt.tsx # 工具调用审批弹窗（diff 预览）
│   │   ├── CodeBlock.tsx        # 代码块（语法高亮）
│   │   ├── MarkdownRenderer.tsx # Markdown → React
│   │   ├── InputArea.tsx        # 底部输入区（含 @ 补全 + / 命令）
│   │   ├── FileAtMention.tsx    # @ 文件引用自动补全
│   │   ├── SlashCommands.tsx    # 斜杠命令菜单
│   │   └── Chat.css
│   ├── ToolPanel/
│   │   ├── ToolPanel.tsx        # 右侧面板容器
│   │   ├── FileTree.tsx         # 文件树
│   │   ├── DiffView.tsx         # 变更预览（统一 diff）
│   │   └── ToolPanel.css
│   ├── Settings/
│   │   ├── SettingsDialog.tsx   # 设置弹窗（保留+增强）
│   │   └── Settings.css
│   └── common/
│       ├── IconButton.tsx       # 通用图标按钮
│       ├── Tooltip.tsx          # 工具提示
│       ├── Avatar.tsx           # 用户/AI 头像
│       ├── Spinner.tsx          # 加载动画
│       └── ProgressBar.tsx      # 进度条（token bar）
├── stores/
│   ├── useChatStore.ts          # 聊天状态（消息列表、当前会话）
│   ├── useSessionStore.ts       # 会话管理
│   ├── useProjectStore.ts       # 项目信息
│   ├── usePermissionStore.ts    # 权限/审批状态
│   └── useSettingsStore.ts      # 设置（保留）
├── hooks/
│   ├── useClaudeCLI.ts          # CC CLI 进程管理 + 输出解析
│   ├── useKeyboard.ts           # 快捷键（保留）
│   ├── useAutoScroll.ts         # 消息自动滚动
│   ├── useFileAtMention.ts      # @ 文件引用补全逻辑
│   └── useSlashCommands.ts      # / 命令解析
└── utils/
    ├── streamParser.ts          # Claude stream-json 解析
    ├── diffParser.ts            # Unified diff 生成和解析
    ├── markdown.ts              # Markdown 工具函数
    ├── fileIcons.ts             # 文件图标映射
    └── tokenCounter.ts          # Token 估算（基于字符数）
```

---

## 五、核心功能详细设计

### 5.1 Toolbar（顶部工具栏）

```
┌──────────────────────────────────────────────────────────────┐
│  📁 /Users/lh8/my-project │ main │ ⬇ Claude 3.5 │ ████░ 42% │ ⚙️ │
└──────────────────────────────────────────────────────────────┘
```

**组成元素：**
- **项目路径**：点击弹出目录选择器
- **Git 分支**：自动读取当前分支（如有 git）
- **模型选择**：下拉切换模型（claude-sonnet-4-20250514 等）
- **Token Bar**：显示 context window 使用百分比，超过 80% 变黄，超过 95% 变红
- **设置按钮**：打开设置弹窗

**高度：** 40px，固定顶部

### 5.2 Chat Area（聊天主区域）

#### MessageBubble 消息气泡

**用户消息：**
```
┌──────────────────────────────┐
│ 👤 User              [📋] [✏️]│  ← 复制 + 编辑按钮
│                              │
│ 帮我写一个 Python 快速排序    │
│ @src/sort.py                 │  ← 文件引用高亮显示
└──────────────────────────────┘
```
- 右对齐或左对齐（均可，Cline 是左对齐带头像）
- 头像区分用户（👤）和 AI（🤖）

**AI 回复：**
```
┌──────────────────────────────────────┐
│ 🤖 Assistant                 [📋]   │
│                                      │
│ 好的，这是一个快速排序实现：          │
│                                      │
│ ┌─ Python ───────────── [📋] [📂] ┐ │  ← 复制 + 在文件树中定位
│ │  1 │ def quicksort(arr):         │ │  ← 行号
│ │  2 │     if len(arr) <= 1:       │ │
│ │  3 │         return arr          │ │
│ │  4 │     pivot = arr[0]          │ │
│ │  5 │     left = [x for x...     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ─────────────────────────────────── │
│                                      │
│ ▶ ✅ Read file (0.8s)               │  ← 已完成工具调用
│   └ src/sort.py                     │
│                                      │
│ ▶ ⏳ Write file ...                  │  ← 运行中工具调用
│   └ src/sort.py (+42 -0 lines)      │
│                                      │
│ ▶ ❌ Bash (failed)        [Retry]   │  ← 失败工具调用
│   └ npm install                     │
│   └ Error: EACCES: permission...    │
└──────────────────────────────────────┘
```

#### 工具调用状态

| 状态 | 图标 | 说明 |
|------|------|------|
| running | ⏳ (spinner) | 工具正在执行，显示进度 |
| completed | ✅ | 成功完成，显示摘要 |
| error | ❌ | 执行失败，显示错误信息 + Retry |
| rejected | 🚫 | 用户拒绝执行 |
| approved (auto) | ✅⤵ | 自动批准通过 |

### 5.3 PermissionPrompt（工具调用审批）★ 核心功能

当 CC 要执行 Write/Edit/Bash 等有副作用的操作时，暂停执行，弹出审批界面：

**Write/Edit 审批：**
```
┌────────────────────────────────────────────┐
│  🔧 Permission Request                      │
│                                              │
│  Claude wants to edit: src/sort.py          │
│                                              │
│  ┌─ Diff ─────────────────────────────────┐ │
│  │  -2 │ def sort(arr):      # 删除行     │ │
│  │  -3 │     pass                         │ │
│  │  +2 │ def quicksort(arr): # 新增行     │ │
│  │  +3 │     if len(arr) <= 1:            │ │
│  │  +4 │         return arr               │ │
│  │  +5 │     pivot = arr[0]               │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  [Approve] [Reject] [Edit & Approve]         │
│  ☐ Always auto-approve for this session      │
└────────────────────────────────────────────┘
```

**Bash 审批：**
```
┌────────────────────────────────────────────┐
│  🔧 Permission Request                      │
│                                              │
│  Claude wants to run:                        │
│  ┌─ Bash ──────────────────────────────────┐ │
│  │ $ npm install lodash                     │ │
│  └────────────────────────────────────────┘ │
│  Working directory: /Users/lh8/my-project    │
│                                              │
│  [Approve] [Reject] [Edit & Approve]         │
│  ☐ Always auto-approve for this session      │
└────────────────────────────────────────────┘
```

**审批逻辑：**
```typescript
interface PermissionConfig {
  // 按工具类型配置审批策略
  Read: 'always' | 'ask' | 'deny';     // 默认 always
  Write: 'always' | 'ask' | 'deny';    // 默认 ask
  Edit: 'always' | 'ask' | 'deny';     // 默认 ask
  Bash: 'always' | 'ask' | 'deny';     // 默认 ask
  Glob: 'always' | 'ask' | 'deny';     // 默认 always
  Grep: 'always' | 'ask' | 'deny';     // 默认 always
}
```

- `ask`：弹出审批弹窗
- `always`：自动批准，不弹窗
- `deny`：自动拒绝

**Rust 后端实现：**
- CC 进程输出 tool_use 事件 → 暂停 stdin 写入
- 通过 Tauri event 通知前端 → 弹出 PermissionPrompt
- 用户操作 → 通过 Tauri command 通知后端 → 继续/终止

### 5.4 @ 文件引用

输入框中输入 `@` 触发文件补全：

```
┌──────────────────────────────────────────┐
│  @src/comp                               │  ← 输入 @ 触发
│  ┌──────────────────────────┐            │
│  │ 📄 src/components/       │  ← 补全列表 │
│  │    ├── App.tsx           │            │
│  │    ├── Toolbar.tsx       │            │
│  │    └── ChatView.tsx      │            │
│  └──────────────────────────┘            │
└──────────────────────────────────────────┘
```

**实现：**
- Rust 后端扫描项目目录结构（已在 `commands::project` 中）
- 前端 debounce 300ms 过滤匹配
- 选中后替换为 `@src/components/App.tsx`
- 发送消息前，Rust 后端将 `@` 引用替换为文件实际内容
- 消息气泡中 `@path` 显示为高亮标签

### 5.5 InputArea（底部输入区）

```
┌──────────────────────────────────────────┐
│                                          │
│  @ Type a message or / for commands...   │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  📎 Attach   [Auto-accept: Write ✓ Bash ✗]  [▶ Send] │
└──────────────────────────────────────────┘
```

**功能：**
- 多行输入（Shift+Enter 换行，Enter 发送）
- `@` 文件引用自动补全
- `/` 斜杠命令菜单（/clear, /model, /compact, /help）
- 附件按钮（拖拽文件自动添加为 @ 引用）
- **Auto-accept 快捷开关**：快速切换哪些工具自动批准
- 发送按钮（有输入时激活）
- **停止生成按钮**（AI 回复中显示 ⏹，替换发送按钮）
- 输入框高度自适应（最小 60px，最大 200px）

### 5.6 斜杠命令

| 命令 | 功能 |
|------|------|
| `/clear` | 清空当前会话消息 |
| `/compact` | 压缩对话历史，释放 context window |
| `/model <name>` | 切换模型（自动补全） |
| `/help` | 显示所有可用命令 |
| `/config` | 打开设置弹窗 |
| `/cost` | 显示当前会话费用统计 |

### 5.7 Token 使用量条

```
Context: ████████████████░░░░░░░░  68%  (136k / 200k tokens)
                                  ↑ 变色规则：
                                  < 70%: 蓝色
                                  70-90%: 黄色
                                  > 90%: 红色 + 建议压缩
```

**实现：**
- 前端粗略估算：`tokens ≈ characters / 3.5`（英文）或 `characters / 1.5`（中文）
- 精确计算：CC CLI 返回的 result 事件中包含 token 使用量
- 超过 90% 时在输入框上方显示警告：`⚠️ Context window almost full. Use /compact to compress.`

### 5.8 消息编辑 + 重新生成

- 用户消息右上角有编辑按钮 ✏️
- 点击后消息变为可编辑 textarea
- 修改后点 "Resubmit"，删除该消息及之后所有消息，重新发送给 CC
- CC 重新生成回复

### 5.9 对话压缩（Compact）

```typescript
// Compact 流程：
// 1. 用户点击 /compact 或 Toolbar 上的压缩按钮
// 2. 前端发送特殊指令给 CC：/compact
// 3. CC CLI 内置支持 compact 命令
// 4. CC 返回压缩后的摘要
// 5. 前端替换消息历史为摘要，清空 token bar
```

如果 CC CLI 不支持 `/compact`，则在前端实现：
- 保留最近 N 条完整消息
- 旧消息替换为 LLM 生成的摘要
- 存储摘要在数据库中

### 5.10 Sidebar（左侧边栏）

```
┌──────────────────────┐
│  💬 Sessions    [+]  │
├──────────────────────┤
│  🔍 Search sessions..│
├──────────────────────┤
│  📁 my-project       │
│  ├ 🔥 Refactor auth  │  ← 🔥 = 当前活跃
│  ├ Add login page    │
│  └ Fix CSS bug       │
│                      │
│  📁 other-project    │
│  └ Setup CI          │
│                      │
│  🕐 Today            │
│  ├ Debug API         │
│  └ Write tests       │
│                      │
│  🕐 Yesterday        │
│  └ Code review       │
└──────────────────────┘
```

**功能：**
- 按项目分组 → 按时间分组
- 搜索会话标题和内容（Cmd+K）
- 右键菜单：重命名、删除、固定（📌）
- 会话标题自动从第一条用户消息生成
- 当前活跃会话高亮 + 🔥 图标

### 5.11 Tool Panel（右侧工具面板）

**Tab 切换：Files | Diff**

**Files 视图：**
- 项目文件树（懒加载，目录展开时读取）
- 文件图标按类型区分（.tsx, .py, .json, .md...）
- 点击文件显示内容
- 右键菜单：在终端打开、复制路径

**Diff 视图：**
- Tab 切换：`All Changes | Session Changes`
- **All Changes**：当前会话所有 Write/Edit 操作的 unified diff
- **Session Changes**：按文件分组，每个文件可展开/折叠
- Diff 语法：绿底新增行，红底删除行，灰底上下文行
- 每个文件 diff 旁有 `Revert` 按钮（恢复到原始状态）

---

## 六、CC CLI 集成方案

### 6.1 进程管理

```rust
// src-tauri/src/core/process.rs

pub struct ClaudeProcess {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    session_id: String,
    permission_tx: mpsc::Sender<PermissionAction>,
    permission_rx: mpsc::Receiver<PermissionDecision>,
}

/// 工具调用审批决策
pub enum PermissionDecision {
    Approve,
    Reject,
    Edit(String),  // 用户修改后的内容
}

impl ClaudeProcess {
    /// 启动 CC CLI 进程
    pub async fn start(
        cli_path: &str,
        working_dir: &str,
        model: Option<&str>,
        permission_mode: &str,
    ) -> Result<Self, Error> { ... }

    /// 发送用户输入
    pub async fn send_input(&mut self, input: &str) -> Result<(), Error> { ... }

    /// 流式读取输出，遇到 tool_use 时暂停等待审批
    pub async fn read_output(&mut self) -> Result<StreamEvent, Error> { ... }

    /// 处理审批结果
    pub async fn resolve_permission(&mut self, decision: PermissionDecision) -> Result<(), Error> { ... }

    /// 停止生成（发送 Ctrl+C）
    pub async fn stop_generation(&mut self) -> Result<(), Error> { ... }

    /// 终止进程
    pub async fn kill(&mut self) -> Result<(), Error> { ... }
}
```

### 6.2 输出解析（前端）

CC CLI `--output-format stream-json` 输出格式：
```json
{"type":"assistant","message":{"content":"...","role":"assistant"}}
{"type":"content_block_start","index":0,"content_block":{"type":"text"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
{"type":"content_block_stop","index":0}
{"type":"tool_use","id":"...","name":"Read","input":{"file_path":"..."}}
{"type":"tool_result","tool_use_id":"...","content":"..."}
{"type":"result","result":"...","duration_ms":1234,"usage":{"input_tokens":100,"output_tokens":500}}
```

```typescript
// utils/streamParser.ts

export type StreamEvent =
  | { type: 'assistant_start'; sessionId: string }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; output: string }
  | { type: 'tool_error'; id: string; error: string }
  | { type: 'permission_request'; id: string; name: string; input: any }
  | { type: 'result'; output: string; duration: number; usage?: TokenUsage }
  | { type: 'error'; message: string };

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

export function parseStreamLine(line: string): StreamEvent | null {
  try {
    const json = JSON.parse(line);
    // 映射 CC stream-json → 内部事件
    // tool_use + name in [Write,Edit,Bash] → permission_request
    // 其他 tool_use → 直接通过
  } catch {
    return null;
  }
}
```

### 6.3 Tauri 事件流

```typescript
// Rust 端
// app.emit("claude-output", payload);           // 流式输出
// app.emit("claude-permission", payload);       // 审批请求

// 前端监听
listen<{ event: string, payload: string }>("claude-output", ({ payload }) => {
  const streamEvent = parseStreamLine(payload);
  if (streamEvent) useChatStore.getState().appendEvent(streamEvent);
});

listen<ToolCall>("claude-permission", ({ payload }) => {
  usePermissionStore.getState().showPrompt(payload);
});
```

### 6.4 @ 文件引用处理

```typescript
// 前端：解析 @ 引用
function parseAtMentions(text: string): { cleanText: string; files: string[] } {
  const regex = /@([\w./\-]+\.\w+)/g;
  const files: string[] = [];
  const cleanText = text.replace(regex, (_, path) => {
    files.push(path);
    return `@${path}`; // 保留引用标记
  });
  return { cleanText, files };
}

// Rust 后端：发送前替换 @ 为文件内容
async fn resolve_at_mentions(input: &str, work_dir: &str) -> String {
  // @src/App.tsx → 读取文件内容，包裹在 <<FILE:src/App.tsx>> ... <<END_FILE>> 中
}
```

---

## 七、数据模型

### 7.1 Chat Store

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;              // Markdown 文本
  toolCalls?: ToolCall[];       // 工具调用列表
  atMentions?: string[];        // @ 引用的文件路径
  tokenUsage?: TokenUsage;      // 该消息的 token 消耗
  durationMs?: number;          // AI 生成耗时
  timestamp: number;
  isStreaming?: boolean;        // AI 正在生成中
}

interface ToolCall {
  id: string;
  name: string;                 // Read | Write | Edit | Bash | Glob | Grep ...
  status: 'pending' | 'running' | 'completed' | 'error' | 'rejected';
  input: any;
  output?: string;
  diff?: string;                // Write/Edit 的 diff
  duration?: number;            // ms
  permissionDecision?: 'approved' | 'rejected' | 'auto-approved';
}

interface ChatState {
  messages: ChatMessage[];
  currentMessage: string;       // 正在流式拼接的 AI 回复
  currentToolCalls: ToolCall[];
  isGenerating: boolean;
  isWaitingPermission: boolean; // 等待用户审批
  sessionId: string | null;
  totalTokens: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  };
  // Actions
  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  resolvePermission: (id: string, decision: PermissionDecision) => void;
  editMessage: (id: string, newText: string) => void;
  compactChat: () => void;
  clearChat: () => void;
}
```

### 7.2 Session Store

```typescript
interface Session {
  id: string;
  title: string;
  projectPath: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
  pinned: boolean;
}
```

### 7.3 Permission Store

```typescript
interface PermissionConfig {
  Read: 'always' | 'ask' | 'deny';
  Write: 'always' | 'ask' | 'deny';
  Edit: 'always' | 'ask' | 'deny';
  Bash: 'always' | 'ask' | 'deny';
  Glob: 'always' | 'ask' | 'deny';
  Grep: 'always' | 'ask' | 'deny';
}

interface PermissionState {
  config: PermissionConfig;
  pendingRequest: ToolCall | null;  // 当前等待审批的请求
  resolve: (decision: PermissionDecision) => void;
  updateConfig: (tool: string, mode: 'always' | 'ask' | 'deny') => void;
}
```

---

## 八、样式系统

### 8.1 主题色（Dark Mode 优先）

```css
:root {
  /* Backgrounds */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --bg-input: #3c3c3c;
  --bg-hover: #3e3e42;

  /* Text */
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #6a6a6a;

  /* Accents */
  --accent: #6c8cff;
  --accent-hover: #5a7ae8;
  --accent-muted: rgba(108, 140, 255, 0.15);

  /* Status */
  --success: #4ec9b0;
  --error: #f14c4c;
  --warning: #cca700;
  --info: #3794ff;

  /* Chat */
  --user-bubble-bg: transparent;
  --user-bubble-border: var(--border);
  --ai-bubble-bg: transparent;

  /* Diff */
  --diff-add-bg: rgba(46, 160, 67, 0.15);
  --diff-add-text: #4ec9b0;
  --diff-del-bg: rgba(248, 81, 73, 0.15);
  --diff-del-text: #f14c4c;
  --diff-context: var(--text-muted);

  /* Code */
  --code-bg: #1a1a1a;
  --code-border: var(--border);

  /* Borders */
  --border: #3e3e42;
  --border-focus: var(--accent);

  /* Scrollbar */
  --scrollbar: rgba(121, 121, 121, 0.4);
  --scrollbar-hover: rgba(121, 121, 121, 0.7);
}
```

### 8.2 关键尺寸

| 元素 | 高度/宽度 | 字号 |
|------|-----------|------|
| Toolbar | 40px | 13px |
| Sidebar | 240px | 12px |
| Tool Panel | 300px | 12px |
| 消息气泡 padding | 16px 20px | 14px |
| 代码块 padding | 12px 16px | 13px monospace |
| 输入框 min-height | 60px | 14px |
| Permission 弹窗 max-width | 600px | 13px |
| 状态栏 | 24px | 11px |

---

## 九、快捷键

| 快捷键 | 功能 |
|--------|------|
| Enter | 发送消息 |
| Shift+Enter | 换行 |
| Escape | 停止生成 / 关闭弹窗 |
| Cmd+N | 新建会话 |
| Cmd+B | 切换侧边栏 |
| Cmd+Shift+F | 切换工具面板 |
| Cmd+, | 打开设置 |
| Cmd+K | 全局搜索会话 |
| Cmd+Shift+P | 命令面板 |
| Cmd+1/2/3 | 切换面板焦点 |

---

## 十、迁移策略

### 保留（不改动）
- ✅ Rust 后端：`core/`, `db/`, `error/`, `commands/`
- ✅ SQLite 数据库 schema（扩展，不改结构）
- ✅ Tauri 配置（capabilities, permissions）
- ✅ 主题系统 `theme/`
- ✅ CI/CD workflow
- ✅ 设置弹窗组件框架

### 重写（前端）
- 🔄 `TerminalView` → `ChatView` + `MessageList` + `InputArea` + `PermissionPrompt`
- 🔄 `StatusBar` → `Toolbar` + `TokenBar`
- 🔄 `SplitPane` → 移除（不再需要分屏）
- 🔄 `ProjectManager` → 集成到 Sidebar + Toolbar
- 🔄 `SessionList` → 优化 UI（按项目+时间分组）
- 🔄 `CommandPalette` → 保留 + 整合斜杠命令

### 新增
- ➕ `MarkdownRenderer`（react-markdown + remark-gfm + rehype-highlight）
- ➕ `CodeBlock`（语法高亮 + 复制 + 行号）
- ➕ `ToolCallBlock`（工具调用折叠 + 状态动画）
- ➕ `PermissionPrompt`（审批弹窗 + diff 预览）★
- ➕ `FileAtMention`（@ 文件引用补全）★
- ➕ `SlashCommands`（/ 命令菜单）★
- ➕ `TokenBar`（context window 进度条）★
- ➕ `ToolPanel`（文件树 + Diff 视图）
- ➕ `DiffView`（unified diff 渲染）★
- ➕ `streamParser`（CC stream-json 解析 + 审批事件）
- ➕ `diffParser`（unified diff 生成）
- ➕ `tokenCounter`（token 估算）
- ➕ `useClaudeCLI` hook（进程管理 + 审批通道）
- ➕ `usePermissionStore`（审批状态管理）

### 新增依赖
```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0",
  "highlight.js": "^11.0.0"
}
```

---

## 十一、开发阶段

### Phase 1：基础框架 + 聊天核心（2 天）
- 三栏布局骨架
- Toolbar + Sidebar 占位
- InputArea 输入 + 发送（纯前端，不接 CC）
- MessageList + MessageBubble 基础渲染
- MarkdownRenderer 集成
- CodeBlock 语法高亮

### Phase 2：CC CLI 集成（2 天）
- useClaudeCLI hook（进程启动/停止/输入）
- stream-json 解析 + 流式消息展示
- Tauri event system 双向通信
- ToolCallBlock 折叠/展开
- 工具调用状态动画

### Phase 3：审批机制 ★（1.5 天）
- PermissionPrompt 弹窗
- Write/Edit diff 预览
- Bash 命令预览
- Approve/Reject/Edit&Approve
- Auto-accept 配置
- Rust 端暂停/恢复逻辑

### Phase 4：会话 + @引用 + /命令（1.5 天）
- Sidebar 会话列表（按项目+时间分组）
- 会话持久化（SQLite）
- @ 文件引用自动补全
- / 斜杠命令
- Token 使用量条
- 消息编辑 + 重新生成

### Phase 5：工具面板 + 收尾（1 天）
- ToolPanel 文件树
- DiffView 变更预览
- 对话压缩（compact）
- 错误重试
- 快捷键完善
- 窗口大小记忆
- 设置接入
- 整体测试 + bug 修复

**总计：~8 天**

---

## 十二、与现有代码的兼容性

- **CLAUDE.md 保持不变**：CC 执行指南不变
- **Rust 后端 API 兼容**：现有 Tauri commands 保持，新增审批事件通道
- **数据库 schema 兼容**：在现有 tables 基础上扩展（messages 表等）
- **CI 流程不变**：构建脚本无需改动
- **v0.1.1 的 CSS 修复仍然有效**：作为热修复保留

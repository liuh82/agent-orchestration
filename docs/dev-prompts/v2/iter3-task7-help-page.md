# CC Task: 帮助页面 + 编辑器内帮助弹窗

## 任务概述

在 Nexus 前端中实现帮助系统，包含独立帮助页面和工作流编辑器内的快捷帮助入口。

## 需求详情

### 1. 独立帮助页面 `/help`

**路由：** `App.tsx` 中新增 `/help` 路由，放在 ProtectedRoute 内

**页面：** 新建 `frontend/src/pages/HelpPage.tsx`

**内容：** 内嵌以下教程内容（作为 React 常量，不用 markdown 渲染库）：

```
# Nexus 工作流编辑器 — 使用教程

## 1. 快速开始

### 创建工作流
1. 进入「工作流」菜单
2. 点击「新建工作流」
3. 输入名称（如"代码审查流程"）
4. 进入编辑器画布

### 基本操作
| 操作 | 方式 |
|------|------|
| 添加节点 | 从左侧面板拖拽到画布 |
| 连线 | 从节点底部圆点拖到另一个节点顶部圆点 |
| 配置节点 | 点击节点 → 右侧面板编辑 |
| 删除节点 | 选中节点 → 按 Delete 键或点击面板中的删除按钮 |
| 删除连线 | 选中连线 → Delete 键 |
| 保存 | 点击右上角「保存」按钮 |
| 运行 | 点击右上角「运行」按钮 |

## 2. 节点类型总览

### 触发器（工作流起点，无输入端口）
- 手动触发：手动点击启动，无需配置
- 定时触发：Cron 表达式定时执行
- Webhook触发：接收外部 HTTP 请求
- 输入：从项目/任务提取上下文

### 逻辑控制
- IF：条件分支，输出 true/false
- Switch：多条件路由，输出 case_0/case_1/.../default
- Loop：循环执行，输出 body/done
- Wait：等待/延迟
- Fork：并行分发，输出 branch_0/branch_1（最多2个）
- Join：并行汇合，等待所有上游分支完成后合并

### Agent
- Agent：调用 AI Agent 执行任务

### 工作流
- 子工作流：嵌套调用另一个工作流

### 数据
- HTTP请求：调用外部 API
- Code：执行 Python/JavaScript 代码
- Transform：数据格式转换

### 输出（工作流终点）
- 输出：格式化并输出最终结果
- 上下文输出：写回任务的上下文字段（摘要、备注等）
- 结果输出：标记工作流完成，更新任务状态

## 3. 连线规则

连线会根据源节点类型自动设置样式：
- IF/Switch → 绿色/红色虚线（条件分支）
- Fork/Join → 蓝色实线（并行分支）
- 其他 → 灰色实线（普通流转）

规则：
- 同一个输出端口可以连多个目标节点
- 多个输出端口可以连同一个目标节点（如 Join）
- 不能自连或形成循环（Loop 除外）

## 4. 核心节点配置

### Agent 节点
基础配置：模型、Prompt、温度、最大Token
高级设置：超时时间、失败策略（停止/跳过/重试/回退值）、输出过滤、缓存

### Fork 节点
- 分发模式：广播（所有分支收到相同数据）/ 分发（每个分支收到不同数据）
- 分支数量：当前支持 2 个分支

### Join 节点
- 等待模式：等待全部 / 任意一个
- 合并策略：追加（保留独立结果+merged数组）/ 合并（深度合并）

### Input 节点
- 数据来源：项目/任务/手动/上游
- 提取字段：按需选择
- 组装模板：用 {{ field }} 引用字段

### Code 节点
- 语言：Python / JavaScript
- 可用变量：upstream、input
- 输出：print() 的 JSON 会被解析为节点输出

### 上下文输出 / 结果输出
上下文输出：将中间结果写回任务（summary/notes/tags），支持追加/覆盖
结果输出：输出格式（JSON/Markdown/纯文本），完成后动作（标记完成/标记完成并通知）

## 5. 示例工作流

### 简单 Agent 工作流
手动触发 → Agent → 输出

### 条件分支
手动触发 → Agent(分类) → IF → Agent(正面回复) → 输出
                                → Agent(负面回复) → 输出

### 并行执行
手动触发 → Fork → Agent(A:前端审查) ─┐
                      Agent(B:后端审查) ─┤→ Join → 输出

### 完整审查流程
输入(项目数据) → Agent(审查) → IF(严重程度) → 结果输出(标记完成)
                                   → 上下文输出(记录问题) → 结果输出

## 6. 常见问题

Q: Fork 只有 2 个分支？ → 当前固定2个，后续版本支持动态增减
Q: Agent 执行失败怎么办？ → 高级设置中改失败策略为"跳过"或"重试"
Q: 如何引用上游输出？ → 使用 {{ node_id.output.field }} 语法
Q: 连线连不上？ → 从输出端口（底部）拖向输入端口（顶部）
Q: 执行超时？ → 在 Agent/Code/Join 节点的配置中调整超时时间
```

**页面设计：**
- 左侧目录导航（固定定位），点击跳转到对应章节
- 右侧内容区域（可滚动），目录高亮当前所在章节
- 页面顶部标题 "Nexus 帮助中心"
- 用 Ant Design 的 Typography 组件渲染（Title, Paragraph, Table, Text）
- 表格用 Ant Design Table
- 代码/流程示例用等宽字体 blockquote 样式

### 2. 导航栏帮助入口

**文件：** `frontend/src/components/Layout/MainLayout.tsx`

在 `menuItems` 数组末尾（设置之后）添加：
```typescript
{
  key: '/help',
  icon: <QuestionCircleOutlined />,
  label: '帮助',
}
```

需要在文件顶部 import `QuestionCircleOutlined` from `@ant-design/icons`。

### 3. 工作流编辑器帮助按钮

**文件：** `frontend/src/components/workflow/EditorToolbar.tsx`

在"运行"按钮（PlayCircleOutlined 那个按钮，约第182行）之后添加一个帮助按钮：
```tsx
<Button size="small" type="text" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
  帮助
</Button>
```

添加一个 `helpOpen` state 和 Modal：
```tsx
const [helpOpen, setHelpOpen] = useState(false);
```

Modal 内容：与 HelpPage 共享同一个教程内容组件。创建一个共享组件 `WorkflowHelpContent.tsx`，HelpPage 和 EditorToolbar 的 Modal 都引用它。

**共享组件：** `frontend/src/components/workflow/WorkflowHelpContent.tsx`
- 导出一个 React 组件，包含全部教程内容
- HelpPage 引用它作为页面主体
- EditorToolbar 的 Modal 引用它作为 Modal 内容
- 样式：紧凑版（不需要左侧目录，适合弹窗阅读）

## 文件清单

| 操作 | 文件 |
|------|------|
| 新建 | `frontend/src/pages/HelpPage.tsx` |
| 新建 | `frontend/src/components/workflow/WorkflowHelpContent.tsx` |
| 修改 | `frontend/src/App.tsx` — 添加 /help 路由 |
| 修改 | `frontend/src/components/Layout/MainLayout.tsx` — 导航栏添加帮助 |
| 修改 | `frontend/src/components/workflow/EditorToolbar.tsx` — 添加帮助按钮+Modal |

## 约束

1. 使用 Ant Design 组件（Typography, Menu, Modal, Button 等）
2. 不引入新的第三方依赖（不用 markdown 渲染库，内容用 JSX 写）
3. HelpPage 需要有左侧目录导航，WorkflowHelpContent（弹窗版）不需要目录
4. 样式与现有 Nexus 风格一致（参考 SettingsPage 等现有页面）
5. 确保构建零 TypeScript 错误

## 验证

完成修改后，在项目根目录执行：
```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```
确认零错误。

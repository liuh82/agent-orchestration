# Phase 0 - 前端：Bug修复 + 浅色主题

## 任务目标

修复 7 个已知 Bug，统一前后台为浅色主题，升级 React Flow 依赖。

## 修改文件清单

```
frontend/src/components/common/StatusBadge.tsx
frontend/src/pages/agents/AgentDetailPage.tsx
frontend/src/pages/admin/AdminLayout.tsx
frontend/src/pages/admin/AdminDashboard.tsx
frontend/src/pages/admin/AdminStatsPage.tsx
frontend/package.json
```

## Bug 修复

### Bug 1: Agent 详情页"配置"Tab 黑色背景
- **文件：** `AgentDetailPage.tsx`，配置Tab区域
- **问题：** `ConfigJsonViewer` 和编辑模式 `Input.TextArea` 的背景色设为 `colors.neutral[950]`（纯黑）
- **修复：** 改为 `#fafafa`，文字颜色改为深色（`#1f2937`）

### Bug 2: Agent 详情页配置编辑区宽度不一致
- **文件：** `AgentDetailPage.tsx`，配置编辑和查看模式
- **问题：** 查看模式用 styled-component 固定宽度，编辑模式 `Input.TextArea` 默认 width:100%
- **修复：** 统一容器宽度，编辑模式和查看模式保持一致

### Bug 3: Agent 详情页字体偏小
- **文件：** `AgentDetailPage.tsx`
- **修复：** 配置区域的代码字体从 `12px` 调整为 `14px`，描述文字从 `13px` 调整为 `14px`

### Bug 4: 后台 content 区背景色透明
- **文件：** `AdminLayout.tsx`
- **问题：** content 区域 `background: rgba(0, 0, 0, 0)`（透明）
- **修复：** 改为 `background: #f5f5f5`

### Bug 5: 后台 Dashboard 统计卡片高度不一致
- **文件：** `AdminDashboard.tsx`
- **修复：** 给统计卡片容器设置统一 `min-height`，或使用 `flex` 布局 `align-items: stretch`

### Bug 6: stats API 路径不匹配
- **文件：** `AdminDashboard.tsx`（约L195）和 `AdminStatsPage.tsx`（约L197）
- **问题：** 前端写 `/v1/admin/stats/global`，后端实际挂载在 `/api/v1/stats/global`
- **修复：** 前端请求路径改为 `/api/v1/stats/global`

### Bug 7: 模板库 API 500 错误
- **问题：** `GET /api/workflows/templates` 返回 500
- **修复：** 检查后端 `routers/workflows.py` 的 templates 端点，确认数据库查询和序列化逻辑

## 浅色主题统一

### 前台 MainLayout
- **文件：** 查找 MainLayout 组件中的背景色定义
- **当前：** `rgb(10, 10, 10)` 纯黑
- **修改：** 背景色改为 `#f5f5f5` 或 `#ffffff`，侧边栏保持深色（`#1f2937`），文字改为深色

### 后台 AdminLayout
- **文件：** `AdminLayout.tsx`
- **Header：** 保持 `#334155`（已正确）
- **Content：** 改为 `#f5f5f5`
- **侧边栏：** 保持深色主题

## 依赖升级

```bash
npm uninstall react-flow-renderer
npm install @xyflow/react @xyflow/react-controls
```

更新所有 import 语句：
```typescript
// 旧
import ReactFlow from 'react-flow-renderer';
// 新
import { ReactFlow, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

## 约束

- 不修改业务逻辑，只做 UI 修复和主题调整
- 修改前先确认当前代码实际值（用 grep 确认颜色值和路径）
- 统一使用 CSS 变量管理颜色，避免硬编码散落各处
- Python 兼容 3.9（后端部分如有）：用 `Optional[str]` 不用 `str | None`

## 验收标准

- [ ] 后台管理页面浅色背景，无纯黑区域
- [ ] 前台页面浅色背景
- [ ] Agent 详情页配置Tab浅色背景、宽度一致、字体14px
- [ ] stats API 数据正常加载
- [ ] 模板库列表正常展示
- [ ] React Flow 升级成功，现有工作流页面无报错
- [ ] 后台统计卡片高度对齐

# 修复：AgentDetailPage 中 StatusBadge 导致白屏崩溃

## 问题描述
在后台代理中心点击 Agent 进入详情页后白屏。报错信息指向 `StatusBadge` 组件的 `styled.span` 崩溃。

堆栈关键信息：
```
The above error occurred in the <styled.span> component:
at StatusBadge (src/components/common/StatusBadge.tsx:94:31)
at AgentDetailPage (src/pages/agents/AgentDetailPage.tsx:202:17)
```

## 根因分析
1. `StatusBadge` 的 `statusColors` 只预定义了部分状态值（running/completed/failed/pending/cancelled/online/offline/error/busy/active/archived/draft）
2. `AgentDetailPage.tsx` L428 直接传 `agent.status` 给 `<StatusBadge status={agent.status} />`
3. 如果 API 返回的 status 值不在预定义列表中（或 agent 为 undefined 时 status 为 undefined），styled-components 会因 `$status` 匹配不到颜色定义而崩溃

## 修复方案

### 1. `frontend/src/components/common/StatusBadge.tsx`
- 为 `$status` 提供默认值 fallback：
  - 在 `StyledBadge` 的样式中，用 `statusColors[$status] ?? statusColors.offline` 替代直接访问 `statusColors[$status]`
  - 或者在组件层面做 fallback：`const safeStatus = status in statusColors ? status : 'offline'`
- 同步处理 `pulse` 动画条件的判断

### 2. `frontend/src/pages/agents/AgentDetailPage.tsx`
- L428: 确保传给 StatusBadge 的 status 有效
- 如果 agent 为 null/undefined（加载中），不要渲染 StatusBadge，用 Skeleton 代替

## 约束
- 不改变 UI 表现
- StatusBadge 对未知 status 值要 graceful 降级，不能崩溃

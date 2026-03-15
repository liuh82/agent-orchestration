# 修复：后台代理中心列表页点击跳转到前台的问题

## 问题描述
`AgentDetailPage` 的返回按钮已修复（commit 39dc4a7），但 `AgentListPage` 中所有跳转仍然硬编码为前台路径，导致：
1. 点击 Agent 卡片 → 跳转到 `/agents/:id`（前台）而非 `/admin/agents/:id`
2. 点击卡片上的"详情"按钮 → 同上
3. 点击表格行 → 同上
4. 右上角"创建代理"按钮 → 跳转到 `/agents/new`（前台）而非 `/admin/agents/new`
5. 空状态下的"创建代理"按钮 → 同上

## 修复方案

### 文件：`frontend/src/pages/agents/AgentListPage.tsx`

1. 在文件顶部 import 区添加 `useLocation`：
   ```tsx
   import { useNavigate, useLocation } from 'react-router-dom';
   ```

2. 在 `AgentListPage` 组件内（约 L266），根据 `location.pathname` 判断路径前缀：
   ```tsx
   const location = useLocation();
   const isAdmin = location.pathname.startsWith('/admin');
   const basePath = isAdmin ? '/admin/agents' : '/agents';
   ```

3. 替换所有硬编码路径：
   - `handleCardClick` (L313): `navigate('/agents/${agent.id}')` → `navigate('${basePath}/${agent.id}')`
   - "创建代理" 按钮 (L337): `navigate('/agents/new')` → `navigate('${basePath}/new')`
   - 空状态 "创建代理" 按钮 (L380): 同上
   - 表格行点击 (L401): `navigate('/agents/${record.id}')` → `navigate('${basePath}/${record.id}')`

4. 在 `AgentActions` 组件内（约 L167），同样需要判断路径：
   - 详情按钮 (L207): `navigate('/agents/${agent.id}')` → 需要用 `useLocation` 判断
   - 注意：`AgentActions` 是独立函数组件，也需要 `useLocation`

   建议方式：将 `basePath` 作为 prop 传给 `AgentActions`，或者在 `AgentActions` 内部也调用 `useLocation()`

## 约束
- 不改变页面 UI 和功能
- 前台和后台路径都能正常工作

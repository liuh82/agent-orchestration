# Nexus 前端 — 第 4 轮：Settings + Admin 页面 + 打磨

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/frontend/`
> **前置条件**: 第 1-3 轮已完成（基础设施 + 认证布局 + 核心页面）
> **完整文档参考**: `../docs/frontend-dev-prompt.md`

---

## 任务清单

### 1. API 模块补充

#### `src/api/settings.ts`
```typescript
export const settingsApi = {
  getAll: () => api.get('/admin/settings'),
  update: (settings: Record<string, any>) =>
    api.put('/admin/settings', { settings }),
};
```

#### `src/api/notifications.ts`
```typescript
export const notificationApi = {
  list: () => api.get('/notifications/channels'),
  create: (data: { channel_type: string; name: string; config: Record<string, any>; triggers?: any[] }) =>
    api.post('/notifications/channels', data),
  update: (id: string, data: any) => api.put(`/notifications/channels/${id}`, data),
  delete: (id: string) => api.delete(`/notifications/channels/${id}`),
  test: (id: string) => api.post(`/notifications/channels/${id}/test`),
  listGlobal: () => api.get('/admin/notifications/channels'),
};
```

### 2. 个人设置页 — `src/pages/settings/SettingsPage.tsx`

**Tab 布局**：
- **个人信息** — 头像、用户名、邮箱（只读）、修改
- **修改密码** — 旧密码 + 新密码 + 确认密码
- **通知偏好** — 通知方式开关（暂时只做 UI，后端 settings 支持后联动）

**个人信息表单**：
```
┌─────────────────────────────┐
│  [头像上传区域]              │
│  用户名: [__________]        │
│  邮箱:   user@email.com (只读)│
│  角色:   user                │
│          [保存修改]           │
└─────────────────────────────┘
```

### 3. 通知通道配置 — `src/pages/settings/NotificationPage.tsx`

**布局**：
- PageHeader: "通知通道" + [创建通道] 按钮
- 通道卡片列表

**通道卡片**：
```
┌─────────────────────────────────┐
│ 🔔 飞书通知          [启用中]    │
│ 类型: feishu                    │
│ Webhook: https://open.feishu... │
│ 触发条件: 任务完成, 任务失败     │
│                    [编辑] [测试] │
└─────────────────────────────────┘
```

**创建通道**（Modal 表单）：
- 通道类型选择（飞书/钉钉/企业微信/Slack/Discord/邮件）
- 名称
- 配置参数（根据类型动态渲染：webhook_url, secret, email 等）
- 触发条件多选

**测试发送**：点击后调用 test API，显示成功/失败 Toast

### 4. Admin Dashboard — `src/pages/admin/AdminDashboard.tsx`

**布局**：
- 6 个统计卡片（2 行 × 3 列）：
  1. 用户总数 / 活跃用户
  2. Agent 总数 / 在线
  3. 项目总数 / 活跃
  4. 任务总数 / 完成率
  5. Job 总数 / 完成率
  6. 总 Token 消耗 / 总费用
- 全局 Token 消耗趋势图（30 天）
- 全局费用趋势图（30 天）

### 5. 用户管理页 — `src/pages/admin/UserManagePage.tsx`

**布局**：
- PageHeader: "用户管理"
- Ant Design Table：
  - 列：头像、用户名、邮箱、角色（Tag）、配额（Agent/项目/任务）、状态（Tag）、创建时间、操作
  - 操作：修改角色（Dropdown）、修改配额（Modal）、启用/禁用（Switch）

**修改配额 Modal**：
- 3 个 InputNumber：max_agents, max_projects, max_tasks

### 6. Agent 类型配置页 — `src/pages/admin/AgentTypePage.tsx`

**布局**：
- PageHeader: "Agent 类型" + [新增类型] 按钮
- Ant Design Table：
  - 列：名称、显示名、协议、能力标签、预置模型、系统预置（Tag）、操作
  - 操作：编辑、删除（仅非系统预置）

**新增/编辑 Modal**：
- 名称、显示名、协议（Select）
- 能力标签（Tag Input）
- 预置模型（Tag Input）
- config_schema（JSON Editor，简单 textarea 即可）

### 7. 系统设置页 — `src/pages/admin/SystemSettingsPage.tsx`

**布局**：
- 按 Key-Value 对列表显示
- 每个设置：标签 + 输入框 + 描述
- 底部 [保存] 按钮

**预设设置项**：
- `gateway_ws_port` — Gateway WebSocket 端口（默认 8765）
- `gateway_heartbeat_interval` — 心跳间隔秒数（默认 30）
- `default_model` — 默认模型
- `max_concurrent_tasks` — 最大并发任务数
- `job_default_timeout` — Job 默认超时秒数（默认 300）

### 8. Admin 通知页 — `src/pages/admin/AdminNotificationPage.tsx`

同用户通知页，但显示全局通道（user_id=null），只有 Admin 可管理。

### 9. Admin 统计页 — `src/pages/admin/AdminStatsPage.tsx`

**布局**：
- Token 消耗图表（30 天趋势，Recharts）
- 费用图表（30 天趋势）
- Agent 使用排行（Top 10，横向 BarChart）
- 项目 Token 排行（Top 10）
- 用户活跃度（近 7 天登录次数）

### 10. 更新路由

Admin 路由：
```tsx
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<UserManagePage />} />
  <Route path="agent-types" element={<AgentTypePage />} />
  <Route path="settings" element={<SystemSettingsPage />} />
  <Route path="notifications" element={<AdminNotificationPage />} />
  <Route path="stats" element={<AdminStatsPage />} />
</Route>
```

Settings 路由（在 MainLayout 下）：
```tsx
<Route path="settings" element={<SettingsPage />} />
<Route path="settings/notifications" element={<NotificationPage />} />
```

### 11. 打磨

#### 页面过渡动画
- 路由切换时内容区域 fadeIn + slideUp (200ms)

#### 响应式
- 侧边栏在小屏下自动折叠
- 统计卡片在小屏下改为 2 列

#### Loading 骨架
- Dashboard 统计卡片用 Skeleton
- 表格用 Skeleton active

#### Empty 状态
- 所有列表页空数据时显示引导文案

#### 错误处理
- API 失败显示 ErrorBlock + 重试按钮
- 网络断开显示全局错误提示

---

## 输出要求

1. 所有 Admin 6 个页面功能完整
2. 个人设置页能修改用户名和密码
3. 通知通道 CRUD + 测试发送正常
4. Admin 统计图表数据展示正确
5. 所有页面有 Loading/Empty/Error 状态
6. 页面切换有过渡动画
7. 整体暗色主题一致，无样式遗漏

---

## ⚠️ 注意

- **Admin 页面必须验证 role == admin**，路由守卫 + API 双重检查
- **Recharts 图表**暗色主题：网格线 `rgba(255,255,255,0.04)`，文字 `#a3a3a3`
- **Table 暗色主题**：表头 `#1a1a0a`、行 hover `rgba(255,255,255,0.02)`
- **Modal 暗色主题**：背景 `#1a1a1a`、遮罩 `rgba(0,0,0,0.6)`
- 本轮是前端最后一轮，完成后前端第一轮迭代结束
- 完成后 `npm run build` 确保构建无错误

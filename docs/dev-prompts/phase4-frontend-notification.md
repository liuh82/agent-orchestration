# Phase 4 - 前端：通知配置动态表单

## 任务目标

实现通知通道配置页面，按通道类型动态渲染不同配置表单。

## 修改/新建文件清单

```
frontend/src/api/notifications.ts               # 通知API
frontend/src/pages/admin/AdminNotificationPage.tsx  # 重构
frontend/src/pages/settings/NotificationSettings.tsx # 新建（用户侧）
frontend/src/components/notification/ChannelList.tsx
frontend/src/components/notification/ChannelForm.tsx   # 动态表单
frontend/src/components/notification/TestSendButton.tsx
```

## ChannelForm 动态表单

核心逻辑：根据 `channel_type` 从 API 获取对应的配置 schema，动态渲染表单字段。

```typescript
// 获取通道配置 schema
const { data } = await apiClient.get('/notifications/channel-schemas');
// data = {
//   "feishu": { "type": "object", "properties": { "webhook_url": {...}, "secret": {...} }, "required": ["webhook_url"] },
//   "dingtalk": { ... },
//   ...
// }
```

**实现方式：** 不用 @rjsf（此场景较简单），直接用 Ant Design Form + 条件渲染：

```typescript
const channelFields: Record<string, FormField[]> = {
  feishu: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
    { name: 'secret', label: '签名密钥', type: 'password' },
  ],
  dingtalk: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
    { name: 'secret', label: '加签密钥', type: 'password' },
  ],
  wecom: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
  ],
  slack: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
    { name: 'channel', label: '频道名称', type: 'text' },
    { name: 'username', label: '机器人名称', type: 'text' },
  ],
  discord: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
    { name: 'username', label: '机器人名称', type: 'text' },
  ],
  email: [
    { name: 'smtp_host', label: 'SMTP 服务器', type: 'text', required: true },
    { name: 'smtp_port', label: '端口', type: 'number', default: 587 },
    { name: 'username', label: '账号', type: 'text', required: true },
    { name: 'password', label: '密码', type: 'password', required: true },
    { name: 'use_tls', label: '使用 TLS', type: 'switch', default: true },
    { name: 'from_email', label: '发件人', type: 'email', required: true },
  ],
};
```

## ChannelForm 组件

```typescript
interface ChannelFormProps {
  channelType: string;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

// 1. 根据 channelType 选择对应的字段定义
// 2. 渲染 Ant Design Form
// 3. 提交前验证必填项
// 4. 包含触发条件多选（Checkbox.Group）
// 5. 包含启用/禁用开关
```

## ChannelList 组件

- 表格展示所有通知通道
- 列：名称、类型（Badge）、状态（Switch）、触发条件、操作（编辑/测试/删除）
- 类型名统一：`wecom`（显示为"企业微信"）

## TestSendButton 组件

```typescript
interface TestSendButtonProps {
  channelId: string;
}
// 点击 → POST /api/v1/notifications/channels/{id}/test
// 成功 → message.success("发送成功")
// 失败 → message.error("发送失败: {error}")
```

## 触发条件配置

```typescript
const TRIGGER_OPTIONS = [
  { label: '任务完成', value: 'task.completed' },
  { label: '任务失败', value: 'task.failed' },
  { label: '任务超时', value: 'task.timeout' },
  { label: '任务开始', value: 'task.running' },
  { label: '人工干预待审批', value: 'human_intervention.pending' },
  { label: '人工干预已处理', value: 'human_intervention.resolved' },
];
```

## 约束

- 浅色主题
- 密码字段使用 Input.Password
- 类型名称映射：feishu→飞书, dingtalk→钉钉, wecom→企业微信, slack→Slack, discord→Discord, email→邮件

## 验收标准

- [ ] 通道列表正确展示
- [ ] 选择不同类型时表单字段动态变化
- [ ] 6 种通道配置表单字段完整
- [ ] 测试发送按钮可正常发送
- [ ] 触发条件可多选保存
- [ ] 启用/禁用开关正常工作

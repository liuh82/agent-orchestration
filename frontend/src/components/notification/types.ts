export interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  config: Record<string, unknown>;
  triggers: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormFieldSelectOption {
  label: string;
  value: string;
}

export interface FormField {
  name: string;
  label: string;
  type: 'url' | 'password' | 'text' | 'number' | 'switch' | 'email' | 'select' | 'tag';
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FormFieldSelectOption[];
}

export const CHANNEL_TYPE_OPTIONS = [
  { label: '飞书', value: 'feishu' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '企业微信', value: 'wecom' },
  { label: 'Slack', value: 'slack' },
  { label: 'Discord', value: 'discord' },
  { label: '邮件', value: 'email' },
  { label: 'Webhook（通用）', value: 'webhook' },
  { label: '站内通知', value: 'in_app' },
];

export const CHANNEL_TYPE_LABEL_MAP: Record<string, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  wecom: '企业微信',
  wechat_work: '企业微信',
  slack: 'Slack',
  discord: 'Discord',
  email: '邮件',
  webhook: 'Webhook',
  in_app: '站内通知',
};

export const CHANNEL_TYPE_TAG_COLOR_MAP: Record<string, string> = {
  feishu: '#3370ff',
  dingtalk: '#0089ff',
  wecom: '#07c160',
  wechat_work: '#07c160',
  slack: '#e01e5a',
  discord: '#5865f2',
  email: '#3b82f6',
  webhook: '#8b5cf6',
  in_app: '#6b7280',
};

/** 每种通道类型的动态表单字段定义 */
export const CHANNEL_FIELDS: Record<string, FormField[]> = {
  feishu: [
    { name: 'app_id', label: 'App ID', type: 'text', required: true, placeholder: '飞书应用 App ID' },
    { name: 'app_secret', label: 'App Secret', type: 'password', required: true, placeholder: '飞书应用 App Secret' },
    { name: 'group_webhook_url', label: '群聊 Webhook URL', type: 'url', placeholder: '可选，群机器人 Webhook 地址' },
    { name: 'msg_type', label: '消息类型', type: 'select', defaultValue: 'text', options: [
      { label: '文本消息', value: 'text' },
      { label: '卡片消息', value: 'card' },
    ] },
  ],
  dingtalk: [
    { name: 'app_key', label: 'App Key', type: 'text', required: true, placeholder: '钉钉应用 App Key' },
    { name: 'app_secret', label: 'App Secret', type: 'password', required: true, placeholder: '钉钉应用 App Secret' },
    { name: 'group_webhook', label: '群机器人 Webhook', type: 'url', placeholder: '可选，群机器人 Webhook 地址' },
    { name: 'msg_type', label: '消息类型', type: 'select', defaultValue: 'text', options: [
      { label: '文本消息', value: 'text' },
      { label: 'Markdown 消息', value: 'markdown' },
      { label: 'ActionCard 消息', value: 'actionCard' },
    ] },
  ],
  wecom: [
    { name: 'corp_id', label: 'Corp ID', type: 'text', required: true, placeholder: '企业微信 Corp ID' },
    { name: 'agent_id', label: 'Agent ID', type: 'text', required: true, placeholder: '企业微信 Agent ID' },
    { name: 'secret', label: 'Secret', type: 'password', required: true, placeholder: '企业微信应用 Secret' },
    { name: 'group_webhook', label: '群机器人 Webhook', type: 'url', placeholder: '可选，群机器人 Webhook 地址' },
  ],
  slack: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://hooks.slack.com/services/...' },
    { name: 'channel', label: '频道名称', type: 'text', placeholder: '可选，指定发送频道' },
    { name: 'username', label: '机器人名称', type: 'text', placeholder: '可选，自定义机器人名称' },
  ],
  discord: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
    { name: 'username', label: '机器人名称', type: 'text', placeholder: '可选，自定义机器人名称' },
  ],
  email: [
    { name: 'smtp_host', label: 'SMTP 服务器', type: 'text', required: true, placeholder: 'smtp.company.com' },
    { name: 'smtp_port', label: 'SMTP 端口', type: 'number', defaultValue: 465 },
    { name: 'from_email', label: '发件人邮箱', type: 'email', required: true, placeholder: 'noreply@company.com' },
    { name: 'password', label: '密码/授权码', type: 'password', required: true, placeholder: 'SMTP 授权码' },
    { name: 'ssl_tls', label: 'SSL/TLS', type: 'switch', defaultValue: true },
    { name: 'recipients', label: '收件人', type: 'tag', placeholder: '输入邮箱后按回车添加' },
  ],
  webhook: [
    { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://example.com/webhook' },
    { name: 'secret', label: 'Secret', type: 'password', placeholder: '可选，用于签名验证' },
    { name: 'method', label: 'Method', type: 'select', defaultValue: 'POST', options: [
      { label: 'POST', value: 'POST' },
      { label: 'GET', value: 'GET' },
    ] },
  ],
  in_app: [],
};

export const TRIGGER_OPTIONS = [
  { label: '任务完成', value: 'task.completed' },
  { label: '任务失败', value: 'task.failed' },
  { label: '任务超时', value: 'task.timeout' },
  { label: '任务开始', value: 'task.running' },
  { label: '人工干预待审批', value: 'human_intervention.pending' },
  { label: '人工干预已处理', value: 'human_intervention.resolved' },
];

export const ADMIN_TRIGGER_OPTIONS = [
  { label: '任务完成', value: 'task.completed' },
  { label: '任务失败', value: 'task.failed' },
  { label: '任务超时', value: 'task.timeout' },
  { label: '任务开始', value: 'task.running' },
  { label: '人工干预待审批', value: 'human_intervention.pending' },
  { label: '人工干预已处理', value: 'human_intervention.resolved' },
  { label: 'Agent 离线', value: 'agent_offline' },
  { label: '系统告警', value: 'system_alert' },
];

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

export interface FormField {
  name: string;
  label: string;
  type: 'url' | 'password' | 'text' | 'number' | 'switch' | 'email';
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
}

export const CHANNEL_TYPE_OPTIONS = [
  { label: '飞书', value: 'feishu' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '企业微信', value: 'wecom' },
  { label: 'Slack', value: 'slack' },
  { label: 'Discord', value: 'discord' },
  { label: '邮件', value: 'email' },
];

export const CHANNEL_TYPE_LABEL_MAP: Record<string, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  wecom: '企业微信',
  wechat_work: '企业微信',
  slack: 'Slack',
  discord: 'Discord',
  email: '邮件',
};

export const CHANNEL_TYPE_TAG_COLOR_MAP: Record<string, string> = {
  feishu: '#3370ff',
  dingtalk: '#0089ff',
  wecom: '#07c160',
  wechat_work: '#07c160',
  slack: '#e01e5a',
  discord: '#5865f2',
  email: '#3b82f6',
};

/** 每种通道类型的动态表单字段定义 */
export const CHANNEL_FIELDS: Record<string, FormField[]> = {
  feishu: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
    { name: 'secret', label: '签名密钥', type: 'password', placeholder: '可选，用于签名验证' },
  ],
  dingtalk: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
    { name: 'secret', label: '加签密钥', type: 'password', placeholder: '可选，用于加签验证' },
  ],
  wecom: [
    { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
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
    { name: 'smtp_port', label: '端口', type: 'number', defaultValue: 587 },
    { name: 'username', label: '账号', type: 'text', required: true, placeholder: '发件邮箱账号' },
    { name: 'password', label: '密码', type: 'password', required: true, placeholder: 'SMTP 授权码' },
    { name: 'use_tls', label: '使用 TLS', type: 'switch', defaultValue: true },
    { name: 'from_email', label: '发件人', type: 'email', required: true, placeholder: 'noreply@company.com' },
  ],
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

import { Form, Input, InputNumber, Select, Switch, Checkbox } from 'antd';
import { CHANNEL_TYPE_OPTIONS, CHANNEL_FIELDS, TRIGGER_OPTIONS, type NotificationChannel, type FormField } from './types';

interface ChannelFormProps {
  channelType: string;
  triggerOptions?: typeof TRIGGER_OPTIONS;
  disabled?: boolean;
}

/** 渲染单个动态字段 */
const renderField = (field: FormField) => {
  const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : [];

  switch (field.type) {
    case 'url':
      return (
        <Form.Item key={field.name} label={field.label} name={field.name} rules={rules}>
          <Input placeholder={field.placeholder} />
        </Form.Item>
      );
    case 'password':
      return (
        <Form.Item key={field.name} label={field.label} name={field.name}>
          <Input.Password placeholder={field.placeholder} />
        </Form.Item>
      );
    case 'text':
      return (
        <Form.Item key={field.name} label={field.label} name={field.name}>
          <Input placeholder={field.placeholder} />
        </Form.Item>
      );
    case 'email':
      return (
        <Form.Item
          key={field.name}
          label={field.label}
          name={field.name}
          rules={[
            ...rules,
            { type: 'email' as const, message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input placeholder={field.placeholder} />
        </Form.Item>
      );
    case 'number':
      return (
        <Form.Item key={field.name} label={field.label} name={field.name}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
      );
    case 'switch':
      return (
        <Form.Item
          key={field.name}
          label={field.label}
          name={field.name}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      );
    default:
      return null;
  }
};

/** 构建通道类型的默认值 */
export const buildDefaultValues = (
  channelType: string,
  existing?: NotificationChannel | null,
): Record<string, unknown> => {
  const fields = CHANNEL_FIELDS[channelType] ?? [];
  const defaults: Record<string, unknown> = {
    channel_type: channelType,
    name: existing?.name ?? '',
    triggers: existing?.triggers ?? ['task.completed'],
    is_active: existing?.is_active ?? true,
  };

  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
    } else if (existing?.config && field.name in existing.config) {
      defaults[field.name] = existing.config[field.name];
    } else {
      defaults[field.name] = undefined;
    }
  }

  return defaults;
};

/** 提取 config 字段（排除非 config 的字段） */
export const extractConfig = (values: Record<string, unknown>): Record<string, unknown> => {
  const configKeys = new Set<string>();
  for (const fields of Object.values(CHANNEL_FIELDS)) {
    for (const f of fields) {
      configKeys.add(f.name);
    }
  }

  const config: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    if (configKeys.has(key)) {
      config[key] = val;
    }
  }
  return config;
};

/** ChannelForm — 动态表单，根据 channelType 渲染不同字段 */
export const ChannelForm = ({
  channelType,
  triggerOptions = TRIGGER_OPTIONS,
  disabled = false,
}: ChannelFormProps) => {
  const fields = CHANNEL_FIELDS[channelType] ?? [];

  return (
    <>
      <Form.Item
        label="通道类型"
        name="channel_type"
        rules={[{ required: true, message: '请选择通道类型' }]}
      >
        <Select options={CHANNEL_TYPE_OPTIONS} disabled={disabled} placeholder="选择通知渠道" />
      </Form.Item>

      <Form.Item
        label="通道名称"
        name="name"
        rules={[{ required: true, message: '请输入通道名称' }]}
      >
        <Input placeholder="例如：团队飞书群" maxLength={50} />
      </Form.Item>

      {fields.map(renderField)}

      <Form.Item label="触发条件" name="triggers">
        <Checkbox.Group options={triggerOptions} />
      </Form.Item>

      <Form.Item label="启用状态" name="is_active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
};

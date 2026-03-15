import { useCallback, useMemo } from 'react';
import { Button, Form, InputNumber, Input, Skeleton, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { animation } from '@/styles/tokens/animation';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { settingsApi } from '@/api/settings';
import type { ApiResponse } from '@/types/api';

/* ── preset definitions ── */

interface SettingPreset {
  label: string;
  description: string;
  defaultValue: string | number;
  type: 'number' | 'text';
}

const SETTING_PRESETS: Record<string, SettingPreset> = {
  gateway_ws_port: {
    label: 'Gateway WebSocket 端口',
    description: 'Gateway 服务的 WebSocket 监听端口',
    defaultValue: 8765,
    type: 'number',
  },
  gateway_heartbeat_interval: {
    label: '心跳间隔秒数',
    description: 'Agent 与 Gateway 之间的心跳检测间隔（秒）',
    defaultValue: 30,
    type: 'number',
  },
  default_model: {
    label: '默认模型',
    description: '新建任务时默认使用的 AI 模型标识',
    defaultValue: 'gpt-4o',
    type: 'text',
  },
  max_concurrent_tasks: {
    label: '最大并发任务数',
    description: '系统允许同时执行的最大任务数量',
    defaultValue: 10,
    type: 'number',
  },
  job_default_timeout: {
    label: 'Job 默认超时秒数',
    description: '单个 Job 的默认超时时间（秒）',
    defaultValue: 300,
    type: 'number',
  },
};

/* ── styled components ── */

const SettingsCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  transition: border-color ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
  }
`;

const SettingRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[6]};
  padding: ${spacing[5]} 0;
  border-bottom: 1px solid ${colors.border.DEFAULT};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`;

const SettingLabel = styled.div`
  flex: 0 0 240px;
  min-width: 0;
`;

const SettingName = styled.div`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[1]};
`;

const SettingKey = styled.code`
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.muted};
  font-family: ${typography.fontFamily.mono};
  background: ${colors.surface.raised};
  padding: ${spacing[1]} ${spacing[2]};
  border-radius: ${radius.sm};
  display: inline-block;
  margin-top: ${spacing[1]};
`;

const SettingDesc = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  line-height: ${typography.lineHeight.relaxed};
  margin-top: ${spacing[1]};
`;

const SettingControl = styled.div`
  flex: 1;
  min-width: 200px;
`;

const FooterBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: ${spacing[5]};
  margin-top: ${spacing[5]};
  border-top: 1px solid ${colors.border.DEFAULT};
`;

const SkeletonCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

/* ── component ── */

export const SystemSettingsPage = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<Record<string, unknown>> | null, Error>(
    ['admin-settings'],
    () => settingsApi.getAll() as Promise<any>,
  );

  const savedSettings = response?.data ?? ({} as Record<string, unknown>);

  /** Build initial form values from API response merged with preset defaults */
  const initialValues = useMemo(() => {
    const values: Record<string, string | number> = {};
    for (const [key, preset] of Object.entries(SETTING_PRESETS)) {
      const saved = savedSettings[key];
      values[key] = saved != null
        ? (typeof saved === 'number' ? saved : String(saved))
        : preset.defaultValue;
    }
    return values;
  }, [savedSettings]);

  /** Save mutation */
  const saveMutation = useMutation(
    (values: Record<string, unknown>) => settingsApi.update(values) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('设置已保存');
        queryClient.invalidateQueries(['admin-settings']);
      },
      onError: () => {
        void message.error('保存失败，请重试');
      },
    },
  );

  const handleSave = useCallback(() => {
    form
      .validateFields()
      .then((values) => {
        void saveMutation.mutate(values);
      })
      .catch(() => {
        // validation errors are shown inline by antd
      });
  }, [form, saveMutation]);

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="系统设置" />
        <ErrorBlock
          message={error?.message || '加载系统设置失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader title="系统设置" />
        <SkeletonCard>
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        </SkeletonCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="系统设置" />

      <SettingsCard>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
        >
          {Object.entries(SETTING_PRESETS).map(([key, preset]) => (
            <SettingRow key={key}>
              <SettingLabel>
                <SettingName>{preset.label}</SettingName>
                <SettingKey>{key}</SettingKey>
                <SettingDesc>{preset.description}</SettingDesc>
              </SettingLabel>

              <SettingControl>
                <Form.Item
                  name={key}
                  noStyle
                  rules={[
                    {
                      required: true,
                      message: `请输入${preset.label}`,
                    },
                    ...(preset.type === 'number'
                      ? [
                          {
                            type: 'number' as const,
                            min: 1,
                            message: '请输入大于 0 的数值',
                          },
                        ]
                      : []),
                  ]}
                >
                  {preset.type === 'number' ? (
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      placeholder={String(preset.defaultValue)}
                    />
                  ) : (
                    <Input
                      placeholder={String(preset.defaultValue)}
                    />
                  )}
                </Form.Item>
              </SettingControl>
            </SettingRow>
          ))}
        </Form>

        <FooterBar>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isLoading}
            onClick={handleSave}
          >
            保存
          </Button>
        </FooterBar>
      </SettingsCard>
    </div>
  );
};

export default SystemSettingsPage;

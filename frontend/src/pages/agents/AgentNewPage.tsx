import { useState, useMemo } from 'react';
import {
  Button,
  Steps,
  Form,
  Input,
  Select,
  Skeleton,
  message,
  Result,
  Alert,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { animation } from '@/styles/tokens/animation';
import { agentApi } from '@/api/agents';
import { bridgeApi } from '@/api/bridges';
import { SchemaForm } from '@/components/common/SchemaForm';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { AgentType } from '@/types/agent';
import type { Bridge } from '@/types/bridge';
import type { ApiResponse } from '@/types/api';

/* ── styled components ── */

const ContentWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const StepsWrapper = styled.div`
  margin-bottom: ${spacing[8]};
`;

const TypeCardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${spacing[4]};
  margin-top: ${spacing[5]};
`;

const TypeCard = styled.div<{ $selected: boolean }>`
  background: ${({ $selected }) =>
    $selected ? 'rgba(99,102,241,0.08)' : colors.surface.DEFAULT};
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.primary[500] : colors.border.DEFAULT)};
  border-radius: ${radius.xl};
  padding: ${spacing[5]};
  cursor: pointer;
  transition: border-color ${animation.duration.normal} ${animation.easing.default},
              background ${animation.duration.normal} ${animation.easing.default},
              box-shadow ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${({ $selected }) =>
      $selected ? colors.primary[500] : colors.border.hover};
    box-shadow: ${({ $selected }) => ($selected ? shadow.glow : shadow.sm)};
  }
`;

const TypeIcon = styled.div`
  font-size: ${typography.fontSize['2xl']};
  margin-bottom: ${spacing[3]};
`;

const TypeName = styled.div`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[1]};
`;

const TypeDesc = styled.div`
  font-size: 14px;
  color: ${colors.text.secondary};
  line-height: ${typography.lineHeight.normal};
`;

const TypeCode = styled.div`
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.muted};
  margin-top: ${spacing[2]};
  font-family: ${typography.fontFamily.mono};
`;

const FormWrapper = styled.div`
  max-width: 500px;
`;

const ConfirmCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const ConfirmItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${spacing[3]};
  padding: ${spacing[3]} 0;
  border-bottom: 1px solid ${colors.border.DEFAULT};

  &:last-child {
    border-bottom: none;
  }
`;

const ConfirmLabel = styled.span`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
  min-width: 80px;
  flex-shrink: 0;
`;

const ConfirmValue = styled.span`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.primary};
  word-break: break-all;
`;

const StepContent = styled.div`
  min-height: 300px;
`;

const CapabilitiesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[2]};
  margin-top: ${spacing[2]};
`;

const CapabilityTag = styled.span`
  display: inline-block;
  padding: 2px ${spacing[2]};
  border-radius: ${radius.sm};
  font-size: ${typography.fontSize.xs};
  background: rgba(99,102,241,0.12);
  color: ${colors.text.brand};
`;

const SchemaFormWrapper = styled.div`
  margin-top: ${spacing[5]};
  padding: ${spacing[5]};
  background: ${colors.surface.raised};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
`;

/* ── form data interface ── */

interface AgentFormData {
  type_id: string;
  name: string;
  bridge_id?: string;
  model?: string;
  timeout?: number;
  max_retries?: number;
  schema_config?: Record<string, unknown>;
}

const initialFormData: AgentFormData = {
  type_id: '',
  name: '',
  bridge_id: '',
  model: '',
  timeout: 300,
  max_retries: 1,
  schema_config: undefined,
};

/* ── component ── */

export const AgentNewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [form] = Form.useForm();

  // Fetch agent types
  const {
    data: typesResponse,
    isLoading: typesLoading,
    isError: typesError,
    error: typesErrorObj,
    refetch: refetchTypes,
  } = useQuery<ApiResponse<AgentType[]>, Error>(
    ['agent-types'],
    agentApi.getTypes,
  );

  // Fetch bridges
  const {
    data: bridgesResponse,
    isLoading: bridgesLoading,
  } = useQuery(
    ['bridges-list'],
    bridgeApi.list,
  );

  const createMutation = useMutation(
    (data: AgentFormData) =>
      agentApi.create({
        type_id: data.type_id,
        name: data.name,
        model: data.model,
        config: {
          bridge_id: data.bridge_id,
          timeout: data.timeout,
          max_retries: data.max_retries,
          ...data.schema_config,
        },
      }),
    {
      onSuccess: (response: any) => {
        void message.success('代理创建成功');
        const agentId = response?.data?.id;
        if (agentId) {
          navigate(isAdmin ? `/admin/agents/${agentId}` : `/agents/${agentId}`);
        } else {
          navigate(isAdmin ? '/admin/agents' : '/agents');
        }
      },
      onError: () => {
        void message.error('创建失败，请重试');
      },
    },
  );

  const agentTypes = useMemo(() => {
    const raw = typesResponse?.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ('items' in raw && Array.isArray((raw as { items: AgentType[] }).items)) {
      return (raw as { items: AgentType[] }).items;
    }
    return [];
  }, [typesResponse?.data]);

  const bridges: Bridge[] = useMemo(() => {
    const raw = bridgesResponse?.data;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [];
  }, [bridgesResponse?.data]);

  const selectedType = useMemo(
    () => agentTypes.find((t) => t.id === formData.type_id),
    [agentTypes, formData.type_id],
  );

  const configSchema = useMemo(() => {
    if (!selectedType) return null;
    const schema = (selectedType as any).config_schema;
    return schema && Object.keys(schema).length > 0 ? schema : null;
  }, [selectedType]);

  const handleSelectType = (type: AgentType) => {
    setFormData((prev) => ({ ...prev, type_id: type.id }));
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        const values = await form.validateFields();
        setFormData((prev) => ({
          ...prev,
          name: values.name,
          bridge_id: values.bridge_id || undefined,
          model: values.model || undefined,
          timeout: values.timeout,
          max_retries: values.max_retries,
        }));
        setCurrentStep(2);
      } catch {
        // form validation failed
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 2));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const canNext = currentStep === 0 ? !!formData.type_id : true;

  const steps = [
    { title: '选择类型', icon: <span>1</span> },
    { title: '配置', icon: <span>2</span> },
    { title: '确认创建', icon: <span>3</span> },
  ];

  const backPath = isAdmin ? '/admin/agents' : '/agents';

  return (
    <div>
      <PageHeader
        title="创建代理"
        actions={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
            返回
          </Button>
        }
      />

      <ContentWrapper>
        <StepsWrapper>
          <Steps current={currentStep} items={steps} />
        </StepsWrapper>

        {/* ── error state ── */}
        {typesError && (
          <ErrorBlock message={typesErrorObj?.message || '加载代理类型失败'} onRetry={() => refetchTypes()} />
        )}

        {/* ── Step 0: Select type ── */}
        {currentStep === 0 && (
          <StepContent>
            {typesLoading ? (
              <TypeCardGrid>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    active
                    paragraph={{ rows: 3 }}
                    title={{ width: '60%' }}
                    style={{
                      background: colors.surface.DEFAULT,
                      border: `1px solid ${colors.border.DEFAULT}`,
                      borderRadius: radius.xl,
                      padding: spacing[5],
                    }}
                  />
                ))}
              </TypeCardGrid>
            ) : agentTypes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: spacing[12], color: colors.text.muted }}>
                暂无可用的代理类型
              </div>
            ) : (
              <TypeCardGrid>
                {agentTypes.map((type) => (
                  <TypeCard key={type.id} $selected={formData.type_id === type.id} onClick={() => handleSelectType(type)}>
                    <TypeIcon>{type.icon || '🤖'}</TypeIcon>
                    <TypeName>{type.display_name || type.name}</TypeName>
                    <TypeDesc>{type.description}</TypeDesc>
                    <TypeCode>{type.code}</TypeCode>
                    {type.capabilities.length > 0 && (
                      <CapabilitiesList>
                        {type.capabilities.map((cap) => (
                          <CapabilityTag key={cap}>{cap}</CapabilityTag>
                        ))}
                      </CapabilitiesList>
                    )}
                  </TypeCard>
                ))}
              </TypeCardGrid>
            )}
          </StepContent>
        )}

        {/* ── Step 1: Configure ── */}
        {currentStep === 1 && (
          <StepContent>
            <FormWrapper>
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  name: formData.name,
                  bridge_id: formData.bridge_id,
                  model: formData.model || '',
                  timeout: formData.timeout,
                  max_retries: formData.max_retries,
                }}
              >
                <Form.Item
                  label="代理名称"
                  name="name"
                  rules={[
                    { required: true, message: '请输入代理名称' },
                    { max: 50, message: '名称不超过 50 个字符' },
                  ]}
                >
                  <Input placeholder="例如: CC Agent 1" />
                </Form.Item>

                <Form.Item
                  label="Bridge 连接"
                  name="bridge_id"
                >
                  <Select
                    placeholder="选择 Bridge 连接"
                    loading={bridgesLoading}
                    allowClear
                    notFoundContent={
                      bridges.length === 0 ? (
                        <span style={{ color: colors.text.error }}>请先在设置中添加 Bridge 连接</span>
                      ) : undefined
                    }
                  >
                    {bridges.filter((b) => b.status === 'online').map((b) => (
                      <Select.Option key={b.bridge_id} value={b.bridge_id}>
                        {b.hostname || b.bridge_id} ({b.platform})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="预期模型" name="model">
                  <Input placeholder="例如: gpt-4o（可选）" />
                </Form.Item>

                <Form.Item
                  label="超时时间（秒）"
                  name="timeout"
                  rules={[{ required: true, message: '请输入超时时间' }]}
                >
                  <Input type="number" placeholder="300" />
                </Form.Item>

                <Form.Item
                  label="最大重试次数"
                  name="max_retries"
                  rules={[{ required: true, message: '请输入最大重试次数' }]}
                >
                  <Input type="number" placeholder="1" />
                </Form.Item>
              </Form>

              {/* Dynamic schema form */}
              {configSchema && (
                <SchemaFormWrapper>
                  <div style={{ fontSize: 14, fontWeight: typography.fontWeight.medium, color: colors.text.primary, marginBottom: spacing[3] }}>
                    类型配置（{(selectedType?.display_name || selectedType?.name)}
                  </div>
                  <SchemaForm
                    schema={configSchema}
                    formData={formData.schema_config}
                    onChange={(data) => setFormData((prev) => ({ ...prev, schema_config: data }))}
                  />
                </SchemaFormWrapper>
              )}

              {bridges.length === 0 && (
                <Alert
                  type="warning"
                  message="暂无可用 Bridge"
                  description="请先在设置 → Bridge 管理中添加 Bridge 连接，否则代理无法接收任务。"
                  showIcon
                  style={{ marginTop: spacing[4] }}
                />
              )}
            </FormWrapper>
          </StepContent>
        )}

        {/* ── Step 2: Confirm ── */}
        {currentStep === 2 && (
          <StepContent>
            {createMutation.isError ? (
              <Result status="error" title="创建失败" subTitle="请检查配置后重试" extra={<Button onClick={handlePrev}>返回修改</Button>} />
            ) : (
              <ConfirmCard>
                <h3 style={{ color: colors.text.primary, marginBottom: spacing[5], marginTop: 0 }}>
                  确认配置
                </h3>
                <ConfirmItem>
                  <ConfirmLabel>代理类型</ConfirmLabel>
                  <ConfirmValue>{selectedType?.name || '-'}</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>代理名称</ConfirmLabel>
                  <ConfirmValue>{formData.name}</ConfirmValue>
                </ConfirmItem>
                {formData.bridge_id && (
                  <ConfirmItem>
                    <ConfirmLabel>Bridge</ConfirmLabel>
                    <ConfirmValue>{formData.bridge_id}</ConfirmValue>
                  </ConfirmItem>
                )}
                {formData.model && (
                  <ConfirmItem>
                    <ConfirmLabel>模型</ConfirmLabel>
                    <ConfirmValue>{formData.model}</ConfirmValue>
                  </ConfirmItem>
                )}
                <ConfirmItem>
                  <ConfirmLabel>超时时间</ConfirmLabel>
                  <ConfirmValue>{formData.timeout}s</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>最大重试</ConfirmLabel>
                  <ConfirmValue>{formData.max_retries} 次</ConfirmValue>
                </ConfirmItem>
              </ConfirmCard>
            )}
          </StepContent>
        )}

        {/* ── navigation buttons ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[8] }}>
          {currentStep > 0 && <Button onClick={handlePrev}>上一步</Button>}
          {currentStep < 2 && (
            <Button type="primary" onClick={handleNext} disabled={!canNext}>下一步</Button>
          )}
          {currentStep === 2 && (
            <Button type="primary" icon={<CheckOutlined />} loading={createMutation.isLoading} onClick={handleCreate}>
              创建代理
            </Button>
          )}
        </div>
      </ContentWrapper>
    </div>
  );
};

export default AgentNewPage;

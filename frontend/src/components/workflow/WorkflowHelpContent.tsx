import React from 'react';
import { Typography, Table, Tag } from 'antd';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';

const { Title, Paragraph, Text } = Typography;

const ContentWrapper = styled.div`
  .ant-typography h1,
  .ant-typography h2 {
    color: ${colors.text.primary};
  }

  h2 {
    font-size: 18px !important;
    margin-top: ${spacing[6]} !important;
    margin-bottom: ${spacing[3]} !important;
    padding-bottom: ${spacing[2]};
    border-bottom: 1px solid ${colors.border.DEFAULT};
  }

  h3 {
    font-size: 15px !important;
    margin-top: ${spacing[4]} !important;
    margin-bottom: ${spacing[2]} !important;
    color: ${colors.text.secondary};
  }

  p {
    margin-bottom: ${spacing[3]} !important;
    line-height: 1.7;
  }
`;

const FlowBlock = styled.blockquote`
  background: ${colors.surface.overlay};
  border-left: 3px solid ${colors.primary[500]};
  border-radius: ${radius.md};
  padding: ${spacing[3]} ${spacing[4]};
  margin: ${spacing[3]} 0;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.8;
  color: ${colors.text.secondary};
  white-space: pre-line;
`;

const NodeGroup = styled.div`
  margin-bottom: ${spacing[3]};
`;

const NodeGroupTitle = styled(Text)`
  font-weight: 600;
  font-size: 13px;
  color: ${colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${spacing[1]};
  display: block;
`;

const NodeList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NodeItem = styled.li`
  padding: 4px 0;
  font-size: 14px;
  line-height: 1.6;

  strong {
    color: ${colors.text.primary};
    margin-right: 4px;
  }
`;

const basicOperationColumns = [
  { title: '操作', dataIndex: 'action', key: 'action', width: 100 },
  { title: '方式', dataIndex: 'method', key: 'method' },
];

const basicOperationData = [
  { key: '1', action: '添加节点', method: '从左侧面板拖拽到画布' },
  { key: '2', action: '连线', method: '从节点底部圆点拖到另一个节点顶部圆点' },
  { key: '3', action: '配置节点', method: '点击节点 → 右侧面板编辑' },
  { key: '4', action: '删除节点', method: '选中节点 → 按 Delete 键或点击面板中的删除按钮' },
  { key: '5', action: '删除连线', method: '选中连线 → Delete 键' },
  { key: '6', action: '保存', method: '点击右上角「保存」按钮' },
  { key: '7', action: '运行', method: '点击右上角「运行」按钮' },
];

export const WorkflowHelpContent: React.FC = () => (
  <ContentWrapper>
    <Title level={2}>1. 快速开始</Title>

    <Title level={4}>创建工作流</Title>
    <Paragraph>
      1. 进入「工作流」菜单<br />
      2. 点击「新建工作流」<br />
      3. 输入名称（如"代码审查流程"）<br />
      4. 进入编辑器画布
    </Paragraph>

    <Title level={4}>基本操作</Title>
    <Table
      columns={basicOperationColumns}
      dataSource={basicOperationData}
      pagination={false}
      size="small"
      bordered
    />

    <Title level={2}>2. 节点类型总览</Title>

    <NodeGroup>
      <NodeGroupTitle>触发器（工作流起点，无输入端口）</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>手动触发：</strong>手动点击启动，无需配置</NodeItem>
        <NodeItem><strong>定时触发：</strong>Cron 表达式定时执行</NodeItem>
        <NodeItem><strong>Webhook触发：</strong>接收外部 HTTP 请求</NodeItem>
        <NodeItem><strong>输入：</strong>从项目/任务提取上下文</NodeItem>
      </NodeList>
    </NodeGroup>

    <NodeGroup>
      <NodeGroupTitle>逻辑控制</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>IF：</strong>条件分支，输出 true/false</NodeItem>
        <NodeItem><strong>Switch：</strong>多条件路由，输出 case_0/case_1/.../default</NodeItem>
        <NodeItem><strong>Loop：</strong>循环执行，输出 body/done</NodeItem>
        <NodeItem><strong>Wait：</strong>等待/延迟</NodeItem>
        <NodeItem><strong>Fork：</strong>并行分发，输出 branch_0/branch_1（最多2个）</NodeItem>
        <NodeItem><strong>Join：</strong>并行汇合，等待所有上游分支完成后合并</NodeItem>
      </NodeList>
    </NodeGroup>

    <NodeGroup>
      <NodeGroupTitle>Agent</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>Agent：</strong>调用 AI Agent 执行任务</NodeItem>
      </NodeList>
    </NodeGroup>

    <NodeGroup>
      <NodeGroupTitle>工作流</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>子工作流：</strong>嵌套调用另一个工作流</NodeItem>
      </NodeList>
    </NodeGroup>

    <NodeGroup>
      <NodeGroupTitle>数据</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>HTTP请求：</strong>调用外部 API</NodeItem>
        <NodeItem><strong>Code：</strong>执行 Python/JavaScript 代码</NodeItem>
        <NodeItem><strong>Transform：</strong>数据格式转换</NodeItem>
      </NodeList>
    </NodeGroup>

    <NodeGroup>
      <NodeGroupTitle>输出（工作流终点）</NodeGroupTitle>
      <NodeList>
        <NodeItem><strong>输出：</strong>格式化并输出最终结果</NodeItem>
        <NodeItem><strong>上下文输出：</strong>写回任务的上下文字段（摘要、备注等）</NodeItem>
        <NodeItem><strong>结果输出：</strong>标记工作流完成，更新任务状态</NodeItem>
      </NodeList>
    </NodeGroup>

    <Title level={2}>3. 连线规则</Title>
    <Paragraph>
      连线会根据源节点类型自动设置样式：
    </Paragraph>
    <NodeList>
      <NodeItem><Tag color="success">IF/Switch</Tag> → 绿色/红色虚线（条件分支）</NodeItem>
      <NodeItem><Tag color="processing">Fork/Join</Tag> → 蓝色实线（并行分支）</NodeItem>
      <NodeItem><Tag color="default">其他</Tag> → 灰色实线（普通流转）</NodeItem>
    </NodeList>
    <Paragraph>
      <Text strong>规则：</Text><br />
      - 同一个输出端口可以连多个目标节点<br />
      - 多个输出端口可以连同一个目标节点（如 Join）<br />
      - 不能自连或形成循环（Loop 除外）
    </Paragraph>

    <Title level={2}>4. 核心节点配置</Title>

    <Title level={4}>Agent 节点</Title>
    <Paragraph>
      基础配置：模型、Prompt、温度、最大Token<br />
      高级设置：超时时间、失败策略（停止/跳过/重试/回退值）、输出过滤、缓存
    </Paragraph>

    <Title level={4}>Fork 节点</Title>
    <Paragraph>
      - 分发模式：广播（所有分支收到相同数据）/ 分发（每个分支收到不同数据）<br />
      - 分支数量：当前支持 2 个分支
    </Paragraph>

    <Title level={4}>Join 节点</Title>
    <Paragraph>
      - 等待模式：等待全部 / 任意一个<br />
      - 合并策略：追加（保留独立结果+merged数组）/ 合并（深度合并）
    </Paragraph>

    <Title level={4}>Input 节点</Title>
    <Paragraph>
      - 数据来源：项目/任务/手动/上游<br />
      - 提取字段：按需选择<br />
      - 组装模板：用 {'{{ field }}'} 引用字段
    </Paragraph>

    <Title level={4}>Code 节点</Title>
    <Paragraph>
      - 语言：Python / JavaScript<br />
      - 可用变量：upstream、input<br />
      - 输出：print() 的 JSON 会被解析为节点输出
    </Paragraph>

    <Title level={4}>上下文输出 / 结果输出</Title>
    <Paragraph>
      上下文输出：将中间结果写回任务（summary/notes/tags），支持追加/覆盖<br />
      结果输出：输出格式（JSON/Markdown/纯文本），完成后动作（标记完成/标记完成并通知）
    </Paragraph>

    <Title level={2}>5. 示例工作流</Title>

    <Title level={4}>简单 Agent 工作流</Title>
    <FlowBlock>{`手动触发 → Agent → 输出`}</FlowBlock>

    <Title level={4}>条件分支</Title>
    <FlowBlock>{`手动触发 → Agent(分类) → IF → Agent(正面回复) → 输出
                          → Agent(负面回复) → 输出`}</FlowBlock>

    <Title level={4}>并行执行</Title>
    <FlowBlock>{`手动触发 → Fork → Agent(A:前端审查) ─┐
                    Agent(B:后端审查) ─┤→ Join → 输出`}</FlowBlock>

    <Title level={4}>完整审查流程</Title>
    <FlowBlock>{`输入(项目数据) → Agent(审查) → IF(严重程度) → 结果输出(标记完成)
                                  → 上下文输出(记录问题) → 结果输出`}</FlowBlock>

    <Title level={2}>6. 常见问题</Title>
    <Paragraph>
      <Text strong>Q: Fork 只有 2 个分支？</Text><br />
      A: 当前固定2个，后续版本支持动态增减
    </Paragraph>
    <Paragraph>
      <Text strong>Q: Agent 执行失败怎么办？</Text><br />
      A: 高级设置中改失败策略为"跳过"或"重试"
    </Paragraph>
    <Paragraph>
      <Text strong>Q: 如何引用上游输出？</Text><br />
      A: 使用 {'{{ node_id.output.field }}'} 语法
    </Paragraph>
    <Paragraph>
      <Text strong>Q: 连线连不上？</Text><br />
      A: 从输出端口（底部）拖向输入端口（顶部）
    </Paragraph>
    <Paragraph>
      <Text strong>Q: 执行超时？</Text><br />
      A: 在 Agent/Code/Join 节点的配置中调整超时时间
    </Paragraph>
  </ContentWrapper>
);

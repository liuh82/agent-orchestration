import styled from 'styled-components';
import { Tooltip } from 'antd';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { GatewayBridge } from '@/api/gateway';

const BridgeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  max-height: 200px;
  overflow-y: auto;
`;

const BridgeItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  padding: ${spacing[2]} ${spacing[3]};
  background: ${colors.neutral[50]};
  border-radius: 6px;
  border: 1px solid ${colors.border.DEFAULT};
  transition: border-color 0.15s;

  &:hover {
    border-color: ${colors.border.hover};
  }
`;

const BridgeInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const BridgeName = styled.div`
  font-size: 13px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BridgeMeta = styled.div`
  font-size: 12px;
  color: ${colors.text.secondary};
  margin-top: 2px;
`;

const TaskBadge = styled.span<{ $color: string; $bg: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: ${typography.fontWeight.medium};
  color: ${({ $color }) => $color};
  background: ${({ $bg }) => $bg};
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
`;

const SummaryRow = styled.div`
  display: flex;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[3]};
`;

const SummaryItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[1]};
`;

const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const SummaryLabel = styled.span`
  font-size: 12px;
  color: ${colors.text.secondary};
`;

const SummaryCount = styled.span`
  font-size: 13px;
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const platformIcon = (platform: string) => {
  if (platform.includes('darwin') || platform.includes('mac')) return '🍎';
  if (platform.includes('linux')) return '🐧';
  if (platform.includes('win')) return '🪟';
  return '💻';
};

const formatLastSeen = (ts: number) => {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}m 前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h 前`;
  return `${Math.floor(diff / 86400)}d 前`;
};

export const BridgeStatusCard = ({ data }: { data: GatewayBridge[] }) => {
  const bridges = data ?? [];

  const online = bridges.filter((b) => b.status === 'online');
  const totalActive = online.reduce((s, b) => s + b.active_tasks, 0);
  const totalCapacity = online.reduce((s, b) => s + b.max_concurrent, 0);

  if (bridges.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: spacing[6], color: colors.text.secondary, fontSize: 13 }}>
        暂无 Bridge 连接
      </div>
    );
  }

  return (
    <div>
      <SummaryRow>
        <SummaryItem>
          <Dot $color={colors.success[500]} />
          <SummaryLabel>在线</SummaryLabel>
          <SummaryCount>{online.length}</SummaryCount>
        </SummaryItem>
        <SummaryItem>
          <Dot $color={colors.neutral[400]} />
          <SummaryLabel>离线</SummaryLabel>
          <SummaryCount>{bridges.length - online.length}</SummaryCount>
        </SummaryItem>
        <SummaryItem>
          <SummaryLabel>任务</SummaryLabel>
          <SummaryCount>{totalActive}/{totalCapacity}</SummaryCount>
        </SummaryItem>
      </SummaryRow>

      <BridgeList>
        {bridges.map((b) => (
          <Tooltip
            key={b.bridge_id}
            title={`${b.hostname} · ${b.platform} · ${b.available_adapters.map((a) => a.type).join(', ') || '无适配器'}`}
          >
            <BridgeItem>
              <span style={{ fontSize: 16, lineHeight: 1 }}>{platformIcon(b.platform)}</span>
              <BridgeInfo>
                <BridgeName>{b.hostname}</BridgeName>
                <BridgeMeta>
                  {b.platform} · {formatLastSeen(b.last_seen)}
                </BridgeMeta>
              </BridgeInfo>
              <StatusBadge status={b.status} />
              {b.active_tasks > 0 && (
                <TaskBadge $color={colors.primary[500]} $bg={colors.primary[50]}>
                  {b.active_tasks} 运行中
                </TaskBadge>
              )}
            </BridgeItem>
          </Tooltip>
        ))}
      </BridgeList>
    </div>
  );
};

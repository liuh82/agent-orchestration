import { useState } from 'react';
import styled from 'styled-components';
import { Segmented } from 'antd';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { GatewayTask } from '@/api/gateway';

const FilterBar = styled.div`
  margin-bottom: ${spacing[3]};
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  max-height: 220px;
  overflow-y: auto;
`;

const TimelineItem = styled.div`
  display: flex;
  align-items: flex-start;
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

const TimeCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 52px;
  flex-shrink: 0;
`;

const TimeValue = styled.span`
  font-size: 12px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
  font-variant-numeric: tabular-nums;
`;

const TimeLabel = styled.span`
  font-size: 11px;
  color: ${colors.text.muted};
`;

const ContentCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const PromptText = styled.div`
  font-size: 13px;
  color: ${colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  margin-top: 4px;
`;

const AgentTag = styled.span`
  font-size: 11px;
  color: ${colors.primary[600]};
  background: ${colors.primary[50]};
  padding: 1px 6px;
  border-radius: 4px;
`;

const CostTag = styled.span`
  font-size: 11px;
  color: ${colors.text.secondary};
`;

const DurationTag = styled.span`
  font-size: 11px;
  color: ${colors.text.muted};
`;

const RightCol = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const formatDuration = (seconds?: number) => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

const formatCost = (usd?: number) => {
  if (!usd || usd === 0) return '';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
};

const formatTime = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + '…' : s;

type FilterKey = 'all' | 'running' | 'completed' | 'failed';

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '运行中', value: 'running' },
  { label: '完成', value: 'completed' },
  { label: '失败', value: 'failed' },
];

export const TaskTimelineCard = ({ data }: { data: GatewayTask[] }) => {
  const tasks = data ?? [];
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter);

  const sorted = [...filtered].sort((a, b) => b.submitted_at - a.submitted_at);

  if (sorted.length === 0) {
    return (
      <div>
        <FilterBar>
          <Segmented
            size="small"
            options={filterOptions}
            value={filter}
            onChange={(v) => setFilter(v as FilterKey)}
          />
        </FilterBar>
        <div style={{ textAlign: 'center', padding: spacing[6], color: colors.text.secondary, fontSize: 13 }}>
          暂无任务记录
        </div>
      </div>
    );
  }

  return (
    <div>
      <FilterBar>
        <Segmented
          size="small"
          options={filterOptions}
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
        />
      </FilterBar>

      <Timeline>
        {sorted.slice(0, 20).map((t) => (
          <TimelineItem key={t.task_id}>
            <TimeCol>
              <TimeValue>{formatTime(t.started_at || t.submitted_at)}</TimeValue>
              <TimeLabel>{formatDuration(t.duration)}</TimeLabel>
            </TimeCol>

            <ContentCol>
              <PromptText title={t.prompt}>{truncate(t.prompt, 60)}</PromptText>
              <MetaRow>
                <AgentTag>{t.agent_type}</AgentTag>
                {t.cost_usd > 0 && <CostTag>{formatCost(t.cost_usd)}</CostTag>}
                {t.changed_files && t.changed_files.length > 0 && (
                  <DurationTag>{t.changed_files.length} files</DurationTag>
                )}
              </MetaRow>
            </ContentCol>

            <RightCol>
              <StatusBadge status={t.status} />
            </RightCol>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
};

import { useState } from 'react';
import { Button, Modal, Input, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import type { LayoutItem } from 'react-grid-layout';
import { dashboardApi } from '@/api/dashboard';
import { useDashboardStore } from '@/stores/useDashboardStore';
import type { DashboardLayoutDef } from '@/stores/useDashboardStore';

const Wrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  margin-bottom: ${spacing[4]};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing[3]};
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const LayoutItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: ${spacing[2]} ${spacing[3]};
  border-radius: ${radius.md};
  margin-bottom: ${spacing[1]};
  cursor: pointer;
  background: ${({ $active }) => $active ? colors.primary[50] : 'transparent'};
  border: 1px solid ${({ $active }) => $active ? colors.primary[200] : 'transparent'};

  &:hover {
    background: ${colors.surface.raised};
  }
`;

const LayoutName = styled.span`
  font-size: 13px;
  color: ${colors.text.primary};
  flex: 1;
`;

const DefaultTag = styled.span`
  font-size: 11px;
  color: ${colors.primary[500]};
  background: ${colors.primary[50]};
  padding: 0 ${spacing[2]};
  border-radius: ${radius.sm};
`;

interface LayoutManagerProps {
  scope: string;
}

export const LayoutManager = ({ scope }: LayoutManagerProps) => {
  const { layoutDefs, activeLayoutId, setLayoutDefs, setActiveLayoutId, layouts, cards } = useDashboardStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveLayout = async () => {
    if (!layoutName.trim()) {
      void message.warning('请输入方案名称');
      return;
    }
    setSaving(true);
    try {
      await dashboardApi.saveLayout({
        scope,
        name: layoutName.trim(),
        is_default: false,
        layout: { cards, layouts },
      });
      void message.success('布局方案已保存');
      setModalOpen(false);
      setLayoutName('');
    } catch {
      void message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLayout = (def: DashboardLayoutDef) => {
    setActiveLayoutId(def.id);
    if (def.layout) {
      if (def.layout.cards) {
        useDashboardStore.getState().setCards(def.layout.cards);
      }
      if (def.layout.layouts) {
        useDashboardStore.getState().setLayouts(def.layout.layouts);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dashboardApi.deleteLayout(id);
      void message.success('方案已删除');
      setLayoutDefs(layoutDefs.filter((d) => d.id !== id));
    } catch {
      void message.error('删除失败');
    }
  };

  return (
    <>
      <Wrapper>
        <TitleRow>
          <Title>布局方案管理</Title>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            保存当前布局
          </Button>
        </TitleRow>
        {layoutDefs.length === 0 ? (
          <div style={{ color: colors.text.muted, fontSize: 13, padding: spacing[2] }}>
            暂无自定义方案，点击上方按钮保存当前布局
          </div>
        ) : (
          layoutDefs.map((def) => (
            <LayoutItem
              key={def.id}
              $active={def.id === activeLayoutId}
              onClick={() => handleSelectLayout(def)}
            >
              {def.is_default && <DefaultTag>默认</DefaultTag>}
              <LayoutName>{def.name}</LayoutName>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => { e.stopPropagation(); handleDelete(def.id); }}
              />
            </LayoutItem>
          ))
        )}
      </Wrapper>

      <Modal
        title="保存布局方案"
        open={modalOpen}
        onOk={handleSaveLayout}
        onCancel={() => { setModalOpen(false); setLayoutName(''); }}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="输入方案名称，例如：工作视图"
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          maxLength={30}
        />
      </Modal>
    </>
  );
};

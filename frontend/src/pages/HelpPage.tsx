import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { PageHeader } from '@/components/common/PageHeader';
import { WorkflowHelpContent } from '@/components/workflow/WorkflowHelpContent';

const sections = [
  { key: '1', label: '1. 快速开始', anchor: 'help-section-1' },
  { key: '2', label: '2. 节点类型总览', anchor: 'help-section-2' },
  { key: '3', label: '3. 连线规则', anchor: 'help-section-3' },
  { key: '4', label: '4. 核心节点配置', anchor: 'help-section-4' },
  { key: '5', label: '5. 示例工作流', anchor: 'help-section-5' },
  { key: '6', label: '6. 常见问题', anchor: 'help-section-6' },
];

const PageLayout = styled.div`
  display: flex;
  gap: ${spacing[6]};
`;

const SidebarNav = styled.aside`
  width: 200px;
  flex-shrink: 0;
  position: sticky;
  top: 24px;
  align-self: flex-start;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]} ${spacing[8]};
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  scroll-behavior: smooth;
`;

const HelpPage = () => {
  const [activeSection, setActiveSection] = useState('1');
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const h2List = contentRef.current.querySelectorAll('.ant-typography');
    let current = '1';
    h2List.forEach((el) => {
      const text = el.textContent || '';
      const match = text.match(/^(\d+)\./);
      if (match && el.getBoundingClientRect().top <= 40) {
        current = match[1];
      }
    });
    setActiveSection(current);
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToSection = (anchor: string) => {
    const el = contentRef.current;
    if (!el) return;
    const h2List = el.querySelectorAll('.ant-typography');
    for (const h2 of h2List) {
      const text = h2.textContent || '';
      if (text.startsWith(anchor.replace('help-section-', ''))) {
        h2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  return (
    <>
      <PageHeader title="Nexus 帮助中心" />
      <PageLayout>
        <SidebarNav>
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            items={sections.map((s) => ({
              key: s.key,
              icon: <BookOutlined />,
              label: s.label,
              onClick: () => scrollToSection(s.anchor),
            }))}
            style={{ background: 'transparent', border: 'none' }}
          />
        </SidebarNav>
        <ContentArea ref={contentRef}>
          <WorkflowHelpContent />
        </ContentArea>
      </PageLayout>
    </>
  );
};

export default HelpPage;

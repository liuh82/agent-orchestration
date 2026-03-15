import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, Avatar, Tag } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ToolOutlined,
  SettingOutlined,
  BellOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';
import { animation } from '@/styles/tokens/animation';
import type { MenuProps } from 'antd';

// === Styled Components ===

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${colors.neutral[950]};
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const StyledHeader = styled.header`
  height: ${spacing.layout.headerHeight};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${spacing[6]};
  background: rgba(10,10,10,0.8);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid ${colors.border.DEFAULT};
  position: sticky;
  top: 0;
  z-index: 100;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
`;

const LogoText = styled.span`
  font-size: ${typography.fontSize.xl};
  font-weight: ${typography.fontWeight.bold};
  background: ${colors.gradient.brand};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: ${colors.text.secondary};
  border-radius: ${radius.md};
  cursor: pointer;
  transition: all ${animation.duration.fast} ${animation.easing.default};
  font-size: 16px;

  &:hover {
    background: rgba(255,255,255,0.06);
    color: ${colors.text.primary};
  }
`;

const StyledAvatar = styled(Avatar)`
  cursor: pointer;
`;

const SidebarWrapper = styled.aside<{ $collapsed: boolean }>`
  width: ${({ $collapsed }) => ($collapsed ? spacing.layout.sidebarCollapsed : spacing.layout.sidebarWidth)};
  background: ${colors.neutral[950]};
  border-right: 1px solid ${colors.border.DEFAULT};
  display: flex;
  flex-direction: column;
  transition: width ${animation.duration.normal} ${animation.easing.default};
  overflow: hidden;
  flex-shrink: 0;
`;

const SidebarMenu = styled(Menu)`
  flex: 1;
  border: none;
  background: transparent;
  padding: ${spacing[2]} ${spacing[2]};
  overflow-y: auto;

  .ant-menu-item {
    margin: 2px 0;
    border-radius: ${radius.md};
  }
`;

const SidebarFooter = styled.div`
  padding: ${spacing[3]} ${spacing[4]};
  border-top: 1px solid ${colors.border.DEFAULT};
  display: flex;
  justify-content: center;
`;

const Content = styled.main`
  flex: 1;
  padding: ${spacing.layout.pagePadding};
  overflow-y: auto;
  background: ${colors.neutral[950]};
`;

const ContentInner = styled.div`
  max-width: ${spacing.layout.contentMaxWidth};
  margin: 0 auto;
  width: 100%;
  ${animation.slideUp}
`;

// === Admin Menu Items ===

const adminMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '后台首页',
  },
  {
    key: '/admin/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
  {
    key: '/admin/agent-types',
    icon: <ToolOutlined />,
    label: 'Agent 类型',
  },
  {
    key: '/admin/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
  {
    key: '/admin/notifications',
    icon: <BellOutlined />,
    label: '通知配置',
  },
  {
    key: '/admin/stats',
    icon: <BarChartOutlined />,
    label: '全局统计',
  },
];

// === Component ===

export const AdminLayout = () => {
  const { user, fetchMe, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      fetchMe();
    }
  }, [user, fetchMe]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => logout(),
    },
  ];

  return (
    <Layout>
      <StyledHeader>
        <HeaderLeft>
          <LogoText>Nexus</LogoText>
          <Tag color="volcano" style={{ marginLeft: 4 }}>Admin</Tag>
        </HeaderLeft>
        <HeaderRight>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <StyledAvatar
              size={32}
              src={user?.avatar}
              icon={!user?.avatar && <UserOutlined />}
            />
          </Dropdown>
        </HeaderRight>
      </StyledHeader>
      <Body>
        <SidebarWrapper $collapsed={sidebarCollapsed}>
          <SidebarMenu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={adminMenuItems}
            onClick={onMenuClick}
            inlineCollapsed={sidebarCollapsed}
          />
          <SidebarFooter>
            <IconButton onClick={toggleSidebar}>
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </IconButton>
          </SidebarFooter>
        </SidebarWrapper>
        <Content>
          <ContentInner>
            <Outlet />
          </ContentInner>
        </Content>
      </Body>
    </Layout>
  );
};

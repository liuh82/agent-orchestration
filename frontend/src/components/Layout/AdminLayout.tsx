import { useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, Avatar, Tag, Button } from 'antd';
import {
  DashboardOutlined,
  CloudServerOutlined,
  RobotOutlined,
  TeamOutlined,
  SettingOutlined,
  BellOutlined,
  ArrowLeftOutlined,
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
import { animation } from '@/styles/tokens/animation';
import type { MenuProps } from 'antd';

// === Styled Components ===

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f5f5;
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const StyledHeader = styled.header`
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #334155;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  padding-left: 4px;
`;

const LogoText = styled.span`
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  background: ${colors.gradient.brand};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const BackButton = styled(Button)`
  color: rgba(255,255,255,0.8) !important;
  border-color: rgba(255,255,255,0.2) !important;
  &:hover {
    color: #fff !important;
    border-color: rgba(255,255,255,0.4) !important;
  }
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
  color: rgba(255,255,255,0.6);
  border-radius: ${radius.md};
  cursor: pointer;
  transition: all ${animation.duration.fast} ${animation.easing.default};
  font-size: 16px;

  &:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
`;

const StyledAvatar = styled(Avatar)`
  cursor: pointer;
`;

const SidebarWrapper = styled.aside<{ $collapsed: boolean }>`
  width: ${({ $collapsed }) => ($collapsed ? '64px' : spacing.layout.sidebarWidth)};
  background: #1e293b;
  display: flex;
  flex-direction: column;
  transition: width ${animation.duration.normal} ${animation.easing.default};
  overflow: hidden;
  flex-shrink: 0;
  padding-top: 4px;
`;

const SidebarMenu = styled.div`
  flex: 1;
  padding: ${spacing[3]} ${spacing[2]};
  overflow-y: auto;
`;

const SidebarFooter = styled.div`
  padding: ${spacing[3]};
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  justify-content: center;
`;

const Content = styled.main`
  flex: 1;
  padding: ${spacing.layout.pagePadding};
  overflow-y: auto;
  background: #f5f5f5;
`;

const ContentInner = styled.div`
  max-width: ${spacing.layout.contentMaxWidth};
  margin: 0 auto;
  width: 100%;
  animation: pageTransition 200ms cubic-bezier(0, 0, 0.2, 1);

  @keyframes pageTransition {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// === Admin Menu Items (role-based) ===

const adminOnlyMenuItems: MenuProps['items'] = [
  {
    key: '/admin/gateway',
    icon: <CloudServerOutlined />,
    label: 'Gateway 管理',
  },
  {
    key: '/admin/agents',
    icon: <RobotOutlined />,
    label: '代理中心',
  },
  {
    key: '/admin/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
  {
    key: '/admin/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

const commonMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '管理概览',
  },
];

const adminTailMenuItems: MenuProps['items'] = [
  {
    key: '/admin/notifications',
    icon: <BellOutlined />,
    label: '通知配置',
  },
];

const userOnlyMenuItems: MenuProps['items'] = [
  {
    key: '/admin/gateway',
    icon: <CloudServerOutlined />,
    label: 'Gateway 管理',
  },
  {
    key: '/admin/agents',
    icon: <RobotOutlined />,
    label: '代理中心',
  },
  {
    key: '/admin/notifications',
    icon: <BellOutlined />,
    label: '通知配置',
  },
];

function buildMenuItems(role?: string): NonNullable<MenuProps['items']> {
  if (role === 'admin') {
    return [...(commonMenuItems ?? []), ...(adminOnlyMenuItems ?? []), ...(adminTailMenuItems ?? [])];
  }
  return [...(commonMenuItems ?? []), ...(userOnlyMenuItems ?? [])];
}

// Ensure non-null for Menu items prop
function ensureMenuItems(items: MenuProps['items']): NonNullable<MenuProps['items']> {
  return items ?? [];
}

// === Component ===

export const AdminLayout = () => {
  const { user, fetchMe, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = useMemo(() => ensureMenuItems(buildMenuItems(user?.role)), [user?.role]);

  useEffect(() => {
    if (!user) {
      fetchMe();
    }
  }, [user, fetchMe]);

  // Inject collapsed menu icon centering CSS
  useEffect(() => {
    const id = 'admin-sidebar-collapsed-fix';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (sidebarCollapsed) {
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = `
        .ant-menu-inline-collapsed > .ant-menu-item,
        .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          padding-inline: 0 !important;
          margin-inline: 0 !important;
        }
        .ant-menu-inline-collapsed > .ant-menu-item .ant-menu-title-content {
          display: none !important;
        }
        .ant-menu-inline-collapsed > .ant-menu-item .ant-menu-item-icon {
          margin-inline: 0 !important;
          font-size: 18px !important;
        }
      `;
    } else if (style) {
      style.remove();
    }
  }, [sidebarCollapsed]);

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
          <BackButton
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回前台
          </BackButton>
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
          <SidebarMenu>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={ensureMenuItems(menuItems)}
              onClick={onMenuClick}
              inlineCollapsed={sidebarCollapsed}
              theme="dark"
              style={{ background: 'transparent', border: 'none' }}
            />
          </SidebarMenu>
          <SidebarFooter>
            <IconButton onClick={toggleSidebar}>
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </IconButton>
          </SidebarFooter>
        </SidebarWrapper>
        <Content>
          <ContentInner key={location.pathname}>
            <Outlet />
          </ContentInner>
        </Content>
      </Body>
    </Layout>
  );
};

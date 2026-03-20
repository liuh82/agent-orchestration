import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, Avatar } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
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
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// === Menu Items ===

const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: '项目',
  },
  {
    key: '/tasks',
    icon: <UnorderedListOutlined />,
    label: '任务中心',
  },
  {
    key: '/workflows',
    icon: <ApartmentOutlined />,
    label: '工作流',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
  {
    key: '/help',
    icon: <QuestionCircleOutlined />,
    label: '帮助',
  },
];

// === Component ===

export const MainLayout = () => {
  const { user, isAuthenticated, fetchMe, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !sidebarCollapsed) {
        toggleSidebar();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed, toggleSidebar]);

  // Inject collapsed menu icon centering CSS
  useEffect(() => {
    const id = 'sidebar-collapsed-fix';
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
      `
    } else if (style) {
      style.remove();
    }
  }, [sidebarCollapsed]);

  const selectedKey = (menuItems?.find(
    (item) => item?.key !== undefined && item?.key !== null && item.key !== '/' && location.pathname.startsWith(String(item.key))
  )?.key ?? location.pathname) as string;

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe();
    }
  }, [isAuthenticated, user, fetchMe]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => navigate('/settings'),
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
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={onMenuClick}
              inlineCollapsed={sidebarCollapsed}
              theme="dark"
              style={{ background: 'transparent', border: 'none' }}
            />
          </SidebarMenu>
          <SidebarFooter>
            <IconButton
              onClick={() => navigate('/admin')}
              title="后台管理"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <SettingOutlined />
            </IconButton>
            <IconButton
              onClick={toggleSidebar}
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
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

import { Layout, Menu, Dropdown } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  AimOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  ApiOutlined,
  DownOutlined
} from '@ant-design/icons';

const { Header: AntHeader } = Layout;

export const Header = () => {
  const location = useLocation();

  // 组织架构子菜单
  const orgMenuItems = [
    {
      key: '/org',
      label: <Link to="/org">组织架构</Link>,
    },
    {
      key: '/goals',
      label: <Link to="/goals">目标管理</Link>,
    },
  ];

  // 治理子菜单
  const governanceMenuItems = [
    {
      key: '/approvals',
      label: <Link to="/approvals">审批中心</Link>,
    },
    {
      key: '/audit',
      label: <Link to="/audit">审计日志</Link>,
    },
  ];

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表板</Link>,
    },
    {
      key: '/agents',
      icon: <TeamOutlined />,
      label: <Link to="/agents">Agent 管理</Link>,
    },
    {
      key: '/tasks',
      icon: <ProjectOutlined />,
      label: <Link to="/tasks">任务中心</Link>,
    },
    {
      key: '/workflows',
      icon: <AppstoreOutlined />,
      label: <Link to="/workflows">工作流</Link>,
    },
    {
      key: 'org',
      icon: <ApartmentOutlined />,
      label: (
        <Dropdown menu={{ items: orgMenuItems.map(item => ({ key: item.key, label: item.label })) }}>
          <Link to="/org" style={{ display: 'flex', alignItems: 'center' }}>
            组织架构 <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
          </Link>
        </Dropdown>
      ),
    },
    {
      key: 'governance',
      icon: <CheckSquareOutlined />,
      label: (
        <Dropdown menu={{ items: governanceMenuItems.map(item => ({ key: item.key, label: item.label })) }}>
          <Link to="/approvals" style={{ display: 'flex', alignItems: 'center' }}>
            治理 <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
          </Link>
        </Dropdown>
      ),
    },
    {
      key: '/goals',
      icon: <AimOutlined />,
      label: <Link to="/goals">目标管理</Link>,
    },
    {
      key: '/audit',
      icon: <FileTextOutlined />,
      label: <Link to="/audit">审计日志</Link>,
    },
    {
      key: '/heartbeats',
      icon: <ApiOutlined />,
      label: <Link to="/heartbeats">心跳配置</Link>,
    },
  ];

  return (
    <AntHeader style={{ display: 'flex', alignItems: 'center', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
      <div style={{ width: 240, fontSize: 18, fontWeight: 600, marginRight: 40 }}>
        AI Agent 编排可视化工具
      </div>
      <Menu
        theme="light"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        style={{ flex: 1, borderBottom: 'none' }}
      />
    </AntHeader>
  );
};
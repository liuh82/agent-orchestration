import { Layout, Menu } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  ProjectOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Header: AntHeader } = Layout;

export const Header = () => {
  const location = useLocation();

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
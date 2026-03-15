import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { antdTheme } from '@/styles/antd-theme';
import { GlobalStyle } from '@/styles/global';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, GuestRoute } from '@/components/Auth/ProtectedRoute';
import { MainLayout } from '@/components/Layout/MainLayout';
import { AdminLayout } from '@/components/Layout/AdminLayout';

// 懒加载页面 — Auth
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));

// 懒加载页面 — Core
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProjectListPage = React.lazy(() => import('@/pages/projects/ProjectListPage'));
const ProjectDetailPage = React.lazy(() => import('@/pages/projects/ProjectDetailPage'));
const TaskCenterPage = React.lazy(() => import('@/pages/tasks/TaskCenterPage'));
const WorkflowListPage = React.lazy(() => import('@/pages/workflows/WorkflowListPage'));
const WorkflowEditorPage = React.lazy(() => import('@/pages/workflows/WorkflowEditorPage'));
const WorkflowMonitorPage = React.lazy(() => import('@/pages/workflows/WorkflowMonitorPage'));
const TaskDetailPage = React.lazy(() => import('@/pages/tasks/TaskDetailPage'));

// 懒加载页面 — Settings
const SettingsPage = React.lazy(() => import('@/pages/settings/SettingsPage'));
const NotificationPage = React.lazy(() => import('@/pages/settings/NotificationPage'));

// 懒加载页面 — Admin
const AdminDashboard = React.lazy(() => import('@/pages/admin/AdminDashboard'));
const GatewayPage = React.lazy(() => import('@/pages/admin/GatewayPage'));
const AgentListPage = React.lazy(() => import('@/pages/agents/AgentListPage'));
const AgentNewPage = React.lazy(() => import('@/pages/agents/AgentNewPage'));
const AgentDetailPage = React.lazy(() => import('@/pages/agents/AgentDetailPage'));
const UserManagePage = React.lazy(() => import('@/pages/admin/UserManagePage'));
const AgentTypePage = React.lazy(() => import('@/pages/admin/AgentTypePage'));
const SystemSettingsPage = React.lazy(() => import('@/pages/admin/SystemSettingsPage'));
const AdminNotificationPage = React.lazy(() => import('@/pages/admin/AdminNotificationPage'));
const AdminStatsPage = React.lazy(() => import('@/pages/admin/AdminStatsPage'));

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <GlobalStyle />
      <BrowserRouter>
        <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }} />}>
          <Routes>
            {/* 未登录 */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

            {/* 已登录 - 前台 */}
            <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectListPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="tasks" element={<TaskCenterPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="workflows" element={<WorkflowListPage />} />
              <Route path="workflows/new" element={<WorkflowEditorPage />} />
              <Route path="workflows/monitor/:executionId" element={<WorkflowMonitorPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/notifications" element={<NotificationPage />} />
            </Route>

            {/* 已登录 - 后台 */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="gateway" element={<GatewayPage />} />
              <Route path="agents" element={<AgentListPage />} />
              <Route path="agents/new" element={<AgentNewPage />} />
              <Route path="agents/:id" element={<AgentDetailPage />} />
              <Route path="users" element={<UserManagePage />} />
              <Route path="agent-types" element={<AgentTypePage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="notifications" element={<AdminNotificationPage />} />
              <Route path="stats" element={<AdminStatsPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;

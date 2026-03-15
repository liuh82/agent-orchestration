import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { antdTheme } from '@/styles/antd-theme';
import { GlobalStyle } from '@/styles/global';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, GuestRoute } from '@/components/Auth/ProtectedRoute';
import { MainLayout } from '@/components/Layout/MainLayout';
import { AdminLayout } from '@/components/Layout/AdminLayout';

// 懒加载页面
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'));

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
              {/* R3 添加更多子路由 */}
            </Route>

            {/* 已登录 - 后台 */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              {/* R4 添加 admin 子路由 */}
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

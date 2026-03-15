import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '@/stores/auth';
import type { ReactNode } from 'react';

/** 会话恢复中 — 页面刷新后尝试通过 cookie refresh_token 恢复 */
const Restoring = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
    <span style={{ color: '#64748b' }}>恢复会话中...</span>
  </div>
);

/** 403 无权限页面 */
const Forbidden = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
    <Result
      status="403"
      title="无访问权限"
      subTitle="您没有权限访问此页面"
      extra={<Button type="primary" onClick={() => (window.location.href = '/')}>返回首页</Button>}
    />
  </div>
);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      fetchMe().finally(() => setChecking(false));
    }
  }, [isAuthenticated, fetchMe]);

  if (checking) return <Restoring />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user, fetchMe } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      fetchMe().finally(() => setChecking(false));
    }
  }, [isAuthenticated, fetchMe]);

  if (checking) return <Restoring />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role !== 'admin') return <Forbidden />;
  return <>{children}</>;
};

export const GuestRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

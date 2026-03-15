# Phase 1 - 前端：Token 拦截器 + 权限守卫

## 任务目标

实现前端 Token 自动刷新、路由权限守卫，配合后端 JWT 双Token认证。

## 修改文件清单

```
frontend/src/api/client.ts        # axios 拦截器（新建/重写）
frontend/src/api/auth.ts           # 认证 API 调用
frontend/src/stores/useAuthStore.ts  # 认证状态管理
frontend/src/router/index.tsx       # 路由配置 + 权限守卫
frontend/src/pages/auth/LoginPage.tsx  # 登录页适配
```

## API 客户端

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// 请求拦截：注入 Access Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：401 自动刷新 + 统一错误处理
apiClient.interceptors.response.use(
  (response) => response.data,  // 解包 { code, data, message }
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { access_token } = await useAuthStore.getState().refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);
```

## Auth Store

```typescript
// frontend/src/stores/useAuthStore.ts
interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<{ access_token: string }>;
  fetchUser: () => Promise<void>;
}
```

**关键：** accessToken 只存内存（zustand），不写 localStorage/sessionStorage。页面刷新后通过 refresh_token cookie 自动恢复。

## 路由守卫

```typescript
// frontend/src/router/index.tsx

// 已认证检查
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

// Admin 角色检查
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
};

// 路由配置
<Route path="/admin/*" element={<AdminRoute><AdminLayout /></AdminRoute>} />
<Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
<Route path="/login" element={<LoginPage />} />
```

## 登录页适配

- 登录成功后：access_token 存 store，不存 localStorage
- 如果响应有 Set-Cookie（refresh_token），浏览器自动处理
- 登录后重定向到之前访问的页面或 `/dashboard`

## 约束

- Access Token 绝对不能存 localStorage（安全要求）
- 页面刷新后通过 `/api/v1/auth/refresh` 自动恢复会话（使用 cookie 中的 refresh_token）
- 403 错误时如果是 user 角色访问 admin 路由，显示"无权限"提示而非跳转登录
- API 请求的 baseURL 保持 `/api/v1`

## 验收标准

- [ ] 登录成功后跳转 Dashboard
- [ ] 刷新页面后自动恢复会话（不用重新登录）
- [ ] Access Token 过期后请求自动重试（用户无感知）
- [ ] Refresh Token 过期后自动跳转登录页
- [ ] admin 可访问 /admin/*，user 访问返回首页
- [ ] 未登录访问任何页面跳转 /login
- [ ] 登出后清除 store + cookie，跳转登录页

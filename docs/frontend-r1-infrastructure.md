# Nexus 前端 — 第 1 轮：基础设施

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/frontend/`
> **设计规范**: 必读 `DESIGN_SPEC.md`（本文件会告知是否可用，但 Token 文件必须使用）
> **本轮目标**: 搭建 Design Token、Ant Design 主题、API 客户端、TypeScript 类型、状态管理
> **完整文档参考**: `../docs/frontend-dev-prompt.md`

---

## 任务清单

### 1. Design Token 文件 — `src/styles/tokens/`

从 `DESIGN_SPEC.md` 中复制并创建以下 6 个文件：

#### `src/styles/tokens/color.ts`
- 完整颜色系统：primary (Indigo), success, error, warning, info
- 中性色：neutral.50 到 neutral.950
- 功能色：surface (DEFAULT, raised, overlay)
- 边框色：border (DEFAULT, hover, focus, disabled)
- 文字色：text (primary, secondary, muted, disabled, brand, success, error, warning)
- 渐变：gradient (brand, success, card)

#### `src/styles/tokens/spacing.ts`
- 基础间距：0-24（4px 倍数）
- 语义间距：gap (xs/sm/md/lg/xl/xxl)
- 布局：layout (contentMaxWidth, sidebarWidth, sidebarCollapsed, headerHeight, pagePadding)

#### `src/styles/tokens/typography.ts`
- fontFamily: Inter + JetBrains Mono
- fontSize: xs(11px) 到 4xl(30px)
- fontWeight: normal(400) 到 bold(700)
- lineHeight, letterSpacing

#### `src/styles/tokens/radius.ts`
- none, sm(4px), md(6px), lg(8px), xl(12px), 2xl(16px), full

#### `src/styles/tokens/shadow.ts`
- none, sm, md, lg, xl, glow
- 包含层次设计说明注释

#### `src/styles/tokens/animation.ts`
- duration: instant/fast/normal/slow/enter/exit
- easing: default/enter/exit/bounce
- 预定义动画对象

### 2. Ant Design 主题覆盖 — `src/styles/antd-theme.ts`

从 DESIGN_SPEC.md 第四章复制完整的 `antdTheme` 配置：
- 全局 token（颜色、字体、圆角、间距、线条、动画）
- 组件级 token（Button, Card, Table, Input, Modal, Menu, Tag, Badge, Tooltip, Tabs）

### 3. 全局样式 — `src/styles/global.ts`

```typescript
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  /* Google Fonts import */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* CSS Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  html { font-size: 14px; -webkit-font-smoothing: antialiased; }
  
  body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0a0a0a;
    color: #fafafa;
    line-height: 1.5;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  /* Keyframes */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* Selection */
  ::selection { background: rgba(99,102,241,0.3); color: #fff; }

  a { color: #818cf8; text-decoration: none; }
  a:hover { color: #a5b4fc; }
`;
```

### 4. API 客户端 — `src/api/client.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：自动加 Authorization 头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一处理错误
api.interceptors.response.use(
  (response) => response.data,  // 直接返回 {code, data, message}
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      // 尝试刷新 token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken });
          localStorage.setItem('access_token', res.data.data.access_token);
          localStorage.setItem('refresh_token', res.data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${res.data.data.access_token}`;
          return api(error.config);
        } catch {
          // 刷新失败，跳转登录
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(data || { code: 50001, message: 'Network error' });
  }
);

export default api;
```

### 5. TypeScript 类型 — `src/types/`

创建以下类型文件（从完整文档中的第十章复制）：

#### `src/types/api.ts`
```typescript
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
```

#### `src/types/auth.ts` — User, LoginRequest, RegisterRequest, TokenResponse
#### `src/types/agent.ts` — AgentType, AgentInstance, AgentConfig
#### `src/types/project.ts` — Project
#### `src/types/task.ts` — Task
#### `src/types/job.ts` — Job
#### `src/types/stats.ts` — DashboardStats

### 6. 认证 Store — `src/stores/auth.ts`

```typescript
import { create } from 'zustand';
import api from '@/api/client';
import type { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user, access_token, refresh_token } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    set({ user, isAuthenticated: true });
  },

  register: async (email, password, name) => {
    const res = await api.post('/auth/register', { email, password, name });
    const { user, access_token, refresh_token } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
```

### 7. UI Store — `src/stores/ui.ts`

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
```

### 8. 更新 `src/App.tsx`

```tsx
import { ConfigProvider } from 'antd';
import { antdTheme } from '@/styles/antd-theme';
import { GlobalStyle } from '@/styles/global';
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <GlobalStyle />
      <BrowserRouter>
        {/* Routes will be added in R2 */}
        <div>Nexus - Loading...</div>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
```

### 9. 更新 `vite.config.ts`

确保有 alias 和 proxy：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});
```

### 10. 安装依赖

```bash
npm install styled-components
npm install -D @types/styled-components
# 确认已有：antd, zustand, react-router-dom, react-query, axios
```

---

## 输出要求

1. `npm run dev` 正常启动（Vite dev server）
2. Token 文件无 TypeScript 错误
3. App.tsx 使用 ConfigProvider 包裹，主题生效
4. API 客户端能发请求到后端（即使 401 也说明拦截器在工作）
5. 全局样式生效（暗色背景、滚动条、字体）

---

## ⚠️ 注意

- **所有颜色/间距/字体必须从 Token 文件导入，禁止硬编码！**
- 不创建任何页面组件（R2 做）
- 不创建任何 API 模块文件（R2 做）
- 确保 `@/` alias 在 vite 和 tsconfig 中都配置
- 下一轮：登录/注册页面 + 路由守卫 + 布局

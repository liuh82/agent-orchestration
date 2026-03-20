import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // 携带 httpOnly cookie（refresh_token）
});

// 请求拦截 — 注入 Access Token
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截 — 解包各种 envelope 格式 + 401 自动刷新
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processPendingRequests(token: string | null, error?: unknown) {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  pendingRequests = [];
}

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // 情况1: 标准 envelope { code, data, message }（如 /api/v1/ 下的接口）
      if ('code' in data && 'data' in data) {
        response.data = data.data;
        return response;
      }
      // 情况2: Pydantic 格式 { success, data }（gateway 接口）
      if ('success' in data && 'data' in data) {
        // data.data 可能是数组（listBridges）或 dict（单个对象）
        if (Array.isArray(data.data)) {
          response.data = data.data;
        } else if (data.data && typeof data.data === 'object') {
          // data.data 是对象，尝试取 .items（分页列表）或保留对象本身
          response.data = data.data;
        } else {
          response.data = data.data;
        }
        return response;
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 跳过 auth 相关请求的自动刷新（避免 /auth/refresh 401 时递归）
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error.response?.data || error);
    }

    // 401: 尝试用 refresh_token 刷新 access_token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const newToken = await useAuthStore.getState().refreshAccessToken();
        processPendingRequests(newToken.access_token);
        originalRequest.headers.Authorization = `Bearer ${newToken.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processPendingRequests(null, refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error.response?.data || error);
  },
);

export default apiClient;

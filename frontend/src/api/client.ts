import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // X-API-Key 认证（与后端 auth.py 一致）
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    } else {
      const storedKey = localStorage.getItem('api_key');
      if (storedKey) {
        config.headers['X-API-Key'] = storedKey;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 401: 认证失效，清除 key 并通知前端
    if (error.response?.status === 401) {
      localStorage.removeItem('api_key');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (error.response) {
      // 处理 HTTP 错误
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // 处理网络错误
      console.error('Network Error:', error.message);
    } else {
      // 处理其他错误
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;

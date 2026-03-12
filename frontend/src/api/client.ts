import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
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
/**
 * 颜色系统
 *
 * 设计原则：
 * 1. 暗色主题为默认（技术类产品偏好暗色）
 * 2. 主色调：Indigo（专业、科技感、不刺眼）
 * 3. 语义色：绿=成功、红=错误、黄=警告、蓝=信息
 * 4. 中性色：从 #0a0a0a 到 #fafafa 的完整灰阶
 */

export const colors = {
  // === 品牌色 ===
  primary: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  // === 语义色 ===
  success: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  error: {
    50:  '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  warning: {
    50:  '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  info: {
    50:  '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  // === 中性色（暗色主题） ===
  neutral: {
    50:   '#fafafa',
    100:  '#f5f5f5',
    200:  '#e5e5e5',
    300:  '#d4d4d4',
    400:  '#a3a3a3',
    500:  '#737373',
    600:  '#525252',
    700:  '#404040',
    800:  '#262626',
    850:  '#1c1c1c',
    900:  '#171717',
    950:  '#0a0a0a',
  },

  // === 功能色 ===
  surface: {
    DEFAULT: '#141414',
    raised:   '#1a1a1a',
    overlay:  'rgba(0,0,0,0.6)',
  },

  // === 边框 ===
  border: {
    DEFAULT: 'rgba(255,255,255,0.06)',
    hover:    'rgba(255,255,255,0.10)',
    focus:    'rgba(99,102,241,0.50)',
    disabled: 'rgba(255,255,255,0.03)',
  },

  // === 文字 ===
  text: {
    primary:   '#fafafa',
    secondary: '#a3a3a3',
    muted:     '#737373',
    disabled:  '#525252',
    brand:     '#818cf8',
    success:   '#4ade80',
    error:     '#f87171',
    warning:   '#fbbf24',
  },

  // === 渐变 ===
  gradient: {
    brand:  'linear-gradient(135deg, #6366f1, #8b5cf6)',
    success: 'linear-gradient(135deg, #22c55e, #10b981)',
    card:   'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
  },
};

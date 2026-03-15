import type { ThemeConfig } from 'antd';

/**
 * Ant Design 5 主题配置
 *
 * 浅色主题 — 匹配浅色内容区 + 深色 Sidebar/Header 布局。
 * 所有前端页面必须在 ConfigProvider 中使用此主题。
 */

export const antdTheme: ThemeConfig = {
  token: {
    // === 颜色 ===
    colorPrimary: '#6366f1',
    colorSuccess: '#22c55e',
    colorError: '#ef4444',
    colorWarning: '#f59e0b',
    colorInfo: '#3b82f6',

    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f1f5f9',

    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',

    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorTextTertiary: '#94a3b8',
    colorTextDisabled: '#cbd5e1',

    // === 字体 ===
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,

    // === 圆角 ===
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // === 间距 ===
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,

    // === 线条 ===
    lineWidth: 1,
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    // === 动画 ===
    motionDurationFast: '0.1s',
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.3s',
  },

  components: {
    Button: {
      primaryShadow: '0 1px 2px rgba(99,102,241,0.3)',
      defaultBg: '#ffffff',
      defaultBorderColor: '#e2e8f0',
      defaultColor: '#0f172a',
      contentFontSizeLG: 15,
      paddingInline: 16,
      fontWeight: 500,
    },

    Card: {
      paddingLG: 24,
      borderRadiusLG: 12,
      colorBgContainer: '#ffffff',
      colorBorderSecondary: '#f1f5f9',
    },

    Table: {
      headerBg: '#f8fafc',
      headerColor: '#64748b',
      rowHoverBg: '#f1f5f9',
      borderColor: '#e2e8f0',
      fontSize: 14,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },

    Input: {
      activeBorderColor: '#6366f1',
      hoverBorderColor: '#cbd5e1',
      colorBgContainer: '#ffffff',
      activeShadow: '0 0 0 2px rgba(99,102,241,0.15)',
    },

    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      borderRadiusLG: 16,
    },

    Menu: {
      // Sidebar menu stays dark — these tokens apply to inline dark menus
      itemBg: 'transparent',
      itemHoverBg: 'rgba(255,255,255,0.08)',
      itemSelectedBg: 'rgba(99,102,241,0.25)',
      itemSelectedColor: '#ffffff',
      itemColor: 'rgba(255,255,255,0.7)',
      iconSize: 16,
    },

    Tag: {
      borderRadiusSM: 4,
      defaultBg: '#f1f5f9',
    },

    Badge: {
      dotSize: 8,
    },

    Tooltip: {
      colorBgSpotlight: '#1e293b',
      borderRadius: 6,
      fontSize: 13,
    },

    Tabs: {
      itemColor: '#64748b',
      itemActiveColor: '#0f172a',
      itemSelectedColor: '#6366f1',
      inkBarColor: '#6366f1',
      horizontalItemPadding: '12px 16px',
    },

    Message: {
      contentBg: '#ffffff',
    },
  },
};

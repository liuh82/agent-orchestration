import type { ThemeConfig } from 'antd';

/**
 * Ant Design 5 主题配置
 *
 * 覆盖默认 token 以匹配设计规范。
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

    colorBgContainer: '#141414',
    colorBgElevated: '#1a1a1a',
    colorBgLayout: '#0a0a0a',

    colorBorder: 'rgba(255,255,255,0.06)',
    colorBorderSecondary: 'rgba(255,255,255,0.03)',

    colorText: '#fafafa',
    colorTextSecondary: '#a3a3a3',
    colorTextTertiary: '#737373',
    colorTextDisabled: '#525252',

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
      primaryShadow: '0 0 0 0 transparent',
      defaultBg: 'transparent',
      defaultBorderColor: 'rgba(255,255,255,0.1)',
      defaultColor: '#fafafa',
      contentFontSizeLG: 15,
      paddingInline: 16,
      fontWeight: 500,
    },

    Card: {
      paddingLG: 24,
      borderRadiusLG: 12,
      colorBgContainer: '#141414',
      colorBorderSecondary: 'rgba(255,255,255,0.03)',
    },

    Table: {
      headerBg: '#1a1a1a',
      headerColor: '#a3a3a3',
      rowHoverBg: 'rgba(255,255,255,0.02)',
      borderColor: 'rgba(255,255,255,0.06)',
      fontSize: 14,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },

    Input: {
      activeBorderColor: '#6366f1',
      hoverBorderColor: 'rgba(255,255,255,0.15)',
      colorBgContainer: '#141414',
      activeShadow: '0 0 0 2px rgba(99,102,241,0.15)',
    },

    Modal: {
      contentBg: '#1a1a1a',
      headerBg: '#1a1a1a',
      borderRadiusLG: 16,
    },

    Menu: {
      itemBg: 'transparent',
      itemHoverBg: 'rgba(255,255,255,0.04)',
      itemSelectedBg: 'rgba(99,102,241,0.1)',
      itemSelectedColor: '#818cf8',
      iconSize: 16,
    },

    Tag: {
      borderRadiusSM: 4,
      defaultBg: 'rgba(255,255,255,0.06)',
    },

    Badge: {
      dotSize: 8,
    },

    Tooltip: {
      colorBgSpotlight: '#262626',
      borderRadius: 6,
      fontSize: 13,
    },

    Tabs: {
      itemColor: '#737373',
      itemActiveColor: '#fafafa',
      itemSelectedColor: '#6366f1',
      inkBarColor: '#6366f1',
      horizontalItemPadding: '12px 16px',
    },
  },
};

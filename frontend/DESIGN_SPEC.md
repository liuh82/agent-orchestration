# Agent-Orchestration 前端设计规范

> **版本**: v1.0
> **日期**: 2026-03-13
> **适用项目**: agent-orchestration 前端
> **目标读者**: 所有参与前端开发的 Agent（Programmer、Designer）
> **遵循原则**: 本规范为前端开发的强制约束，所有代码必须符合

---

## 1. 设计理念

### 1.1 参考风格

以 **Linear.app** 和 **Vercel Dashboard** 为主要参考：

- **Linear**：极致简洁、信息密度高、暗色主题、流畅动画
- **Vercel**：清晰的层次结构、精致的阴影和边框、专业的数据展示

### 1.2 核心原则

| 原则 | 说明 | 具体要求 |
|------|------|---------|
| **一致性** | 相同的交互用相同的视觉表达 | 颜色、间距、圆角、字体必须统一使用 Design Token |
| **层次感** | 通过视觉层次引导用户注意力 | 背景色差异 + 微弱边框 + 阴影深度 |
| **留白** | 给内容呼吸的空间 | 组件间距至少 16px，避免拥挤 |
| **信息密度** | 在不牺牲可读性的前提下展示更多信息 | 紧凑但不局促 |
| **微交互** | 状态变化有即时反馈 | hover、active、loading 状态必须有视觉变化 |
| **可访问性** | 对比度、键盘导航、语义 HTML | 文字对比度 ≥ 4.5:1 |

---

## 2. 技术栈

### 2.1 当前技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Ant Design | 5.11 | 组件库 |
| styled-components | 6.3 | CSS-in-JS |
| Vite | 5.x | 构建工具 |
| Recharts | 2.8 | 图表 |
| React Flow | 10.3 | 流程图 |
| zustand | 4.4 | 状态管理 |
| react-query | 3.39 | 数据请求 |
| react-router-dom | 6.20 | 路由 |

### 2.2 技术决策

**为什么用 Ant Design 而不是 Shadcn/ui？**
- 当前项目已有 Ant Design 5，切换成本高
- Ant Design 5 的 Design Token 系统已足够成熟
- 中文文档完善，AI 生成代码准确率高
- 如果后续迁移到 Shadcn/ui，需要专门的迁移任务

**为什么不完全用 Ant Design 的默认样式？**
- Ant Design 默认样式偏"企业后台"，不够精致
- 需要通过 `ConfigProvider` 覆盖 token，实现定制化视觉风格
- 自定义组件（卡片、布局）用 styled-components 实现

---

## 3. Design Token 系统

### 3.1 颜色系统

```typescript
// src/styles/tokens/color.ts

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
    400: '#818cf8',  // Hover 状态
    500: '#6366f1',  // 默认主色
    600: '#4f46e5',  // Active/按下状态
    700: '#4338ca',  // 强调
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
    50:   '#fafafa',   // 文字 - 最亮
    100:  '#f5f5f5',
    200:  '#e5e5e5',
    300:  '#d4d4d4',
    400:  '#a3a3a3',   // 次要文字
    500:  '#737373',   // 辅助文字
    600:  '#525252',
    700:  '#404040',
    800:  '#262626',   // 边框 - 浅
    850:  '#1c1c1c',   // 边框 - 默认
    900:  '#171717',   // 背景 - 表面
    950:  '#0a0a0a',   // 背景 - 基础
  },

  // === 功能色 ===
  surface: {
    DEFAULT: '#141414',       // 卡片、面板背景
    raised:   '#1a1a1a',      // 弹出层、下拉菜单
    overlay:  'rgba(0,0,0,0.6)', // 遮罩层
  },

  // === 边框 ===
  border: {
    DEFAULT: 'rgba(255,255,255,0.06)',    // 默认边框
    hover:    'rgba(255,255,255,0.10)',   // Hover 边框
    focus:    'rgba(99,102,241,0.50)',    // Focus 边框（主色）
    disabled: 'rgba(255,255,255,0.03)',   // 禁用边框
  },

  // === 文字 ===
  text: {
    primary:   '#fafafa',    // 主文字（对比度 > 10:1）
    secondary: '#a3a3a3',    // 次要文字（对比度 > 4.5:1）
    muted:     '#737373',    // 辅助文字
    disabled:  '#525252',    // 禁用文字
    brand:     '#818cf8',    // 品牌文字（主色 + 亮度）
    success:   '#4ade80',
    error:     '#f87171',
    warning:   '#fbbf24',
  },

  // === 渐变 ===
  gradient: {
    brand: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    success: 'linear-gradient(135deg, #22c55e, #10b981)',
    card: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
  },
};
```

### 3.2 间距系统

```typescript
// src/styles/tokens/spacing.ts

/**
 * 间距系统
 * 
 * 基准单位：4px（Tailwind 标准）
 * 所有间距必须是 4px 的倍数
 * 
 * 命名规则：
 * - 4的倍数用数字：4, 8, 12, 16, 24, 32, 48, 64
 * - 语义化命名：gap-sm, gap-md, gap-lg 用于组件间距
 */

export const spacing = {
  // 基础间距
  0:  '0px',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',    // 最常用的间距
  5:  '20px',
  6:  '24px',    // 组件之间的标准间距
  8:  '32px',    // 区块间距
  10: '40px',
  12: '48px',    // 大区块间距
  16: '64px',
  20: '80px',
  24: '96px',

  // 语义化间距
  gap: {
    xs: '4px',     // 紧凑元素间（标签和图标）
    sm: '8px',     // 相关元素间（表单字段内）
    md: '16px',    // 组件内部间距（卡片内边距）
    lg: '24px',    // 组件之间间距（卡片之间）
    xl: '32px',    // 区块之间间距
    xxl: '48px',   // 页面区域之间
  },

  // 布局
  layout: {
    contentMaxWidth: '1400px',  // 内容最大宽度
    sidebarWidth: '240px',      // 侧边栏宽度
    sidebarCollapsed: '64px',   // 折叠侧边栏
    headerHeight: '56px',       // 顶栏高度
    pagePadding: '24px',        // 页面内边距
  },
};
```

### 3.3 字体系统

```typescript
// src/styles/tokens/typography.ts

/**
 * 字体系统
 * 
 * 主字体：Inter（Google Fonts，免费，专为屏幕阅读设计）
 * 等宽字体：JetBrains Mono（代码展示）
 * 
 * 字号规范：
 * - 标题：14-20px，Bold
 * - 正文：14px，Regular
 * - 辅助：12px，Regular
 * - 最小字号：11px（标签、徽章）
 */

export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
  },

  fontSize: {
    xs:   '11px',    // 标签、徽章、时间戳
    sm:   '12px',    // 辅助说明、表格内容
    base: '14px',    // 正文（默认）
    md:   '15px',    // 强调正文
    lg:   '16px',    // 小标题
    xl:   '18px',    // 区块标题
    '2xl': '20px',   // 页面标题
    '3xl': '24px',   // 大标题
    '4xl': '30px',   // 展示标题
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight:    1.25,
    normal:   1.5,
    relaxed:  1.75,
  },

  letterSpacing: {
    tight:   '-0.01em',  // 大标题
    normal:  '0',
    wide:    '0.02em',   // 标签、导航
    widest:  '0.05em',   // 全大写标签
  },
};
```

### 3.4 圆角系统

```typescript
// src/styles/tokens/radius.ts

export const radius = {
  none: '0px',
  sm:   '4px',    // 小元素（Badge、Tag）
  md:   '6px',    // 输入框、小按钮
  lg:   '8px',    // 按钮、卡片（最常用）
  xl:   '12px',   // 大卡片、弹窗
  '2xl': '16px',   // 面板
  full: '9999px', // 圆形元素（头像、Pill 按钮）
};
```

### 3.5 阴影系统

```typescript
// src/styles/tokens/shadow.ts

export const shadow = {
  none: 'none',

  // 卡片阴影（极微弱，通过边框 + 背景色差区分层次）
  sm: '0 1px 2px rgba(0,0,0,0.2)',

  // 悬浮卡片
  md: '0 4px 12px rgba(0,0,0,0.3)',

  // 弹出层（Dropdown、Popover）
  lg: '0 8px 24px rgba(0,0,0,0.4)',

  // 模态框
  xl: '0 16px 48px rgba(0,0,0,0.5)',

  // 高亮边框效果（替代传统阴影，更现代）
  glow: '0 0 0 1px rgba(99,102,241,0.2), 0 0 20px rgba(99,102,241,0.1)',
};

/**
 * 层次设计原则：
 * 
 * 层级 0（基础层）：背景 #0a0a0a
 * 层级 1（内容层）：卡片/面板 #141414，边框 rgba(255,255,255,0.06)
 * 层级 2（浮动层）：Dropdown #1a1a1a，shadow-md
 * 层级 3（模态层）：Modal #1a1a1a，shadow-xl
 * 
 * 不使用强烈的阴影来区分层次，主要依靠：
 * 1. 背景色差（每层 +10~20 亮度）
 * 2. 微弱的 1px 边框
 * 3. 极微弱的阴影（仅弹出层和模态层）
 */
```

### 3.6 动画系统

```typescript
// src/styles/tokens/animation.ts

export const animation = {
  duration: {
    instant: '0ms',
    fast:    '100ms',   // Hover、Active 状态
    normal:  '150ms',   // 展开/收起
    slow:    '300ms',   // 页面过渡
    enter:   '200ms',   // 元素进入
    exit:    '150ms',   // 元素退出
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',       // ease-out（Material 标准）
    enter:   'cubic-bezier(0, 0, 0.2, 1)',         // ease-out（快速进入）
    exit:    'cubic-bezier(0.4, 0, 1, 1)',         // ease-in（快速退出）
    bounce:  'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // 弹跳效果
  },

  // 预定义动画
  fadeIn: {
    animation: 'fadeIn 150ms cubic-bezier(0, 0, 0.2, 1)',
  },
  fadeOut: {
    animation: 'fadeOut 150ms cubic-bezier(0.4, 0, 1, 1)',
  },
  slideUp: {
    animation: 'slideUp 200ms cubic-bezier(0, 0, 0.2, 1)',
  },
  scaleIn: {
    animation: 'scaleIn 150ms cubic-bezier(0, 0, 0.2, 1)',
  },
};

/**
 * CSS Keyframes (放在全局样式中)
 * 
 * @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
 * @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
 * @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
 * @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
 */
```

---

## 4. Ant Design Token 覆盖

### 4.1 ConfigProvider 配置

```typescript
// src/styles/antd-theme.ts

import type { ThemeConfig } from 'antd';

/**
 * Ant Design 5 主题配置
 * 
 * 覆盖默认 token 以匹配设计规范。
 * 所有 Agent 开发前端时必须通过 ConfigProvider 使用此主题。
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
    // === Button ===
    Button: {
      primaryShadow: '0 0 0 0 transparent',          // 去掉默认阴影
      defaultBg: 'transparent',
      defaultBorderColor: 'rgba(255,255,255,0.1)',
      defaultColor: '#fafafa',
      contentFontSizeLG: 15,
      paddingInline: 16,
      fontWeight: 500,
    },

    // === Card ===
    Card: {
      paddingLG: 24,
      borderRadiusLG: 12,
      colorBgContainer: '#141414',
      colorBorderSecondary: 'rgba(255,255,255,0.03)',
    },

    // === Table ===
    Table: {
      headerBg: '#1a1a1a',
      headerColor: '#a3a3a3',
      rowHoverBg: 'rgba(255,255,255,0.02)',
      borderColor: 'rgba(255,255,255,0.06)',
      fontSize: 14,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },

    // === Input ===
    Input: {
      activeBorderColor: '#6366f1',
      hoverBorderColor: 'rgba(255,255,255,0.15)',
      colorBgContainer: '#141414',
      activeShadow: '0 0 0 2px rgba(99,102,241,0.15)',
    },

    // === Modal ===
    Modal: {
      contentBg: '#1a1a1a',
      headerBg: '#1a1a1a',
      borderRadiusLG: 16,
    },

    // === Menu ===
    Menu: {
      itemBg: 'transparent',
      itemHoverBg: 'rgba(255,255,255,0.04)',
      itemSelectedBg: 'rgba(99,102,241,0.1)',
      itemSelectedColor: '#818cf8',
      iconSize: 16,
    },

    // === Tag ===
    Tag: {
      borderRadiusSM: 4,
      defaultBg: 'rgba(255,255,255,0.06)',
    },

    // === Badge ===
    Badge: {
      dotSize: 8,
    },

    // === Tooltip ===
    Tooltip: {
      colorBgSpotlight: '#262626',
      borderRadius: 6,
      fontSize: 13,
    },

    // === Tabs ===
    Tabs: {
      itemColor: '#737373',
      itemActiveColor: '#fafafa',
      itemSelectedColor: '#6366f1',
      inkBarColor: '#6366f1',
      horizontalItemPadding: '12px 16px',
    },
  },
};
```

### 4.2 使用方式

```typescript
// App.tsx

import { ConfigProvider } from 'antd';
import { antdTheme } from './styles/antd-theme';

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
```

**强制要求**：所有前端页面必须在 `ConfigProvider` 包裹下，不能脱离主题配置。

---

## 5. 布局规范

### 5.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  Header (56px)                                          │
│  [Logo]  [搜索]                    [通知] [设置] [头像]   │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │  Content Area                                │
│ (240px)  │  ┌──────────────────────────────────────┐   │
│          │  │ Page Header                             │   │
│ Dashboard│  │ [标题]              [操作按钮]          │   │
│ 任务中心  │  ├──────────────────────────────────────┤   │
│ 代理中心  │  │                                        │   │
│ 工作流   │  │  Page Content                          │   │
│ 设置     │  │  (内边距 24px)                          │   │
│          │  │                                        │   │
│          │  │                                        │   │
│          │  └──────────────────────────────────────┘   │
├──────────┴──────────────────────────────────────────────┤
│  Footer (可选，通常不需要)                                │
└─────────────────────────────────────────────────────────┘
```

### 5.2 布局组件

```typescript
// src/components/Layout/MainLayout.tsx

const MainLayout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${colors.neutral[950]};
`;

const Content = styled.main`
  flex: 1;
  padding: ${spacing.layout.pagePadding};
  max-width: ${spacing.layout.contentMaxWidth};
  margin: 0 auto;
  width: 100%;
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing.gap.lg};
  
  h1 {
    font-size: ${typography.fontSize['2xl']};
    font-weight: ${typography.fontWeight.semibold};
    color: ${colors.text.primary};
    margin: 0;
  }
`;
```

---

## 6. 组件规范

### 6.1 卡片组件

```typescript
// 规范：
// - 背景色: #141414
// - 边框: 1px solid rgba(255,255,255,0.06)
// - 圆角: 12px
// - 内边距: 24px
// - Hover: 边框 rgba(255,255,255,0.10) + 微弱 translateY
// - 顶部可加渐变装饰线

const Card = styled.div<{ $variant?: 'default' | 'interactive' | 'highlight' }>`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing.gap.lg};
  transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);

  ${({ $variant }) => $variant === 'interactive' && `
    cursor: pointer;
    &:hover {
      border-color: ${colors.border.hover};
      transform: translateY(-1px);
      box-shadow: ${shadow.sm};
    }
  `}

  ${({ $variant }) => $variant === 'highlight' && `
    border-color: rgba(99,102,241,0.2);
    background: linear-gradient(180deg, rgba(99,102,241,0.03) 0%, transparent 40%);
  `}
`;
```

### 6.2 状态徽章

```typescript
// 规范：
// - 圆角: 4px
// - 内边距: 2px 8px
// - 字号: 12px
// - 字重: 500
// - 首字母大写

const statusColors = {
  running:   { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', dot: '#6366f1' },
  completed: { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', dot: '#22c55e' },
  failed:    { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', dot: '#ef4444' },
  pending:   { bg: 'rgba(163,163,163,0.12)',text: '#a3a3a3', dot: '#737373' },
  cancelled: { bg: 'rgba(163,163,163,0.08)',text: '#737373', dot: '#525252' },
};

const StatusBadge = styled.span<{ $status: keyof typeof statusColors }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: ${radius.sm};
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.medium};
  background: ${({ $status }) => statusColors[$status].bg};
  color: ${({ $status }) => statusColors[$status].text};
  text-transform: capitalize;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $status }) => statusColors[$status].dot};
    
    ${({ $status }) => $status === 'running' && `
      animation: pulse 2s ease-in-out infinite;
    `}
  }
`;
```

### 6.3 按钮层级

| 层级 | 用途 | 样式 |
|------|------|------|
| **Primary** | 主要操作（创建、提交） | 背景 #6366f1，白色文字，hover 加深 |
| **Secondary** | 次要操作（取消、返回） | 透明背景，边框 rgba(255,255,255,0.1) |
| **Ghost** | 最低层级（过滤、排序） | 无边框无背景，hover 显示背景 |
| **Danger** | 危险操作（删除） | 背景 #ef4444，hover 加深 |
| **Link** | 导航类操作 | 无边框无背景，文字颜色 #818cf8 |

### 6.4 表格规范

- 表头背景：#1a1a1a
- 表头文字：#a3a3a3，12px，Medium
- 行高：48px（每行）
- 边框：仅水平分割线，颜色 rgba(255,255,255,0.04)
- Hover：背景 rgba(255,255,255,0.02)
- Sticky 表头
- 斑马纹：不使用（暗色主题下效果差）

### 6.5 表单规范

- 标签：13px，#a3a3a3，在输入框上方
- 输入框高度：36px
- 输入框背景：#141414
- 输入框边框：rgba(255,255,255,0.06)
- Focus 边框：#6366f1 + 外发光 rgba(99,102,241,0.15)
- 错误状态：边框 #ef4444
- 表单间距：24px（垂直）

---

## 7. 暗色/浅色主题

### 7.1 默认暗色主题

当前以暗色主题为默认。所有规范中的颜色值都是暗色主题的值。

### 7.2 浅色主题（预留）

```typescript
// src/styles/tokens/light-colors.ts
// 
// 迁移到浅色主题时，覆盖以下 token：
//
// background:      #ffffff
// surface:         #ffffff
// surfaceRaised:   #f5f5f5
// border:          rgba(0,0,0,0.06)
// borderHover:     rgba(0,0,0,0.10)
// textPrimary:     #0a0a0a
// textSecondary:   #525252
// textMuted:       #a3a3a3
// primary:         #4f46e5 (更深一点，保证白色背景对比度)
//
// 原则：不是简单的颜色反转，而是保持层次关系不变
```

---

## 8. Agent 开发约束

### 8.1 强制规则

| 规则 | 说明 |
|------|------|
| **必须使用 Design Token** | 不允许硬编码颜色值（`#333`）、间距值（`padding: 13px`） |
| **必须使用 Ant Design 组件** | 优先用 antd 组件，自定义组件用 styled-components |
| **必须有 Hover 状态** | 所有可交互元素必须有 hover/focus/active 状态 |
| **必须有 Loading 状态** | 数据加载时显示 Skeleton 或 Spin |
| **必须有 Empty 状态** | 列表无数据时显示 Empty 组件 |
| **必须有 Error 状态** | 数据加载失败时显示错误信息和重试按钮 |
| **组件必须抽离** | 超过 200 行的组件必须拆分 |

### 8.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase.tsx | `TaskCard.tsx` |
| 样式组件 | PascalCase | `const StyledCard = styled.div\`...\`` |
| Token 文件 | kebab-case.ts | `color.ts`, `spacing.ts` |
| 页面组件 | PascalCase + Page 后缀 | `TaskCenterPage.tsx` |
| 布局组件 | PascalCase + Layout 后缀 | `MainLayout.tsx` |

### 8.3 常见错误

```typescript
// ❌ 错误：硬编码颜色
<div style={{ color: '#333', padding: '10px' }}>Hello</div>

// ✅ 正确：使用 Design Token
const StyledDiv = styled.div`
  color: ${colors.text.primary};
  padding: ${spacing[2]} ${spacing[3]};
`;

// ❌ 错误：不处理 loading 状态
const data = await fetchData();
return <Table data={data} />;

// ✅ 正确：处理 loading + error + empty
const { data, isLoading, error } = useQuery('tasks', fetchTasks);
if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
if (error) return <ErrorBlock onRetry={refetch} />;
if (!data?.length) return <Empty description="暂无任务" />;
return <Table data={data} />;

// ❌ 错误：随意间距
<div style={{ marginBottom: '23px' }}>  // 不是 4 的倍数

// ✅ 正确：使用间距 token
<div style={{ marginBottom: spacing[6] }}>  // 24px
```

---

## 9. 参考资源

| 资源 | 链接 | 用途 |
|------|------|------|
| Linear 设计系统 | https://linear.app | 整体风格参考 |
| Vercel Dashboard | https://vercel.com/dashboard | 布局和数据展示参考 |
| Radix Colors | https://www.radix-ui.com/colors | 颜色系统参考 |
| Ant Design Token | https://ant.design/docs/theme | Token 覆盖参考 |
| Shadcn/ui | https://ui.shadcn.com | 组件设计参考 |
| Tailwind Colors | https://tailwindcss.com/docs/customizing-colors | 调色板参考 |
| Google Fonts - Inter | https://fonts.google.com/specimen/Inter | 主字体 |
| JetBrains Mono | https://www.jetbrains.com/lp/mono | 等宽字体 |

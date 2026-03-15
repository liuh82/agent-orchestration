/**
 * 间距系统
 *
 * 基准单位：4px（Tailwind 标准）
 * 所有间距必须是 4px 的倍数
 */

export const spacing = {
  // 基础间距
  0:  '0px',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',

  // 语义化间距
  gap: {
    xs:  '4px',
    sm:  '8px',
    md:  '16px',
    lg:  '24px',
    xl:  '32px',
    xxl: '48px',
  },

  // 布局
  layout: {
    contentMaxWidth:   '1400px',
    sidebarWidth:      '240px',
    sidebarCollapsed:  '64px',
    headerHeight:      '56px',
    pagePadding:       '24px',
  },
};

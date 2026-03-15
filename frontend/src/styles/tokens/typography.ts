/**
 * 字体系统
 *
 * 主字体：Inter（Google Fonts，专为屏幕阅读设计）
 * 等宽字体：JetBrains Mono（代码展示）
 */

export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
  },

  fontSize: {
    xs:   '11px',
    sm:   '12px',
    base: '14px',
    md:   '15px',
    lg:   '16px',
    xl:   '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '30px',
  },

  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  lineHeight: {
    tight:    1.25,
    normal:   1.5,
    relaxed:  1.75,
  },

  letterSpacing: {
    tight:   '-0.01em',
    normal:  '0',
    wide:    '0.02em',
    widest:  '0.05em',
  },
};

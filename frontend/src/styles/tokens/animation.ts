/**
 * 动画系统
 */

export const animation = {
  duration: {
    instant: '0ms',
    fast:    '100ms',
    normal:  '150ms',
    slow:    '300ms',
    enter:   '200ms',
    exit:    '150ms',
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    enter:   'cubic-bezier(0, 0, 0.2, 1)',
    exit:    'cubic-bezier(0.4, 0, 1, 1)',
    bounce:  'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

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

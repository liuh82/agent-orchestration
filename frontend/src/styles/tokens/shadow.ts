/**
 * 阴影系统
 *
 * 层次设计原则：
 * 层级 0（基础层）：背景 #0a0a0a
 * 层级 1（内容层）：卡片/面板 #141414，边框 rgba(255,255,255,0.06)
 * 层级 2（浮动层）：Dropdown #1a1a1a，shadow-md
 * 层级 3（模态层）：Modal #1a1a1a，shadow-xl
 *
 * 主要依靠背景色差 + 微弱边框区分层次，阴影仅用于弹出层和模态层
 */

export const shadow = {
  none: 'none',
  sm:   '0 1px 2px rgba(0,0,0,0.2)',
  md:   '0 4px 12px rgba(0,0,0,0.3)',
  lg:   '0 8px 24px rgba(0,0,0,0.4)',
  xl:   '0 16px 48px rgba(0,0,0,0.5)',
  glow: '0 0 0 1px rgba(99,102,241,0.2), 0 0 20px rgba(99,102,241,0.1)',
};

/**
 * 前端应用常量配置
 */

// 轮询间隔（毫秒）
export const POLL_INTERVALS = {
  DEFAULT: 30000,  // 默认30秒
  SHORT: 10000,     // 短间隔10秒（开发调试用）
  LONG: 60000,      // 长间隔60秒
} as const;

// 页面特定配置
export const PAGE_CONFIG = {
  HEARTBEATS: {
    POLL_INTERVAL: POLL_INTERVALS.DEFAULT, // 心跳页面轮询间隔
  },
  APPROVALS: {
    POLL_INTERVAL: POLL_INTERVALS.DEFAULT, // 审批页面轮询间隔
  },
  TASKS: {
    POLL_INTERVAL: POLL_INTERVALS.DEFAULT, // 任务页面轮询间隔
  },
} as const;

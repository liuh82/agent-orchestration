import api from './client';

export const dashboardApi = {
  /** 获取个人统计 */
  getPersonalStats: () =>
    api.get('/v1/stats/personal') as Promise<any>,

  /** 获取全局统计 (admin) */
  getGlobalStats: () =>
    api.get('/v1/stats/global') as Promise<any>,

  /** 获取最近任务 */
  getRecentTasks: () =>
    api.get('/v1/stats/recent-tasks') as Promise<any>,

  /** 获取布局方案列表 */
  getLayouts: (scope: string) =>
    api.get(`/dashboard/layouts?scope=${scope}`) as Promise<any>,

  /** 保存布局方案 */
  saveLayout: (data: { scope: string; name: string; is_default: boolean; layout: unknown }) =>
    api.post('/dashboard/layouts', data) as Promise<any>,

  /** 删除布局方案 */
  deleteLayout: (id: string) =>
    api.delete(`/dashboard/layouts/${id}`) as Promise<any>,
};

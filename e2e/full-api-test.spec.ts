import { test, expect, request } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://127.0.0.1:9443';
const API = 'http://127.0.0.1:8082';
const results: { page: string; action: string; method: string; url: string; status: number; error?: string }[] = [];

let token = '';
let csrfToken = '';

async function apiCall(method: string, url: string, body?: any, headers?: Record<string, string>) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  
  const opts: any = { method, headers: { ...h } };
  if (body) opts.body = JSON.stringify(body);
  
  const resp = await fetch(`${API}${url}`, opts);
  let data;
  try { data = await resp.json(); } catch { data = null; }
  return { status: resp.status, data, ok: resp.ok };
}

// ===== 前后端全接口测试 =====
test.describe('全接口回归测试', () => {

  test('1. 登录 POST /api/auth/login', async () => {
    const r = await apiCall('POST', '/api/auth/login', { email: 'admin@example.com', password: 'Admin@2026' });
    results.push({ page: '认证', action: '登录', method: 'POST', url: '/api/auth/login', status: r.status, error: r.data?.detail });
    expect(r.status).toBe(200);
    expect(r.data?.code).toBe(0);
    token = r.data.data.access_token;
  });

  test('2. GET /api/auth/me', async () => {
    const r = await apiCall('GET', '/api/auth/me');
    results.push({ page: '认证', action: '用户信息', method: 'GET', url: '/api/auth/me', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
    expect(r.data?.data?.role).toBe('admin');
  });

  test('3. GET /api/v1/auth/me (v1路径)', async () => {
    const r = await apiCall('GET', '/api/v1/auth/me');
    results.push({ page: '认证', action: 'v1用户信息', method: 'GET', url: '/api/v1/auth/me', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== Dashboard =====
  test('4. GET /api/v1/stats/dashboard', async () => {
    const r = await apiCall('GET', '/api/v1/stats/dashboard');
    results.push({ page: 'Dashboard', action: '统计', method: 'GET', url: '/api/v1/stats/dashboard', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('5. GET /api/v1/stats/global (后台全局统计)', async () => {
    const r = await apiCall('GET', '/api/v1/stats/global');
    results.push({ page: '后台首页', action: '全局统计', method: 'GET', url: '/api/v1/stats/global', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== 项目 =====
  test('6. GET /api/v1/projects', async () => {
    const r = await apiCall('GET', '/api/v1/projects');
    results.push({ page: '项目', action: '项目列表', method: 'GET', url: '/api/v1/projects', status: r.status, error: r.data?.detail });
    expect([200, 307]).toContain(r.status);
  });

  test('7. POST /api/v1/projects (创建项目)', async () => {
    const r = await apiCall('POST', '/api/v1/projects', { name: 'Test Project', description: 'test' });
    results.push({ page: '项目', action: '创建项目', method: 'POST', url: '/api/v1/projects', status: r.status, error: typeof r.data === 'string' ? null : r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== 任务 =====
  test('8. GET /api/v1/tasks', async () => {
    const r = await apiCall('GET', '/api/v1/tasks');
    results.push({ page: '任务', action: '任务列表v1', method: 'GET', url: '/api/v1/tasks', status: r.status, error: r.data?.detail });
    expect([200, 307]).toContain(r.status);
  });

  test('9. GET /api/tasks/', async () => {
    const r = await apiCall('GET', '/api/tasks/');
    results.push({ page: '任务', action: '任务列表', method: 'GET', url: '/api/tasks/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('10. POST /api/tasks/ (创建任务)', async () => {
    const r = await apiCall('POST', '/api/tasks/', { title: 'Test Task', description: 'test task' });
    results.push({ page: '任务', action: '创建任务', method: 'POST', url: '/api/tasks/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('11. GET /api/tasks/{id}/logs (任务日志)', async () => {
    const r = await apiCall('GET', '/api/tasks/test-nonexistent/logs');
    results.push({ page: '任务', action: '任务日志', method: 'GET', url: '/api/tasks/{id}/logs', status: r.status, error: r.data?.detail });
    // 404 is acceptable for non-existent task, 500 is not
    expect(r.status).not.toBe(500);
  });

  // ===== 工作流 =====
  test('12. GET /api/workflows/', async () => {
    const r = await apiCall('GET', '/api/workflows/');
    results.push({ page: '工作流', action: '工作流列表', method: 'GET', url: '/api/workflows/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('13. GET /api/v1/workflows', async () => {
    const r = await apiCall('GET', '/api/v1/workflows');
    results.push({ page: '工作流', action: '工作流列表v1', method: 'GET', url: '/api/v1/workflows', status: r.status, error: r.data?.detail });
    expect([200, 307]).toContain(r.status);
  });

  test('14. GET /api/workflows/templates (模板列表)', async () => {
    const r = await apiCall('GET', '/api/workflows/templates');
    results.push({ page: '工作流', action: '模板列表', method: 'GET', url: '/api/workflows/templates', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('15. POST /api/workflows/ (创建工作流)', async () => {
    const r = await apiCall('POST', '/api/workflows/', { name: 'test-wf', description: 'test', steps: [] });
    results.push({ page: '工作流', action: '创建工作流', method: 'POST', url: '/api/workflows/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('16. POST /api/workflows/templates (创建模板)', async () => {
    const r = await apiCall('POST', '/api/workflows/templates', { name: 'test-tpl', description: 'test' });
    results.push({ page: '工作流', action: '创建模板', method: 'POST', url: '/api/workflows/templates', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== Agent =====
  test('17. GET /api/v1/agents', async () => {
    const r = await apiCall('GET', '/api/v1/agents');
    results.push({ page: 'Agent', action: 'Agent列表v1', method: 'GET', url: '/api/v1/agents', status: r.status, error: r.data?.detail });
    expect([200, 307]).toContain(r.status);
  });

  test('18. GET /api/agents/', async () => {
    const r = await apiCall('GET', '/api/agents/');
    results.push({ page: 'Agent', action: 'Agent列表', method: 'GET', url: '/api/agents/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('19. GET /api/v1/agent-types', async () => {
    const r = await apiCall('GET', '/api/v1/agent-types');
    results.push({ page: 'Agent', action: '类型列表v1', method: 'GET', url: '/api/v1/agent-types', status: r.status, error: r.data?.detail });
    expect([200, 307]).toContain(r.status);
  });

  test('20. GET /api/agent-types/', async () => {
    const r = await apiCall('GET', '/api/agent-types/');
    results.push({ page: 'Agent', action: '类型列表', method: 'GET', url: '/api/agent-types/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('21. GET /api/v1/agents/types/ (公开类型)', async () => {
    const r = await apiCall('GET', '/api/v1/agents/types/');
    results.push({ page: 'Agent', action: '公开类型', method: 'GET', url: '/api/v1/agents/types/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('22. POST /api/agents/ (创建Agent)', async () => {
    const r = await apiCall('POST', '/api/agents/', { name: 'Test Agent', agent_type_id: 'type-cc' });
    results.push({ page: 'Agent', action: '创建Agent', method: 'POST', url: '/api/agents/', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== 后台管理 =====
  test('23. GET /api/v1/admin/users', async () => {
    const r = await apiCall('GET', '/api/v1/admin/users');
    results.push({ page: '后台-用户管理', action: '用户列表', method: 'GET', url: '/api/v1/admin/users', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('24. GET /api/v1/admin/agent-types', async () => {
    const r = await apiCall('GET', '/api/v1/admin/agent-types');
    results.push({ page: '后台-Agent类型', action: '类型列表', method: 'GET', url: '/api/v1/admin/agent-types', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('25. GET /api/v1/admin/settings', async () => {
    const r = await apiCall('GET', '/api/v1/admin/settings');
    results.push({ page: '后台-系统设置', action: '获取设置', method: 'GET', url: '/api/v1/admin/settings', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('26. PUT /api/v1/admin/settings (保存设置)', async () => {
    const r = await apiCall('PUT', '/api/v1/admin/settings', { settings: { site_name: 'Nexus' } });
    results.push({ page: '后台-系统设置', action: '保存设置', method: 'PUT', url: '/api/v1/admin/settings', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  test('27. GET /api/v1/notifications/channels', async () => {
    const r = await apiCall('GET', '/api/v1/notifications/channels');
    results.push({ page: '后台-通知', action: '通知渠道', method: 'GET', url: '/api/v1/notifications/channels', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== Gateway =====
  test('28. GET /api/gateway/bridges', async () => {
    const r = await apiCall('GET', '/api/gateway/bridges', undefined, { 'X-API-Key': 'nexus-admin-key-2024' });
    results.push({ page: '后台-Gateway', action: 'Bridge列表', method: 'GET', url: '/api/gateway/bridges', status: r.status, error: r.data?.detail });
    expect(r.ok).toBeTruthy();
  });

  // ===== 前端页面 =====
  const pages = [
    ['/login', '登录页'],
    ['/', 'Dashboard'],
    ['/tasks', '任务中心'],
    ['/workflows', '工作流'],
    ['/settings', '设置'],
    ['/admin', '后台首页'],
    ['/admin/gateway', 'Gateway管理'],
    ['/admin/agents', '代理中心'],
    ['/admin/agents/new', '创建代理'],
    ['/admin/users', '用户管理'],
    ['/admin/agent-types', 'Agent类型'],
    ['/admin/settings', '系统设置'],
    ['/admin/notifications', '通知配置'],
    ['/admin/stats', '全局统计'],
  ];

  for (let i = 0; i < pages.length; i++) {
    const [path, name] = pages[i];
    test(`${29 + i}. GET ${path} (${name})`, async ({ request }) => {
      const resp = await request.get(`${BASE}${path}`);
      const body = await resp.text();
      const ok = resp.ok() || resp.status() === 307 || body.length > 500;
      results.push({ page: `页面-${name}`, action: '页面渲染', method: 'GET', url: path, status: resp.status(), error: ok ? undefined : `HTTP ${resp.status()}, ${body.length}B` });
      expect(ok).toBeTruthy();
    });
  }
});

// 输出报告
test.afterAll(async () => {
  const pass = results.filter(r => r.status >= 200 && r.status < 400 && !r.error).length;
  const fail = results.length - pass;
  
  let report = `# 全接口回归测试报告\n\n`;
  report += `时间: ${new Date().toISOString()}\n`;
  report += `总计: ${results.length} | 通过: ${pass} | 失败: ${fail}\n\n`;
  report += `| # | 页面 | 操作 | 方法 | URL | 状态 | 错误 |\n`;
  report += `|---|------|------|------|-----|------|------|\n`;
  
  results.forEach((r, i) => {
    const ok = r.status >= 200 && r.status < 400 && !r.error;
    report += `| ${i + 1} | ${r.page} | ${r.action} | ${r.method} | ${r.url} | ${r.status} | ${ok ? '✅' : '❌ ' + (r.error || '')} |\n`;
  });
  
  const failures = results.filter(r => r.status >= 400 || r.status < 200 || r.error);
  if (failures.length > 0) {
    report += `\n## 失败项汇总\n\n`;
    failures.forEach(r => {
      report += `### ${r.page} - ${r.action}\n`;
      report += `- URL: ${r.method} ${r.url}\n`;
      report += `- 状态: ${r.status}\n`;
      report += `- 错误: ${r.error || '未知'}\n\n`;
    });
  }
  
  fs.writeFileSync('/root/.openclaw/workspace/agent-orchestration/docs/test-report-full.md', report);
  console.log('\n' + report);
});

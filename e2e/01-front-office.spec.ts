import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = '../docs/screenshots';
const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
});

// Helper
async function login(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]', email);
  await page.fill('input[type="password"], input[placeholder*="密码"], input[placeholder*="password"]', password);
  await page.click('button[type="submit"], button:has-text("登录"), button:has-text("Login")');
  await page.waitForTimeout(2000);
}

test('01 - 登录页', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.waitForURL('**/', { timeout: 5000 }).catch(() => {});
  const url = page.url();
  const pass = !url.includes('/login');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png`, fullPage: true });
  expect(pass, `Should redirect from login, got ${url}`).toBeTruthy();
});

test('02 - Dashboard', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-dashboard.png`, fullPage: true });
  const body = await page.textContent('body');
  expect(body.length > 50, 'Dashboard should render content').toBeTruthy();
});

test('03 - 项目列表', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Click 项目 in sidebar
  const projLink = page.locator('text=项目').first();
  if (await projLink.isVisible()) await projLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-projects.png`, fullPage: true });
  const body = await page.textContent('body');
  expect(body.length > 50, 'Projects page should render').toBeTruthy();
});

test('04 - 项目详情', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const projLink = page.locator('text=项目').first();
  if (await projLink.isVisible()) await projLink.click();
  await page.waitForTimeout(1500);
  // Click first project card
  const firstCard = page.locator('.ant-card, [class*="project"], [class*="card"]').first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-project-detail.png`, fullPage: true });
});

test('05 - 任务中心', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const taskLink = page.locator('text=任务中心').first();
  if (await taskLink.isVisible()) await taskLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-tasks.png`, fullPage: true });
  const body = await page.textContent('body');
  expect(body.length > 50, 'Tasks page should render').toBeTruthy();
});

test('06 - 任务创建弹窗', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const taskLink = page.locator('text=任务中心').first();
  if (await taskLink.isVisible()) await taskLink.click();
  await page.waitForTimeout(1500);
  const createBtn = page.locator('text=创建任务, button:has-text("创建"), button:has-text("新建")').first();
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-task-create.png`, fullPage: true });
  // Check modal has key fields
  const body = await page.textContent('body');
  const hasName = body.includes('名称') || body.includes('Name');
  expect(hasName, 'Create task modal should have name field').toBeTruthy();
});

test('07 - 任务详情', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const taskLink = page.locator('text=任务中心').first();
  if (await taskLink.isVisible()) await taskLink.click();
  await page.waitForTimeout(1500);
  // Click first task row
  const firstRow = page.locator('tr, [class*="task-item"], [class*="row"]').first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-task-detail.png`, fullPage: true });
});

test('08 - 工作流', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const wfLink = page.locator('text=工作流').first();
  if (await wfLink.isVisible()) await wfLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-workflows.png`, fullPage: true });
  const body = await page.textContent('body');
  // Check for tabs
  const hasTabs = body.includes('工作流') || body.includes('模板') || body.includes('编辑');
  expect(hasTabs, 'Workflows page should have tabs').toBeTruthy();
});

test('09 - 设置', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const settingsLink = page.locator('text=设置').first();
  if (await settingsLink.isVisible()) await settingsLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-settings.png`, fullPage: true });
});

test('10 - 后台管理入口', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin@2026');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/10-admin-entry.png`, fullPage: true });
  const body = await page.textContent('body');
  const hasAdmin = body.includes('后台管理');
  expect(hasAdmin, 'Sidebar should have admin entry').toBeTruthy();
});

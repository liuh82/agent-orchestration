import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = '../docs/screenshots';

async function login(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[placeholder*="邮箱"]', 'admin@example.com');
  await page.fill('input[type="password"], input[placeholder*="密码"]', 'Admin@2026');
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForTimeout(2000);
}

test('11 - 进入后台', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const adminBtn = page.locator('text=后台管理').first();
  if (await adminBtn.isVisible()) await adminBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/11-admin-dashboard.png`, fullPage: true });
  const url = page.url();
  expect(url, 'Should be on /admin').toContain('/admin');
});

test('12 - 后台首页统计', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/12-admin-home.png`, fullPage: true });
  const body = await page.textContent('body');
  expect(body.length > 50, 'Admin home should render').toBeTruthy();
});

test('13 - Gateway 管理', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const gwLink = page.locator('text=Gateway 管理').first();
  if (await gwLink.isVisible()) await gwLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/13-gateway.png`, fullPage: true });
});

test('14 - 代理中心', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const agentLink = page.locator('text=代理中心').first();
  if (await agentLink.isVisible()) await agentLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/14-agents.png`, fullPage: true });
  const body = await page.textContent('body');
  const hasCreate = body.includes('创建代理') || body.includes('新建');
  expect(hasCreate, 'Agent list should have create button').toBeTruthy();
});

test('15 - 创建代理-选择类型', async ({ page }) => {
  await login(page);
  await page.goto('/admin/agents');
  await page.waitForLoadState('networkidle');
  const createBtn = page.locator('text=创建代理, button:has-text("创建"), button:has-text("新建")').first();
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/15-agent-create-type.png`, fullPage: true });
  const body = await page.textContent('body');
  const hasClaude = body.includes('Claude Code');
  const hasCodex = body.includes('Codex');
  expect(hasClaude && hasCodex, 'Should show Claude Code and Codex type cards').toBeTruthy();
});

test('16 - 创建代理-配置', async ({ page }) => {
  await login(page);
  await page.goto('/admin/agents/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  // Select first type card
  const typeCard = page.locator('[class*="type-card"], [class*="TypeCard"], .ant-card').first();
  if (await typeCard.isVisible()) {
    await typeCard.click();
    await page.waitForTimeout(500);
  }
  // Click next
  const nextBtn = page.locator('button:has-text("下一步"), button:has-text("Next")').first();
  if (await nextBtn.isVisible()) await nextBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/16-agent-create-config.png`, fullPage: true });
  // Check no bridge_url field
  const body = await page.textContent('body');
  const hasBridgeUrl = body.includes('连接地址') || body.includes('bridge_url');
  expect(!hasBridgeUrl, 'Should NOT have bridge_url/connection field').toBeTruthy();
});

test('17 - 创建代理-确认', async ({ page }) => {
  await login(page);
  await page.goto('/admin/agents/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  // Select type
  const typeCard = page.locator('[class*="type-card"], [class*="TypeCard"], .ant-card').first();
  if (await typeCard.isVisible()) await typeCard.click();
  await page.waitForTimeout(500);
  // Next to config
  const nextBtn = page.locator('button:has-text("下一步"), button:has-text("Next")').first();
  if (await nextBtn.isVisible()) await nextBtn.click();
  await page.waitForTimeout(1500);
  // Fill name
  const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="name"]').first();
  if (await nameInput.isVisible()) await nameInput.fill('Test Agent Playwright');
  // Next to confirm
  const nextBtn2 = page.locator('button:has-text("下一步"), button:has-text("Next")').first();
  if (await nextBtn2.isVisible()) await nextBtn2.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/17-agent-create-confirm.png`, fullPage: true });
});

test('18 - Agent 类型', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const typeLink = page.locator('text=Agent 类型').first();
  if (await typeLink.isVisible()) await typeLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/18-agent-types.png`, fullPage: true });
});

test('19 - 用户管理', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const userLink = page.locator('text=用户管理').first();
  if (await userLink.isVisible()) await userLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/19-users.png`, fullPage: true });
  const body = await page.textContent('body');
  const hasRole = body.includes('admin') || body.includes('role') || body.includes('角色');
  expect(hasRole, 'User list should have role info').toBeTruthy();
});

test('20 - 系统设置', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const link = page.locator('text=系统设置').first();
  if (await link.isVisible()) await link.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/20-system-settings.png`, fullPage: true });
});

test('21 - 通知配置', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const link = page.locator('text=通知配置').first();
  if (await link.isVisible()) await link.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/21-notifications.png`, fullPage: true });
});

test('22 - 全局统计', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const link = page.locator('text=全局统计').first();
  if (await link.isVisible()) await link.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/22-global-stats.png`, fullPage: true });
});

test('23 - 返回前台', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  // Look for back/return button
  const backBtn = page.locator('button:has-text("返回"), a:has-text("返回"), [aria-label="back"]').first();
  if (await backBtn.isVisible()) {
    await backBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/23-return-front.png`, fullPage: true });
});

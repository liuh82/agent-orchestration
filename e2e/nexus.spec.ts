import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin@2026';
const USER_EMAIL = 'test@test.com';
const USER_PASSWORD = 'Test@2026';
const BASE = 'http://127.0.0.1:9443';

// 点击 Ant Design 菜单项（前台和后台都用 li[role="menuitem"]）
async function clickMenuItem(page: Page, text: string) {
  await page.locator('li[role="menuitem"]').filter({ hasText: new RegExp(text, 'i') }).click();
  await page.waitForTimeout(1500);
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

async function loginAsUser(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', USER_EMAIL);
  await page.fill('#password', USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

async function gotoAdmin(page: Page) {
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================================
// 前台页面（admin）#1-11
// ============================================================

test('1. 登录页', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
  expect(page.url()).not.toContain('/login');
  await page.screenshot({ path: 'docs/screenshots/01-login.png', fullPage: true });
});

test('2. Dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await page.screenshot({ path: 'docs/screenshots/02-dashboard.png', fullPage: true });
});

test('3. 项目列表', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '项目');
  await page.screenshot({ path: 'docs/screenshots/03-project-list.png', fullPage: true });
});

test('4. 项目详情', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '项目');
  await page.waitForTimeout(1000);
  const card = page.locator('[class*="card"], [class*="project"]').first();
  if (await card.count() > 0) await card.click();
  await page.screenshot({ path: 'docs/screenshots/04-project-detail.png', fullPage: true });
});

test('5. 任务中心', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '任务');
  await page.screenshot({ path: 'docs/screenshots/05-task-center.png', fullPage: true });
});

test('6. 任务创建弹窗', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '任务');
  const createBtn = page.locator('button').filter({ hasText: /创建|新建/i }).first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'docs/screenshots/06-task-create-modal.png', fullPage: true });
});

test('7. 任务详情', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '任务');
  const row = page.locator('tr, [class*="row"], [class*="item"]').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'docs/screenshots/07-task-detail.png', fullPage: true });
});

test('8. 工作流', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '工作流');
  await page.screenshot({ path: 'docs/screenshots/08-workflow.png', fullPage: true });
});

test('9. 个人设置', async ({ page }) => {
  await loginAsAdmin(page);
  await clickMenuItem(page, '设置');
  await page.screenshot({ path: 'docs/screenshots/09-settings.png', fullPage: true });
});

test('10. 前台侧边栏菜单完整性', async ({ page }) => {
  await loginAsAdmin(page);
  const items = page.locator('li[role="menuitem"]');
  const texts = await items.allTextContents();
  // 前台应有 Dashboard、项目、任务中心、工作流、设置、帮助
  expect(texts.some(t => /Dashboard/i.test(t))).toBe(true);
  expect(texts.some(t => /项目/i.test(t))).toBe(true);
  expect(texts.some(t => /任务中心/i.test(t))).toBe(true);
  expect(texts.some(t => /工作流/i.test(t))).toBe(true);
  expect(texts.some(t => /设置/i.test(t))).toBe(true);
  // 前台不应有后台管理菜单
  expect(texts.some(t => /用户管理|代理中心|Gateway|通知配置|系统设置/i.test(t))).toBe(false);
  await page.screenshot({ path: 'docs/screenshots/10-sidebar-check.png', fullPage: true });
});

test('11. 前台无代理中心', async ({ page }) => {
  await loginAsAdmin(page);
  const proxyLinks = page.locator('li[role="menuitem"]').filter({ hasText: /代理中心|bridge/i });
  await expect(proxyLinks).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/11-no-proxy-center.png', fullPage: true });
});

// ============================================================
// 后台页面（admin）#12-23
// ============================================================

test('12. 进入后台', async ({ page }) => {
  await gotoAdmin(page);
  // 应有"返回前台"按钮
  const backBtn = page.locator('button').filter({ hasText: /返回前台/i });
  expect(await backBtn.count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'docs/screenshots/12-admin-page.png', fullPage: true });
});

test('13. 后台首页（管理概览）', async ({ page }) => {
  await gotoAdmin(page);
  // 默认选中"管理概览"
  const selected = page.locator('li.ant-menu-item-selected');
  expect(await selected.count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'docs/screenshots/13-admin-dashboard.png', fullPage: true });
});

test('14. Gateway 管理', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, 'Gateway');
  await page.screenshot({ path: 'docs/screenshots/14-gateway-management.png', fullPage: true });
});

test('15. 代理中心', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '代理中心');
  await page.screenshot({ path: 'docs/screenshots/15-proxy-center.png', fullPage: true });
});

test('16. 创建代理-选择类型', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '代理中心');
  const createBtn = page.locator('button').filter({ hasText: /创建|新建|添加/i }).first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'docs/screenshots/16-proxy-type-select.png', fullPage: true });
});

test('17. 创建代理-配置表单', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '代理中心');
  const createBtn = page.locator('button').filter({ hasText: /创建|新建|添加/i }).first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1000);
    const typeCard = page.locator('[class*="card"], [class*="type"]').first();
    if (await typeCard.count() > 0) await typeCard.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'docs/screenshots/17-proxy-config-form.png', fullPage: true });
});

test('18. 用户管理', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '用户管理');
  await page.screenshot({ path: 'docs/screenshots/18-user-management.png', fullPage: true });
});

test('19. 系统设置', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '系统设置');
  await page.screenshot({ path: 'docs/screenshots/19-system-settings.png', fullPage: true });
});

test('20. 通知配置', async ({ page }) => {
  await gotoAdmin(page);
  await clickMenuItem(page, '通知配置');
  await page.screenshot({ path: 'docs/screenshots/20-notification-config.png', fullPage: true });
});

test('21. 返回前台', async ({ page }) => {
  await gotoAdmin(page);
  const backBtn = page.locator('button').filter({ hasText: /返回前台/i });
  if (await backBtn.count() > 0) {
    await backBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'docs/screenshots/21-back-to-front.png', fullPage: true });
});

// ============================================================
// 权限验证（普通用户）#22-26
// ============================================================

test('22. 登录普通用户', async ({ page }) => {
  await loginAsUser(page);
  expect(page.url()).not.toContain('/login');
  await page.screenshot({ path: 'docs/screenshots/22-user-login.png', fullPage: true });
});

test('23. 普通用户进入后台', async ({ page }) => {
  await loginAsUser(page);
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'docs/screenshots/23-user-admin-access.png', fullPage: true });
});

test('24. 普通用户后台菜单过滤', async ({ page }) => {
  await loginAsUser(page);
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const allItems = page.locator('li[role="menuitem"]');
  const texts = await allItems.allTextContents();
  // 普通用户不应看到用户管理、系统设置
  const hasUserMgmt = texts.some(t => /用户管理/i.test(t));
  const hasSysSettings = texts.some(t => /系统设置/i.test(t));
  expect(hasUserMgmt).toBe(false);
  expect(hasSysSettings).toBe(false);
  await page.screenshot({ path: 'docs/screenshots/24-user-menu-filter.png', fullPage: true });
});

// ============================================================
// 样式检查 #25-29
// ============================================================

test('25. 前台无暗色', async ({ page }) => {
  await loginAsAdmin(page);
  const bgColor = await page.evaluate(() => ({
    body: window.getComputedStyle(document.body).backgroundColor,
    html: window.getComputedStyle(document.documentElement).backgroundColor,
  }));
  expect(bgColor.body).not.toBe('rgb(0, 0, 0)');
  expect(bgColor.html).not.toBe('rgb(0, 0, 0)');
  await page.screenshot({ path: 'docs/screenshots/25-front-no-dark.png', fullPage: true });
});

test('26. 后台暗色主题', async ({ page }) => {
  await gotoAdmin(page);
  const sidebar = await page.evaluate(() => {
    const menu = document.querySelector('.ant-menu-dark');
    return menu ? window.getComputedStyle(menu).backgroundColor : 'not dark menu';
  });
  // 后台侧边栏应为暗色（ant-menu-dark）
  expect(sidebar).not.toBe('not dark menu');
  await page.screenshot({ path: 'docs/screenshots/26-admin-dark-sidebar.png', fullPage: true });
});

test('27. 后台内容区非全黑', async ({ page }) => {
  await gotoAdmin(page);
  const contentBg = await page.evaluate(() => {
    const el = document.querySelector('[class*="content"], main, [class*="main"]') || document.body;
    return window.getComputedStyle(el).backgroundColor;
  });
  expect(contentBg).not.toBe('rgb(0, 0, 0)');
  await page.screenshot({ path: 'docs/screenshots/27-admin-content-bg.png', fullPage: true });
});

test('28. 侧边栏折叠交互', async ({ page }) => {
  await gotoAdmin(page);
  const foldBtn = page.locator('.anticon-menu-fold').first();
  if (await foldBtn.count() > 0) {
    await foldBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'docs/screenshots/28-sidebar-collapsed.png', fullPage: true });
  const unfoldBtn = page.locator('.anticon-menu-unfold').first();
  if (await unfoldBtn.count() > 0) {
    await unfoldBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'docs/screenshots/28-sidebar-expanded.png', fullPage: true });
});

test('29. 页面整体截图对比', async ({ page }) => {
  // 前台 Dashboard
  await loginAsAdmin(page);
  await page.screenshot({ path: 'docs/screenshots/29-front-dashboard.png', fullPage: true });
  // 后台 Dashboard
  await gotoAdmin(page);
  await page.screenshot({ path: 'docs/screenshots/29-admin-dashboard.png', fullPage: true });
});

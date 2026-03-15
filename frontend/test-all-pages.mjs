import { chromium } from 'playwright';

const BASE = 'http://localhost:9443';
const pages = [
  { name: 'Dashboard', path: '/' },
  { name: '项目', path: '/projects' },
  { name: '代理中心', path: '/agents' },
  { name: '设置', path: '/settings' },
];

const results = [];

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(`PAGE:${e.message.substring(0,100)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE:${String(m.text).substring(0,100)}`); });

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('admin@example.com');
    await inputs[1].fill('Admin@2026');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }
  console.log('Token:', (await page.evaluate(() => localStorage.getItem('access_token')))?.substring(0,20) + '...');

  for (const pg of pages) {
    errors.length = 0;
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      const body = await page.innerText('body').catch(() => '');
      const hasContent = body.length > 10;
      const pageErrors = errors.filter(e => !e.includes('ERR_EMPTY_RESPONSE'));
      await page.screenshot({ path: `/tmp/orch-page-${pg.name}.png` });
      results.push({
        page: pg.name,
        status: hasContent && pageErrors.length === 0 ? 'PASS' : 'WARN',
        bodyLen: body.length,
        errors: pageErrors.length,
        preview: body.substring(0, 80).replace(/\n/g, ' '),
      });
    } catch(e) {
      results.push({ page: pg.name, status: 'FAIL', error: e.message.substring(0, 150) });
    }
  }

  await browser.close();
} catch(e) {
  results.push({ page: 'UNEXPECTED', status: 'FAIL', error: e.message });
}

console.log('\n' + '='.repeat(60));
console.log('ALL PAGES TEST');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} ${r.page}: body=${r.bodyLen||'?'} errors=${r.errors||0}`);
  if (r.error) console.log(`   ${r.error}`);
  if (r.preview) console.log(`   "${r.preview}"`);
}

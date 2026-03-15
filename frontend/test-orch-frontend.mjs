import { chromium } from 'playwright';

const BASE = 'http://localhost:9443';
const results = [];

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // === Test 1: Login ===
  results.push({ test: '1. Navigate to login page', status: 'RUN' });
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 });
    results.push({ test: '1. Navigate to login page', status: 'PASS', detail: 'OK' });
  } catch(e) {
    results.push({ test: '1. Navigate to login page', status: 'FAIL', detail: e.message.substring(0, 200) });
  }

  // Screenshot after login page
  await page.screenshot({ path: '/tmp/orch-test-login.png' });
  
  // Check for email input
  const emailInput = await page.$('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]');
  const pwInput = await page.$('input[type="password"]');
  const loginBtn = await page.$('button[type="submit"], button:has-text("登录"), button:has-text("Login")');
  
  results.push({ 
    test: '2. Login form elements exist', 
    status: (emailInput && pwInput && loginBtn) ? 'PASS' : 'FAIL',
    detail: `email=${!!emailInput} pw=${!!pwInput} btn=${!!loginBtn}`
  });

  // Fill and submit login
  if (emailInput && pwInput && loginBtn) {
    results.push({ test: '3. Fill login form', status: 'RUN' });
    try {
      await emailInput.fill('admin@example.com');
      await pwInput.fill('Admin@2026');
      await loginBtn.click();
      await page.waitForURL('**/!**/login**', { timeout: 10000 });
      results.push({ test: '3. Fill login form and submit', status: 'PASS', detail: page.url() });
    } catch(e) {
      results.push({ test: '3. Fill login form and submit', status: 'FAIL', detail: e.message.substring(0, 200) });
    }
  }
  
  await page.screenshot({ path: '/tmp/orch-test-after-login.png' });

  // === Test 4: Dashboard ===
  results.push({ test: '4. Dashboard loaded', status: 'RUN' });
  try {
    await page.waitForTimeout(3000); // Wait for API calls
    const title = await page.title();
    const bodyText = await page.innerText('body').catch(() => '');
    results.push({ 
      test: '4. Dashboard loaded', 
      status: bodyText.includes('Dashboard') || bodyText.includes('Agent') ? 'PASS' : 'FAIL',
      detail: `title="${title}" body_len=${bodyText.length} has_Dashboard=${bodyText.includes('Dashboard')}`
    });
  } catch(e) {
    results.push({ test: '4. Dashboard loaded', status: 'FAIL', detail: e.message.substring(0, 200) });
  }

  await page.screenshot({ path: '/tmp/orch-test-dashboard.png' });

  // === Test 5: Console errors ===
  results.push({ 
    test: '5. Console errors', 
    status: consoleErrors.length === 0 ? 'PASS' : 'FAIL',
    detail: consoleErrors.length > 0 ? consoleErrors.slice(0, 5).join(' | ') : 'None'
  });

  // === Test 6: Page errors ===
  results.push({ 
    test: '6. Runtime errors', 
    status: pageErrors.length === 0 ? 'PASS' : 'FAIL',
    detail: pageErrors.length > 0 ? pageErrors.slice(0, 3).join(' | ') : 'None'
  });

  // === Test 7: API responses ===
  const apiTests = [
    { url: BASE + '/api/v1/stats/dashboard', auth: true, name: 'Dashboard stats' },
    { url: BASE + '/api/agents/', auth: false, name: 'Agents list' },
    { url: BASE + '/api/tasks/', auth: false, name: 'Tasks list' },
  ];

  for (const apiTest of apiTests) {
    let headers = {};
    if (apiTest.auth) {
      // Get token from localStorage
      const token = await page.evaluate(() => localStorage.getItem('access_token'));
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    
    const resp = await page.evaluate(async ({ url, headers }) => {
      try {
        const r = await fetch(url, { headers });
        return { status: r.status, ok: r.ok };
      } catch(e) { return { status: 0, ok: false, error: e.message }; }
    }, { url: apiTest.url, headers });
    
    results.push({ 
      test: `API: ${apiTest.name}`, 
      status: resp.ok ? 'PASS' : 'FAIL',
      detail: `status=${resp.status}`
    });
  }

  await browser.close();
} catch(e) {
  results.push({ test: 'UNEXPECTED', status: 'FAIL', detail: e.message });
}

// Output
console.log('\n' + '='.repeat(60));
console.log('AGENT-ORCHESTRATION FRONTEND TEST REPORT');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '🔄';
  console.log(`${icon} ${r.test}: ${r.status} ${r.detail ? '— ' + r.detail : ''}`);
}
console.log('='.repeat(60));
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
console.log(`Total: ${pass} PASS, ${fail} FAIL`);

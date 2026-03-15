# Playwright E2E 测试任务

## 项目路径
/root/.openclaw/workspace/agent-orchestration

## 任务
在项目根目录创建 Playwright 配置和测试代码，执行全部 29 项测试，输出截图和报告。

## 环境
- Playwright 已安装：1.58.2
- 测试地址：http://81.70.98.45:9443
- Admin 账号：admin@example.com / Admin@2026
- 普通用户：test@test.com / Test@2026（如密码不对跳过）
- Chromium 已安装（npx playwright install chromium 已执行过）

## 步骤

### 1. 创建 playwright.config.ts
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: './docs/screenshots',
  reporter: [['list'], ['json', { outputFile: './docs/test-results.json' }]],
});
```

### 2. 创建 e2e/ 目录，编写测试文件

将以下测试用例拆分为文件：
- `e2e/01-front-office.spec.ts` — 测试 1-10（前台页面）
- `e2e/02-admin-pages.spec.ts` — 测试 11-23（后台页面）
- `e2e/03-permissions.spec.ts` — 测试 24-26（权限验证）
- `e2e/04-style-check.spec.ts` — 测试 27-29（样式检查）

### 3. 测试用例

#### 前台（admin 登录）

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 1 | 登录 | 打开 /login，输入 admin@example.com / Admin@2026，点击登录 | 跳转到 / |
| 2 | Dashboard | 检查首页 | 页面正常渲染，统计卡片有数据，无 JS 错误 |
| 3 | 项目列表 | 点击「项目」 | 项目列表页正常渲染 |
| 4 | 项目详情 | 点击任意项目卡片 | 项目详情页正常加载 |
| 5 | 任务中心 | 点击「任务中心」 | 任务列表页正常渲染，有创建按钮 |
| 6 | 任务创建弹窗 | 点击「创建任务」 | 弹窗打开，表单含：名称、描述、优先级、关联Agent下拉、关联流程下拉 |
| 7 | 任务详情 | 点击任意任务行 | 任务详情页正常加载，有概览和日志 Tab |
| 8 | 工作流 | 点击「工作流」 | 工作流列表渲染，三个 Tab 正常切换 |
| 9 | 设置 | 点击「设置」 | 设置页正常渲染 |
| 10 | 后台管理入口 | 侧边栏底部 | 有「后台管理」入口 |

#### 后台（admin）

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 11 | 进入后台 | 点击「后台管理」 | 跳转到 /admin，浅色主题 |
| 12 | 后台首页 | 检查统计卡片 | 数据正常渲染 |
| 13 | Gateway 管理 | 点击「Gateway 管理」 | Bridge 列表页渲染 |
| 14 | 代理中心 | 点击「代理中心」 | Agent 列表，有创建按钮 |
| 15 | 创建代理-选类型 | 点击「创建代理」 | 类型卡片显示：Claude Code、Codex、OpenCode、OpenClaw |
| 16 | 创建代理-配置 | 选类型，下一步 | 配置表单正常，**无「连接地址」字段** |
| 17 | 创建代理-确认 | 填名称，下一步 | 确认页正常 |
| 18 | Agent 类型 | 点击「Agent 类型」 | 类型列表正常 |
| 19 | 用户管理 | 点击「用户管理」 | 用户列表正常，有 role 列 |
| 20 | 系统设置 | 点击「系统设置」 | 页面正常 |
| 21 | 通知配置 | 点击「通知配置」 | 页面正常 |
| 22 | 全局统计 | 点击「全局统计」 | 页面正常 |
| 23 | 返回前台 | Header 返回按钮 | 跳转到 / |

#### 权限（普通用户 test@test.com）

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 24 | 登录普通用户 | 退出，用 test@test.com 登录 | 登录成功 |
| 25 | 进入后台 | 点击「后台管理」 | 能进入 /admin |
| 26 | 菜单过滤 | 检查后台侧边栏 | 只显示：后台首页、Gateway 管理、代理中心、通知配置；**不显示** Agent 类型、用户管理、系统设置、全局统计 |

#### 样式

| # | 测试项 | 检查 | 预期 |
|---|--------|------|------|
| 27 | 前台无暗色 | 检查所有前台页面 | 无 neutral[950] 纯黑背景 |
| 28 | 后台主题 | 检查后台页面 | Header #334155, Sidebar #1e293b, 内容区 #f5f5f5 |
| 29 | 侧边栏交互 | 收起/展开 | 正常折叠/展开 |

### 4. 截图要求
- 每个测试用例完成后截图，保存到 `docs/screenshots/`
- 文件名：`{序号}-{页面名}.png`
- 使用 `page.screenshot({ fullPage: true })`

### 5. 测试报告
- 输出 `docs/test-report-v5.md`
- Markdown 表格：序号、测试项、状态（PASS/FAIL/SKIP）、备注
- 失败项标注具体错误和浏览器控制台日志
- **只测试，不改代码**

### 6. 执行
```bash
cd /root/.openclaw/workspace/agent-orchestration
npx playwright test --config=playwright.config.ts
```

### 7. 完成后
生成报告，不要修改任何源代码文件。将报告和截图 commit 推送到 GitHub。

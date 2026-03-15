# Agent Orchestrator 第 5 轮验收测试

## 项目路径
/root/.openclaw/workspace/agent-orchestration

## 你的任务
你是 tester，负责编写并执行 Playwright 端到端测试，输出测试报告。**只测试，不改代码**。

## 环境
- Playwright 1.58.2 已全局安装（`npx playwright`）
- 测试目标地址：http://81.70.98.45:9443
- Admin 账号：admin@example.com / Admin@2026
- 普通用户账号：test@test.com / Test@2026（如登录失败则跳过相关测试，标注 SKIP）
- 浏览器：Chromium

## 步骤

### 1. 初始化测试项目
在 `/root/.openclaw/workspace/agent-orchestration` 根目录创建：
- `playwright.config.ts`（baseURL 设为 `http://81.70.98.45:9443`，screenshots 保存到 `docs/screenshots/`，timeout 设为 30000ms）
- `e2e/` 目录，测试文件放这里
- `package.json` 里确保有 `@playwright/test` 依赖（已全局安装，可 link）

### 2. 编写测试用例
按以下 29 项编写自动化测试，每个测试用例截图保存到 `docs/screenshots/{序号}-{页面名}.png`：

#### 前台页面（admin 账号）
| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 1 | 登录页 | 打开 /login，输入 admin@example.com / Admin@2026，点击登录 | 跳转到 / |
| 2 | Dashboard | 检查首页加载 | 页面正常渲染，统计卡片有数据，无 JS 错误 |
| 3 | 项目列表 | 点击侧边栏「项目」 | 项目列表页正常渲染 |
| 4 | 项目详情 | 点击任意项目卡片 | 项目详情页正常加载 |
| 5 | 任务中心 | 点击侧边栏「任务中心」 | 任务列表页正常渲染，有创建任务按钮 |
| 6 | 任务创建弹窗 | 点击「创建任务」按钮 | 弹窗打开，表单包含：名称、描述、优先级、关联Agent下拉、关联流程下拉 |
| 7 | 任务详情 | 点击任意任务行 | 任务详情页正常加载，有概览和日志 Tab |
| 8 | 工作流 | 点击侧边栏「工作流」 | 工作流列表页渲染，三个 Tab 正常切换（工作流/模板库/编辑器） |
| 9 | 个人设置 | 点击侧边栏「设置」 | 设置页面正常渲染 |
| 10 | 后台管理入口 | 检查侧边栏底部 | 有「后台管理」按钮/入口 |
| 11 | 前台无代理中心 | 检查前台侧边栏 | **不应该有**「代理中心」菜单项 |

#### 后台页面（admin 账号）
| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 12 | 进入后台 | 点击「后台管理」或直接访问 /admin | 跳转到 /admin，页面浅色主题 |
| 13 | 后台首页 | 检查统计卡片 | 统计数据正常渲染 |
| 14 | Gateway 管理 | 点击侧边栏「Gateway 管理」 | Bridge 列表页渲染（可能为空，空状态正常） |
| 15 | 代理中心 | 点击侧边栏「代理中心」 | Agent 列表页渲染，有创建代理按钮 |
| 16 | 创建代理-选择类型 | 点击「创建代理」 | 类型卡片显示：Claude Code、Codex、OpenCode、OpenClaw |
| 17 | 创建代理-配置 | 选择类型，点击下一步 | 配置表单正常，**无「连接地址」字段** |
| 18 | Agent 类型 | 点击侧边栏「Agent 类型」 | 类型列表正常渲染 |
| 19 | 用户管理 | 点击侧边栏「用户管理」 | 用户列表正常，有 role 列 |
| 20 | 系统设置 | 点击侧边栏「系统设置」 | 页面正常渲染 |
| 21 | 通知配置 | 点击侧边栏「通知配置」 | 页面正常渲染 |
| 22 | 全局统计 | 点击侧边栏「全局统计」 | 页面正常渲染 |
| 23 | 返回前台 | 点击 Header 返回按钮 | 跳转到 / |

#### 权限验证（普通用户 test@test.com）
| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 24 | 登录普通用户 | 退出，用 test@test.com / Test@2026 登录 | 登录成功 |
| 25 | 进入后台 | 点击「后台管理」或直接访问 /admin | 能进入 /admin，**不被拦截** |
| 26 | 菜单过滤 | 检查后台侧边栏 | 只显示：后台首页、Gateway 管理、代理中心、通知配置；**不显示**：Agent 类型、用户管理、系统设置、全局统计 |

#### 样式检查
| # | 测试项 | 检查 | 预期 |
|---|--------|------|------|
| 27 | 前台无暗色 | 检查所有前台页面 body/容器背景色 | 无 neutral[950] 纯黑背景 |
| 28 | 后台主题 | 检查后台页面 | Header 深色（#334155 附近），Sidebar 深色（#1e293b 附近），内容区浅色 |
| 29 | 侧边栏交互 | 点击收起/展开按钮 | 正常折叠/展开 |

### 3. 执行测试
```bash
cd /root/.openclaw/workspace/agent-orchestration
npx playwright test --config=playwright.config.ts
```

### 4. 输出测试报告
生成 `docs/test-report-v5.md`，格式：
```markdown
# 第 5 轮验收测试报告

## 概要
- 总计：29 项
- 通过：X 项
- 失败：X 项
- 跳过：X 项

## 详细结果

| 序号 | 测试项 | 状态 | 备注 |
|------|--------|------|------|
| 1 | 登录页 | PASS/FAIL/SKIP | ... |
...
```

失败项标注具体错误信息和浏览器控制台日志。

### 5. 提交
```bash
git add playwright.config.ts e2e/ docs/screenshots/ docs/test-report-v5.md
git commit -m "test: 第5轮 Playwright 验收测试（29项）"
git push origin main
```

## 注意事项
1. 截图用 `page.screenshot({ path: 'docs/screenshots/XX-xxx.png', fullPage: true })`
2. 测试之间用独立的 browser context 隔离状态，或必要时重新登录
3. 元素选择器优先用 `data-testid`、`aria-label`、`role`、文本内容，避免脆弱的 class 选择器
4. 某些页面可能加载慢，适当用 `waitForLoadState('networkidle')` 或 `waitForSelector`
5. 如果某个测试一直失败且是环境问题（如端口不通），标注 SKIP 并说明原因
6. **不要修改任何业务代码**，只写测试和报告

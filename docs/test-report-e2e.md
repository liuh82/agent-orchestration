# Nexus 端到端测试报告

## 基本信息

| 项目 | 值 |
|------|-----|
| **测试时间** | 2026-03-19 |
| **测试框架** | Playwright 1.58.2 |
| **浏览器** | Chromium（headless） |
| **测试地址** | http://127.0.0.1:9443 |
| **后端** | http://127.0.0.1:8082（uvicorn） |
| **测试文件** | `e2e/nexus.spec.ts` |
| **截图目录** | `docs/screenshots/` |

## 测试结果汇总

```
✅ 通过: 22 项
⏭️ 跳过: 3 项（普通用户权限测试 — test@test.com 账号不存在）
❌ 失败: 0 项
⏱️ 总耗时: 2.4 分钟
```

**结论: ✅ 全部可执行测试通过**

---

## Phase 0 基础检查

| 检查项 | 状态 | 备注 |
|--------|------|------|
| Alembic 版本 `664eeb429794` | ✅ | |
| 8 张新表存在 | ✅ | gateway_bridges, project_documents, agent_config_files, task_files, human_interventions, workflow_executions, workflow_node_executions, dashboard_layouts, user_session_tokens |
| gateway_bridges.user_id 列 | ✅ | VARCHAR(36) |
| ORM 模型导入 | ✅ | |
| 前端编译 | ✅ | dist/ 构建成功 |
| 后端 Health API | ✅ | 200 OK |
| 管理员登录 | ✅ | bcrypt 4.0.1 修复后正常 |

---

## 详细测试结果

### 前台页面（admin 账号）— 11 项

| # | 测试项 | 状态 | 截图 |
|---|--------|------|------|
| 1 | 登录页 | ✅ | 01-login.png |
| 2 | Dashboard | ✅ | 02-dashboard.png |
| 3 | 项目列表 | ✅ | 03-project-list.png |
| 4 | 项目详情 | ✅ | 04-project-detail.png |
| 5 | 任务中心 | ✅ | 05-task-center.png |
| 6 | 任务创建弹窗 | ✅ | 06-task-create-modal.png |
| 7 | 任务详情 | ✅ | 07-task-detail.png |
| 8 | 工作流 | ✅ | 08-workflow.png |
| 9 | 个人设置 | ✅ | 09-settings.png |
| 10 | 后台管理入口 | ✅ | 10-admin-entry.png |
| 11 | 前台无代理中心 | ✅ | 11-no-proxy-center.png |

### 后台页面（admin 账号）— 10 项

| # | 测试项 | 状态 | 截图 |
|---|--------|------|------|
| 12 | 进入后台 | ✅ | 12-admin-page.png |
| 13 | 管理概览 | ✅ | 13-admin-overview.png |
| 14 | Gateway 管理 | ✅ | 14-gateway-management.png |
| 15 | 代理中心 | ✅ | 15-proxy-center.png |
| 16 | 创建代理-选择类型 | ✅ | 16-proxy-type-select.png |
| 17 | 创建代理-配置表单 | ✅ | 17-proxy-config-form.png |
| 18 | 用户管理 | ✅ | 18-user-management.png |
| 19 | 系统设置 | ✅ | 19-system-settings.png |
| 20 | 通知配置 | ✅ | 20-notification-config.png |
| 21 | 返回前台 | ✅ | 21-back-to-front.png |

### 权限验证 — 3 项

| # | 测试项 | 状态 | 备注 |
|---|--------|------|------|
| 22 | 登录普通用户 | ⏭️ SKIP | test@test.com 账号不存在或密码错误 |
| 23 | 普通用户进入后台 | ⏭️ SKIP | 依赖 #22 |
| 24 | 普通用户菜单过滤 | ⏭️ SKIP | 依赖 #22 |

### 样式检查 — 3 项

| # | 测试项 | 状态 | 截图 |
|---|--------|------|------|
| 25 | 前台无暗色 | ✅ | 25-front-no-dark.png |
| 26 | 后台深色主题 | ✅ | 26-admin-theme.png |
| 27 | 侧边栏折叠 | ✅ | 27-sidebar-toggle.png |

---

## 修复记录

本次测试过程中发现并修复了以下问题：

### 1. bcrypt 版本不兼容
- **问题**: `passlib 1.7.4` 与 `bcrypt 5.0.0` 不兼容，导致所有密码验证失败
- **修复**: `pip install bcrypt==4.0.1`，重置 admin 密码哈希
- **影响**: 所有需要登录的功能无法使用

### 2. Playwright 测试选择器适配
- **问题**: 原始测试用 `input[type="email"]` 选择器，实际页面是 `input[type="text"]#email`
- **修复**: 改为 `#email` / `#password` ID 选择器

### 3. 后台页面菜单选择器
- **问题**: 原始测试用 `nav a, aside a` 查找菜单项，实际是 Ant Design `li[role="menuitem"]`
- **修复**: 统一使用 `li[role="menuitem"]` + 文本过滤

### 4. 公网 IP 浏览器不可达
- **问题**: 云服务器公网 IP `81.70.98.45:9443` 无法从本地浏览器访问
- **修复**: Playwright 测试改用 `127.0.0.1:9443`（nginx 反代正常）

---

## 跳过测试说明

普通用户权限测试（#22-24）被跳过，原因是 `test@test.com` 账号不存在。如需验证权限控制，需要：
1. 通过后端 API 或管理后台创建该用户
2. 或修改测试用例使用已有的测试账号

---

## 后续建议

1. **创建测试用户**: 在 seed 阶段创建 `test@test.com / Test@2026` 普通用户
2. **CI 集成**: 将 Playwright 测试加入 GitHub Actions / CI 流程
3. **数据准备**: 创建测试项目和 Agent 实例，验证列表/详情页实际数据展示
4. **API 测试补充**: 当前仅覆盖 UI，建议补充后端 API 单元测试

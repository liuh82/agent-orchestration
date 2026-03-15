# Nexus V3 需求确认书

> 基于 2026-03-15 前后台需求讨论整理，待确认后整合进最终版需求文档。

---

## 一、菜单结构

### 前台（MainLayout）

- **Dashboard** — 个人维度数据概览，后续支持可定制卡片布局
- **Projects** — 项目管理中心（创建项目/任务、文档库、Agent配置文件、任务文件）
- **Tasks** — 纯监控视图，三层级展示（项目→任务→Agent执行明细）
- **Workflows** — 工作流可视化编辑器（React Flow）
- **Settings** — 个人配置、通知通道

### 后台（AdminLayout）— 浅色主题

- **管理概览** — 合并原"后台首页"+"全局统计"，可配置卡片布局
- **Gateway 管理** — 管理员查看所有Bridge连接、Gateway服务状态、删除非法连接
- **代理中心** — Agent CRUD + Agent类型管理（子Tab）
- **用户管理** — 用户列表、修改密码、禁用/解封、删除
- **系统设置** — 全局配置（心跳间隔、并发数、超时等）
- **通知配置** — 6个通知通道的配置与管理

---

## 二、后台模块详细需求

### 2.1 管理概览（合并后台首页 + 全局统计）

**取消独立"全局统计"页面**，合并为"管理概览"。

**指标卡片：**
- 用户总数 / 活跃用户数
- Agent 总数 / 在线数
- 项目总数
- 任务统计（运行中 / 完成 / 失败）
- Token 消耗总量 / 今日消耗
- 成本统计（总成本 / 今日成本）
- Bridge 连接状态
- 系统健康（API 响应时间、错误率）

**可配置化：** 后台定义卡片类型，admin 自由选择布局。本次先实现固定布局，预留可配置接口。

**普通用户后台首页：** 按角色权限动态过滤，普通用户看到的是个人维度的统计卡片（我的项目数、我的任务数、我的Agent数、今日Token消耗等）。

---

### 2.2 Gateway 管理

#### 用户侧（前台 Settings 或独立 Bridge 管理页面）

- **添加 Bridge：** 点击"添加 Bridge"→ 系统生成 API Key → 展示配置指引（Gateway WebSocket 地址、一键复制配置命令、安装指引）
- **查看列表：** 自己的 Bridge 列表，展示名称、状态（在线/离线/忙碌）、平台信息、最后活跃时间
- **编辑/删除：** 管理自己的 Bridge
- **查看任务：** 每个 Bridge 上的任务执行情况

#### 管理员侧（后台）

- **查看所有 Bridge：** 全部用户的 Bridge 连接列表
- **Gateway 服务状态：** 连接数、总负载、系统状态
- **删除连接：** 删除非法/错误的 Bridge 连接
- **全局资源占用：** 各 Bridge 的资源使用情况

#### 数据层

- Bridge 表增加 `user_id` 字段（Optional，向后兼容），做用户归属隔离
- Bridge CRUD API 按用户隔离（用户只能操作自己的）

#### oc-bridge 部署

- 当前方式：`npm install -g @liuh82/oc-bridge` + `oc-bridge start`
- **暂不发 npm registry**，后续再说
- 4 种协议覆盖：WebSocket / HTTP / gRPC / Stdio

---

### 2.3 代理中心（合并 Agent 类型管理）

#### 页面结构

- Tab 1：Agent 列表（CRUD）
- Tab 2：Agent 类型管理

#### Agent 创建表单

**必填字段：**
- 名称
- Agent 类型（下拉选择，从 Agent 类型列表获取）
- Bridge 连接（下拉选择，展示当前用户的所有在线/离线 Bridge）

**选填字段：**
- 模型（标注为"预期模型"，优先从心跳上报获取真实模型，无上报时用此值展示）
- 超时时间
- 最大重试次数
- 配置（根据 Agent 类型的 config_schema 自动生成表单，**本次迭代实现**）

#### Agent 详情页

- 基本信息（名称、状态、类型、绑定Bridge、模型、超时等）
- 统计数据（任务数、完成数、失败数、Token消耗、平均响应时间）
- 任务日志
- 配置编辑（浅色背景，统一宽度，字体调大）
- 绑定的 Bridge 信息展示

#### Agent 类型管理（子 Tab）

**字段：**
- 名称 / 显示名
- 协议（WebSocket / HTTP / gRPC / Stdio）
- 能力标签（展示用，后续扩展为任务匹配约束）
- 预置模型（展示用，可选，后续成本预估用）
- 配置 Schema（JSON Schema，用于自动生成 Agent 创建表单）

#### 配置 Schema 自动表单（本次迭代）

- 使用 `@rjsf/core` + antd 主题
- 管理员在 Agent 类型页面配置 JSON Schema
- 用户创建/编辑 Agent 时，根据 schema 自动渲染友好表单
- 无 schema 时展示基础表单（名称、Bridge、模型、超时等）

#### 模型获取策略

- 优先：Agent 上线/心跳时自动上报当前使用模型，缓存到后端
- 兜底：使用创建时填写的"预期模型"
- 展示标签：如有上报值显示"当前：claude-sonnet-4-20250514"，无上报显示"预期：claude-3-opus"

---

### 2.4 用户管理

标准 admin CRUD：
- 用户列表（邮箱、名称、角色、状态、创建时间）
- 修改密码
- 禁用登录 / 解封
- 删除用户（软删除）
- 角色分配（admin / user）

---

### 2.5 系统设置

保留现有配置项，调整说明：
- **心跳间隔：** 实际生效
- **最大并发任务数：** 实际生效
- **Job 默认超时：** 实际生效
- **默认模型：** 保留但不强制填写，后续模型路由功能使用

---

### 2.6 通知配置

**6 个通道全部按官方标准实现：**

1. **飞书** — 配置字段：Webhook URL、签名密钥。按飞书官方 Webhook + 签名校验
2. **钉钉** — 配置字段：Webhook URL、加签密钥。按钉钉官方 Webhook + 加签
3. **企业微信** — 配置字段：Webhook URL。修复类型名 wechat_work 统一（后端 wecom 需对齐），按企业微信官方格式
4. **Slack** — 配置字段：Webhook URL。按 Slack Incoming Webhook 官方格式
5. **Discord** — 配置字段：Webhook URL。按 Discord Webhook 官方格式
6. **邮件** — 配置字段：SMTP 服务器、端口、账号、密码、SSL/TLS、发件人。补全 SMTP 配置表单和发送逻辑

**通用要求：**
- 每个通道有独立的配置表单（不共用 webhook_url + secret）
- 支持"测试发送"功能，验证配置是否正确
- 触发条件配置 — 后续迭代
- 触发通知绑定到任务状态变化 — 后续迭代

---

## 三、已知 Bug 修复

### 已修复

- ✅ 后台代理中心点击 Agent 跳转到前台（AgentListPage + AgentDetailPage 路径动态判断）
- ✅ StatusBadge 导致白屏崩溃（未知 status 值 fallback）

### 待修复（纳入本次迭代）

- [ ] Agent 详情页"配置"Tab 黑色背景 → 改为浅色
- [ ] Agent 详情页配置编辑区宽度不一致 → 统一容器宽度
- [ ] Agent 详情页字体偏小 → 整体调大一号
- [ ] 后台 content 区背景色透明 → 浅色
- [ ] 后台 Dashboard 统计卡片高度不一致 → 对齐
- [ ] stats API 路径：前端 /v1/admin/stats/global → 后端实际 /api/v1/stats/global
- [ ] 模板库 API GET /api/workflows/templates 返回 500

---

## 四、不纳入本次迭代（后续）

1. Dashboard 可定制化（卡片拖拽布局）
2. 工作流执行实时监控（WebSocket 推送）
3. Token 过期机制（JWT 改造）
4. 安全审计遗留 3 项（Token 存储优化、vite/esbuild 漏洞更新、命令注入修复）
5. 通知触发条件绑定任务状态变化
6. oc-bridge 发布到 npm registry
7. 模型路由 / 成本预估
8. capabilities 标签用于任务匹配约束

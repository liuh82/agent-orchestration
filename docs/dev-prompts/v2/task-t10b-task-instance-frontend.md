# Nexus 开发任务 T10-B：任务实例化 — 前端

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v4.md（第4章前端、第5章页面）
- frontend/src/pages/projects/ProjectCenterPage.tsx
- frontend/src/pages/projects/ProjectDetailPage.tsx
- frontend/src/pages/tasks/TaskCenterPage.tsx
- frontend/src/api/projects.ts
- frontend/src/api/tasks.ts
- frontend/src/api/workflows.ts
- frontend/src/stores/useProjectStore.ts
- frontend/src/stores/useTaskStore.ts

## 重要上下文
- 后端 API 路径统一加 `/v1` 前缀
- axios 拦截器已配置 `response.data = data.data` 解包
- react-query 配置：`staleTime: 30000`, `retry: 1`
- 使用 Ant Design 组件库
- 使用 styled-components 做样式
- 当前项目中心已有项目列表和详情页
- 当前任务中心有独立的任务列表页

## 任务目标
实现任务实例化的前端页面和交互。

## 具体要求

### 10B.1 项目创建增强

项目中心页面增加「创建项目」按钮：
1. 点击弹出 Modal
2. 表单字段：
   - 项目名称（必填）
   - 项目描述（TextArea）
   - 关联工作流（Select 下拉，调用 `GET /api/v1/workflows` 获取列表，可选）
   - 如果选了工作流，显示节点配置覆盖区域（见 10B.3）
3. 创建成功后跳转到项目详情页

### 10B.2 项目内创建任务

项目详情页增加「创建任务」按钮：
1. 点击弹出 Modal
2. 表单字段：
   - 任务名称（必填）
   - 任务描述（TextArea）
   - 关联工作流（Select 下拉，默认使用项目关联的工作流，可切换）
   - 指定 Agent（Select 下拉，调用 `GET /api/v1/agents` 获取列表，可选）
   - 节点配置覆盖（见 10B.3）
   - 执行方式：Radio（立即执行 / 定时执行 / 循环执行）
   - 如果选定时：显示 cron 表达式输入 + 人类可读说明
   - 如果选循环：显示间隔时间输入（秒/分/时/天）
3. 创建成功后任务出现在项目任务列表中

### 10B.3 节点配置覆盖面板

当用户选择了工作流后：
1. 调用 `GET /api/v1/workflows/{id}` 获取工作流定义
2. 解析节点列表，找出有 `overridableFields` 的节点
3. 动态渲染配置表单：
   - 每个可覆盖节点显示为一个 Card
   - Card 标题：节点类型 + 节点标签
   - Card 内容：根据 overridableFields 渲染对应表单控件
   - Text → Input
   - Number → InputNumber
   - Enum → Select
   - Boolean → Switch
4. 用户填写的值存为 `config_overrides` 对象
5. 未填写的字段使用工作流模板默认值

### 10B.4 项目概述页完善

项目详情页的概述区域：
- 项目名称（大标题）
- 项目描述（长文本截断 + 展开/收起）
- 创建时间、创建者
- 统计卡片（一行4个）：
  - 任务总数 / 已完成
  - 文档数
  - 关联工作流
  - 执行次数

### 10B.5 项目内任务列表

项目详情页增加任务列表 Tab/Section：
- 列表列：任务名称、状态（Badge）、关联工作流、Agent、创建时间、执行方式
- 支持状态过滤（全部/待执行/执行中/已完成/失败）
- 点击任务名称进入任务详情
- 支持创建子任务

### 10B.6 独立任务入口

项目中心页面顶部增加 Tab 切换：「全部项目」/「独立任务」
- 「独立任务」Tab 显示不归属项目的任务列表
- 支持直接从「独立任务」Tab 创建独立任务

### 10B.7 路由调整

```
/projects                    → 项目中心（全部项目 + 独立任务 Tab）
/projects/new                → 创建项目
/projects/:id                → 项目详情（概述 + 任务列表）
/projects/:id/tasks/new      → 创建任务
/projects/:id/tasks/:taskId  → 任务详情
```

## 完成标准
- [ ] 项目创建 Modal 正常工作，支持选择工作流
- [ ] 项目内创建任务 Modal 正常工作
- [ ] 节点配置覆盖面板根据工作流动态渲染
- [ ] 执行方式选择正常（立即/定时/循环）
- [ ] 项目概述页信息完整
- [ ] 项目内任务列表显示正常
- [ ] 独立任务 Tab 正常
- [ ] TypeScript 编译零错误
- [ ] 前端 console 无 error

## 不要做的事
- 不要修改后端代码（T10-A 负责）
- 不要修改工作流编辑器（T8 负责）
- 不要修改工作流执行引擎（T9 负责）
- 不要 git commit

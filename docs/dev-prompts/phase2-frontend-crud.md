# Phase 2 - 前端：核心 CRUD 页面

## 任务目标

实现项目中心（文档库/Agent配置/文件管理）、代理中心（配置Schema表单）、Bridge管理页面。

## 修改/新建文件清单

```
frontend/src/api/projects.ts           # 项目+文档+配置+文件 API
frontend/src/api/agents.ts             # Agent+类型 API
frontend/src/api/bridges.ts            # Bridge API
frontend/src/api/files.ts              # 文件上传下载 API
frontend/src/pages/projects/ProjectDetailPage.tsx     # 重构：5个Tab
frontend/src/pages/projects/components/DocumentManager.tsx
frontend/src/pages/projects/components/AgentConfigEditor.tsx
frontend/src/pages/projects/components/FileManager.tsx
frontend/src/pages/projects/ProjectListPage.tsx        # 项目列表优化
frontend/src/pages/agents/AgentNewPage.tsx             # 重构：Bridge选择+SchemaForm
frontend/src/pages/agents/AgentDetailPage.tsx          # 重构：配置浅色
frontend/src/pages/settings/BridgeManager.tsx           # 新建
frontend/src/components/common/SchemaForm.tsx           # 新建：@rjsf 封装
frontend/src/components/common/FileUploader.tsx         # 新建
frontend/package.json                                   # 添加 @rjsf/core
```

## 安装依赖

```bash
npm install @rjsf/core @rjsf/utils @rjsf/validator-ajv8
```

## 项目详情页重构（5个Tab）

### Tab 结构
1. **概述** — 项目基本信息（名称/描述/状态/统计）
2. **任务** — 项目下的任务列表（创建/编辑/删除/启动）
3. **文档库** — 上传/编辑/预览项目文档
4. **Agent配置** — 按类型管理配置文件（CLAUDE.md等）
5. **文件管理** — 任务级文件管理

### DocumentManager 组件
- 列表展示所有文档，按 doc_type 分组
- 支持在线编辑 Markdown 文档（textarea 或简易编辑器）
- 支持文件上传（FileUploader 组件）
- 文件预览（PDF/图片用新窗口打开，MD用渲染预览）

### AgentConfigEditor 组件
- 左侧选择 Agent 类型，右侧展示对应的配置文件
- 配置类型列表：CLAUDE.md / SOUL.md / AGENTS.md / opencode.json
- 编辑区域用代码编辑器样式的 textarea

### FileManager 组件
- 文件列表，按 file_type 分组（prompt/input/reference/constraint/output）
- 上传按钮（FileUploader），选择 file_type
- 下载/删除操作

## SchemaForm 组件（@rjsf 封装）

```typescript
// frontend/src/components/common/SchemaForm.tsx
interface SchemaFormProps {
  schema: RJSFSchema;        // JSON Schema
  formData?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
  readonly?: boolean;
}

// 使用 @rjsf/core + antd widgets
// 当 schema 为空时展示基础表单（名称、Bridge、模型、超时）
```

## AgentNewPage 重构

**创建表单字段：**
- 名称（必填）
- Agent 类型（下拉，从 GET /api/v1/agent-types 获取）
- Bridge 连接（下拉，从 GET /api/v1/bridges 获取用户自己的Bridge，无Bridge时提示先配置）
- 模型（选填，标注"预期模型"）
- 超时时间（选填，默认300）
- 最大重试次数（选填，默认1）
- 配置（动态表单：当选择了 Agent 类型且有 config_schema 时，用 SchemaForm 渲染）

**关键逻辑：**
- 选择 Agent 类型后，异步加载 config_schema
- 如果有 schema，用 SchemaForm 渲染配置区域
- 如果无 schema，显示基础配置（模型、超时、重试）
- Bridge 下拉为空时显示提示："请先在设置中添加 Bridge 连接"

**提交后跳转：** 根据当前页面上下文（前台/后台）动态跳转
- 前台创建 → `/agents/{id}`
- 后台创建 → `/admin/agents/{id}`

## BridgeManager 页面

**位置：** Settings 页面的子Tab 或独立页面

**功能：**
1. Bridge 列表（名称、状态badge、平台、最后活跃时间）
2. "添加 Bridge" 按钮 → Modal
3. 添加 Modal 内容：
   - 输入名称
   - 提交后显示配置指引（API Key、WebSocket 地址、一键复制命令、安装步骤）
   - 复制命令按钮（clipboard API）
4. 编辑/删除 Bridge
5. 查看 Bridge 上的任务

## FileUploader 组件

```typescript
interface FileUploaderProps {
  accept?: string;          // 文件类型限制
  maxSize?: number;         // 最大大小（字节）
  onUpload: (file: { file_id: string; file_path: string; name: string }) => void;
}
```

- 拖拽上传 + 点击上传
- 文件大小校验（10MB）
- 上传进度条
- 错误提示

## 约束

- 浅色主题，所有新页面背景 #f5f5f5 或 #ffffff
- 字体大小不小于 14px
- 表单验证使用 antd Form 自带验证
- 所有列表页面支持搜索和分页
- Bridge API Key 展示时提供一键复制按钮

## 验收标准

- [ ] 项目详情页5个Tab正常切换和展示
- [ ] 文档库可创建/编辑/上传/删除文档
- [ ] Agent配置文件可按类型编辑
- [ ] 文件管理可上传/下载/删除
- [ ] Agent创建时可选择Bridge和类型，配置Schema自动生成表单
- [ ] Agent创建后根据上下文跳转正确页面
- [ ] Bridge管理页面CRUD正常
- [ ] 添加Bridge后显示完整配置指引和复制命令
- [ ] @rjsf 表单正确渲染和提交

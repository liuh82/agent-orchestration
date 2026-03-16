# Nexus 开发任务 T1：更新架构设计文档

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md
- docs/requirements-v3-confirmation.md
- /root/.openclaw/workspace/nexus-iteration2-plan.md

## 任务目标
基于迭代二的需求变更，更新架构设计文档，产出 `docs/architecture-v4.md`。

## 具体要求

### 1. 业务模型重构
工作流（模板）→ 项目/任务（实例）的层级关系：
- 工作流是可复用模板（步骤、Agent配置、文档要求）
- 项目是多任务容器（可选），任务是单任务
- 创建任务时基于工作流实例化，拥有独立配置/文档/执行记录
- 任务支持：立即执行、定时执行（cron）、循环执行（interval）

### 2. 数据模型设计
新增/修改的表：
- tasks 表增加：schedule_type(once/cron/interval)、schedule_config、workflow_snapshot
- 新增 task_agent_configs 表：实例级Agent配置覆盖
- 新增 task_documents 表：实例级文档（或给 project_documents 加 task_id）
- workflows 表增加：sub_workflow_enabled
- workflow_nodes 表增加：config_override_schema

### 3. API 变更
- 项目创建流程变更：先选工作流模板 → 选择创建项目/独立任务
- 任务创建绑定工作流，支持配置覆盖
- Gateway bridge CRUD 完整接口
- 管理员重置用户密码接口
- 通知通道配置 schema 接口（已有但需修复）

### 4. 前端页面变更
- 项目中心合并任务创建（选择项目/独立任务）
- 后台首页合并统计页
- 代理中心合并Agent类型为子Tab
- 工作流编辑器完全重写（参照n8n）
- Dashboard默认展示方案

### 5. 数据库清空重建
- 管理员账号保留：admin / 当前密码
- 其他数据清空
- 用 Alembic 重建所有表

## 输出要求
- 文件路径：docs/architecture-v4.md
- 格式参照 architecture-v3.md 的结构
- 必须包含：数据模型（表结构）、API 列表、前端页面列表、模块依赖关系图

## 完成标准
- [ ] architecture-v4.md 文件已生成
- [ ] 覆盖所有迭代二需求
- [ ] 数据模型有完整的表结构定义
- [ ] API 列表覆盖所有新增/修改的接口

## 不要做的事
- 不要修改任何代码文件
- 不要 git commit

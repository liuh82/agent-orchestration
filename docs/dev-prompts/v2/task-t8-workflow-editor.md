# Nexus 开发任务 T8：工作流编辑器重写（参照n8n）

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md（工作流引擎部分）
- frontend/src/pages/workflows/ 目录（现有工作流页面）
- frontend/src/components/workflow/ 目录（现有组件）
- backend/app/routers/workflows.py
- backend/app/services/ 目录下 workflow 相关文件

## 参考资源
- n8n 工作流编辑器：https://docs.n8n.io/workflows/
- n8n 节点类型：https://docs.n8n.io/integrations/builtin/core-nodes/
- React Flow 文档：https://reactflow.dev/

## 任务目标
完全重写工作流编辑器，参照 n8n 的交互和功能。

## 具体要求

### 8.1 节点面板（左侧拖拽区）

所有节点类型：
1. **触发器节点**
   - 手动触发（Manual Trigger）
   - 定时触发（Cron Trigger）— 配置 cron 表达式
   - Webhook 触发（Webhook Trigger）— 配置 HTTP method 和 path

2. **Agent 节点**
   - 配置：选择 Agent 类型、prompt、模型、温度、最大token、超时时间
   - 配置覆盖标记：标记哪些字段允许实例创建时覆盖

3. **逻辑控制节点**
   - IF 条件分支（IF）— 配置条件和 true/false 分支
   - Switch 多路分支（Switch）— 配置多个条件和输出
   - 循环（Loop）— 配置循环类型（固定次数/列表遍历）和终止条件
   - 等待（Wait）— 等待指定时间或等待 webhook

4. **工作流节点**
   - 子工作流（Sub Workflow）— 选择另一个工作流模板，传递参数

5. **数据节点**
   - HTTP 请求（HTTP Request）— 配置 URL、method、headers、body
   - 代码执行（Code）— 配置语言（python/js）和代码内容
   - 数据转换（Set/Transform）— 配置变量名和值

6. **输出节点**
   - 输出结果（Output）— 配置输出格式和目标

### 8.2 画布功能
- 拖拽连线（节点之间的连线）
- 自动布局（可选）
- 缩放和平移
- Mini map
- 撤销/重做（Ctrl+Z / Ctrl+Shift+Z）
- 节点复制/粘贴
- 多选和批量删除
- 网格背景

### 8.3 节点配置面板（右侧）
- 点击节点打开配置面板
- 配置项根据节点类型动态渲染
- 支持 JSON/YAML 高级编辑模式（切换）
- 配置验证（必填项、格式校验）
- 保存配置后即时更新节点

### 8.4 工作流管理
- 保存工作流（名称 + 描述 + 版本）
- 工作流列表页
- 工作流版本管理
- 导入/导出（JSON 格式）

### 8.5 技术实现
- 使用 React Flow 作为画布引擎（保持现有技术栈）
- 节点组件化：每种节点类型一个 React 组件
- 配置面板使用 Ant Design Form
- 连线数据存储为 workflow_nodes 表的 connections 字段

## 完成标准
- [ ] 所有节点类型可拖拽到画布
- [ ] 节点可配置（右侧面板）
- [ ] 连线正常工作
- [ ] 工作流可保存和加载
- [ ] IF/Switch 分支节点有多个输出端口
- [ ] 子工作流节点可选择其他工作流
- [ ] 撤销/重做正常
- [ ] 前端 console 无 error
- [ ] 无 TypeScript 类型错误

## 不要做的事
- 不要引入非必要的依赖（React Flow 已有）
- 不要修改后端工作流执行引擎（T9 负责）
- 不要 git commit

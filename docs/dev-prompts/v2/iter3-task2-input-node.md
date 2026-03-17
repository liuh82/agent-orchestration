# Nexus 工作流改造 — 阶段2: Input 节点（后端+前端）

> 请在 agent-orchestration 项目根目录执行。
> 前置条件：阶段1（fork/join引擎改造）已完成

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §3.1 input 节点完整定义
3. `backend/app/services/workflow_engine/nodes/agent.py` — 参考现有节点实现模式
4. `backend/app/services/workflow_engine/nodes/base.py` — NodeContext, NodeResult
5. `backend/app/services/workflow_engine/registry.py` — 注册装饰器
6. `backend/app/models/task.py` — 任务模型（input 需要查询任务/项目数据）
7. `backend/app/models/project.py` — 项目模型
8. `backend/app/models/project_document.py` — 项目文档模型
9. `frontend/src/types/workflow.ts` — 前端节点类型定义
10. `frontend/src/components/workflow/nodes/BaseNode.tsx` — 节点组件基类
11. `frontend/src/components/workflow/NodePanel.tsx` — 左侧节点面板
12. `frontend/src/components/workflow/NodeConfigPanel.tsx` — 右侧配置面板
13. `frontend/src/components/workflow/nodes/index.ts` — 节点导出桶

## 任务目标
实现 input 节点的后端执行器和前端组件。

### 1. 后端：创建 input 节点执行器
文件：`backend/app/services/workflow_engine/nodes/input.py`

功能：从项目/任务中提取上下文数据作为工作流起点。

CONFIG_SCHEMA（参考需求文档 §3.1）：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "输入" },
    "source": {
      "type": "string", "title": "数据来源",
      "enum": ["project", "task", "manual", "upstream"],
      "default": "project"
    },
    "fields": {
      "type": "array", "title": "提取字段",
      "items": { "type": "string" },
      "default": ["title", "description"]
    },
    "includeFiles": {
      "type": "boolean", "title": "包含附件文件", "default": true
    },
    "template": {
      "type": "string", "title": "组装模板（可选）",
      "description": "用 {{ field }} 引用字段"
    },
    "outputAlias": {
      "type": "string", "title": "输出变量名", "default": "input"
    }
  },
  "required": ["source"]
}
```

execute() 逻辑：
1. 从 `context.input_data` 获取 `project_id` 或 `task_id`
2. 根据 `source` 查询 DB：
   - `project` → 查 project 表 + project_documents
   - `task` → 查 task 表 + task_files
   - `manual` → 直接用 input_data
   - `upstream` → 用 upstream_outputs
3. 按 `fields` 提取对应数据
4. `includeFiles=true` 时加载文件内容（文本文件读内容，二进制给路径）
5. 有 `template` 时用简单替换渲染（`{{ field }}` → 对应值）
6. 输出结构化数据

output_data 示例：
```python
{
    "title": "项目名称",
    "description": "项目描述",
    "documents": [...],
    "files": [{"name": "xxx.py", "content": "...", "path": "..."}],
    "template_output": "渲染后的文本"  # 如果有template
}
```

### 2. 后端：注册节点
在 `backend/app/services/workflow_engine/nodes/__init__.py` 中导入 InputNode。

### 3. 前端：类型定义
在 `frontend/src/types/workflow.ts` 中添加：
```typescript
export interface InputNodeData {
    label: string;
    source: 'project' | 'task' | 'manual' | 'upstream';
    fields: string[];
    includeFiles: boolean;
    template?: string;
    outputAlias: string;
}
```
在 `WorkflowNodeType` 联合类型中加入 `'input'`。
在 `NODE_META` 中添加 input 的元信息：
```typescript
input: {
    type: 'input',
    label: '输入',
    category: 'trigger' as NodeCategory,  // 输入节点也是起点
    color: '#06b6d4',  // cyan
    icon: 'FolderOpenOutlined',
    defaultData: () => ({ label: '输入', source: 'project', fields: ['title', 'description'], includeFiles: true, outputAlias: 'input' }),
    handles: { outputs: ['target'] },
    noInput: true,  // 输入节点没有入端口
},
```

### 4. 前端：节点组件
文件：`frontend/src/components/workflow/nodes/InputNode.tsx`

参照 `ManualTriggerNode.tsx`（同样是 noInput 节点），使用 BaseNode 组件。

### 5. 前端：配置面板
在 `frontend/src/components/workflow/NodeConfigPanel.tsx` 中为 input 类型添加配置表单：
- **数据来源**：Radio（项目/任务/手动/上游）
- **提取字段**：Checkbox 多选，根据来源动态显示可选项
  - project: title, description, documents
  - task: title, description, requirements, input_files
  - manual: （无预设字段）
- **包含文件**：Switch
- **组装模板**：TextArea（可选）
- **输出变量名**：Input

### 6. 前端：注册
- 在 `nodes/index.ts` 导出 InputNode
- 在 `WorkflowEditorPage.tsx` 的 nodeTypes 中注册 `'input': InputNode`
- 在 `NodePanel.tsx` 中添加到"触发器"分类下

## 完成标准
- [ ] `backend/app/services/workflow_engine/nodes/input.py` 创建完成
- [ ] 节点已注册
- [ ] 后端可正常启动
- [ ] 前端 TypeScript 无类型错误
- [ ] InputNode 在编辑器中可拖拽到画布
- [ ] 配置面板显示正确的表单字段
- [ ] 不要 git commit

## 不要做的事
- 不要修改 engine.py（input 节点不需要特殊引擎支持）
- 不要修改 VariableResolver
- 不要做数据库迁移
- 不要 git commit

# Nexus 工作流改造 — 阶段3: Context Output + Result Output 节点

> 请在 agent-orchestration 项目根目录执行。
> 前置条件：阶段2（input节点）已完成

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §3.2 context_output + §3.3 result_output
3. `backend/app/services/workflow_engine/nodes/output_node.py` — 现有 output 节点（参考但**不删除**）
4. `backend/app/services/workflow_engine/nodes/base.py` — NodeContext（关注 task_id, execution_id）
5. `backend/app/models/task.py` — 任务模型
6. `frontend/src/types/workflow.ts` — 前端类型
7. `frontend/src/components/workflow/nodes/OutputNode.tsx` — 现有输出节点组件

## 任务目标
新增 context_output 和 result_output 两种输出节点。现有 output_node.py **保留不动**。

### 1. 后端：context_output 节点
文件：`backend/app/services/workflow_engine/nodes/context_output.py`

功能：将中间结果写回任务的上下文字段，供人工查看或后续节点引用。

CONFIG_SCHEMA（§3.2）：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "上下文输出" },
    "targets": {
      "type": "array", "title": "输出目标",
      "items": {
        "type": "object",
        "properties": {
          "field": { "type": "string", "title": "目标字段", "enum": ["summary", "notes", "context", "tags", "custom"] },
          "source": { "type": "string", "title": "数据来源" },
          "template": { "type": "string", "title": "格式模板" }
        }
      }
    },
    "appendMode": { "type": "boolean", "title": "追加模式", "default": true }
  },
  "required": ["targets"]
}
```

execute() 逻辑：
1. 从 `context.upstream_outputs` 获取上游数据
2. 按 `targets` 配置，将数据格式化
3. 有 `template` 时渲染模板
4. 写入任务记录（task 表的 context/notes/summary 字段）
5. `appendMode=true` 时追加，否则覆盖

### 2. 后端：result_output 节点
文件：`backend/app/services/workflow_engine/nodes/result_output.py`

功能：标记工作流的最终输出结果，更新任务状态为完成。

CONFIG_SCHEMA（§3.3）：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "结果输出" },
    "outputFormat": {
      "type": "string", "title": "输出格式",
      "enum": ["json", "markdown", "plain_text", "structured"],
      "default": "markdown"
    },
    "resultField": { "type": "string", "title": "结果字段名", "default": "result" },
    "onComplete": {
      "type": "string", "title": "完成后动作",
      "enum": ["mark_done", "mark_done_and_notify", "none"],
      "default": "mark_done"
    }
  }
}
```

execute() 逻辑：
1. 从 upstream 提取 `resultField` 对应的值
2. 按 `outputFormat` 格式化
3. 写入任务的 output/result 字段
4. `onComplete=mark_done` 时更新任务状态为 completed

### 3. 后端：注册节点
在 `__init__.py` 中导入并注册 context_output 和 result_output。

### 4. 前端：类型定义
在 `workflow.ts` 中添加 ContextOutputNodeData 和 ResultOutputNodeData。

NODE_META 添加：
```typescript
context_output: {
    type: 'context_output',
    label: '上下文输出',
    category: 'output',
    color: '#f59e0b',  // amber
    icon: 'FileTextOutlined',
    handles: { inputs: ['target'], outputs: ['source'] },
},
result_output: {
    type: 'result_output',
    label: '结果输出',
    category: 'output',
    color: '#10b981',  // emerald
    icon: 'CheckCircleOutlined',
    handles: { inputs: ['target'], outputs: ['source'] },  // outputs可选，方便继续连线
},
```

### 5. 前端：节点组件
- `frontend/src/components/workflow/nodes/ContextOutputNode.tsx`
- `frontend/src/components/workflow/nodes/ResultOutputNode.tsx`

### 6. 前端：配置面板
在 NodeConfigPanel.tsx 中：
- context_output: targets 动态列表（可增删），每项有 field 下拉 + source 输入 + template 文本
- result_output: outputFormat 单选 + resultField 输入 + onComplete 单选

### 7. 前端：注册
- nodes/index.ts 导出
- WorkflowEditorPage nodeTypes 注册
- NodePanel 添加到"输出"分类

## 完成标准
- [ ] `context_output.py` 和 `result_output.py` 创建完成
- [ ] 节点已注册
- [ ] 后端可正常启动
- [ ] 前端 TypeScript 无类型错误
- [ ] 两个节点在编辑器中可拖拽、可配置
- [ ] 不要 git commit

## 不要做的事
- 不要修改或删除现有 `output_node.py`
- 不要修改 engine.py
- 不要修改 VariableResolver
- 不要做数据库迁移
- 不要 git commit

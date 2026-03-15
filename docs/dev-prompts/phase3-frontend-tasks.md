# Phase 3 - 前端：任务中心三层级重构

## 任务目标

重构任务中心为纯监控视图，实现三层级展示、人工干预交互、批量操作。

## 修改/新建文件清单

```
frontend/src/pages/tasks/TaskCenterPage.tsx           # 重构：三层级视图
frontend/src/pages/tasks/components/TaskTree.tsx       # 三层级组件
frontend/src/pages/tasks/components/TaskDetailPanel.tsx # 任务详情面板
frontend/src/pages/tasks/components/AgentExecutionDetail.tsx  # Agent执行明细
frontend/src/pages/tasks/components/HumanIntervention.tsx     # 人工干预面板
frontend/src/pages/tasks/components/BatchActions.tsx         # 批量操作工具栏
frontend/src/api/tasks.ts                               # 任务API扩展
frontend/src/stores/useTaskStore.ts                      # 任务状态
```

## 三层级展示结构

```
项目列表（折叠面板 Collapse）
├── 项目A [任务: 运行2 完成5 失败1]
│   ├── 任务1 [状态badge] [Agent: claude-code] [进度条 60%] [时间]
│   │   └── Agent执行明细（展开行）
│   │       ├── Agent: agent-1 [在线] [模型: claude-sonnet]
│   │       ├── 日志: [实时日志流]
│   │       └── 产出文件: [file1.py] [file2.md]
│   ├── 任务2 [已完成] ...
│   └── 任务3 [人工干预中] ⚠️
│       └── 人工干预面板（展开行）
│           ├── 上下文: Agent请求原因...
│           ├── 代码片段: [代码预览]
│           ├── [审批通过] [驳回] [修改意见]
│           └── 意见输入框 + 文件附件上传
├── 项目B [任务: 运行1 完成3]
│   └── ...
```

## TaskTree 组件

```typescript
interface TaskTreeProps {
  onTaskClick?: (taskId: string) => void;
}

// 数据来源: GET /api/v1/tasks/tree
// 一次性返回完整三层级数据
// 使用 Ant Design Collapse + Table 实现
```

## 人工干预交互（HumanIntervention 组件）

当任务 status 为 `pending_human` 时显示：

1. **上下文展示区**
   - Agent 提交的决策请求原因（文本）
   - 相关代码片段（代码块渲染）
   - 附加信息（如有）

2. **操作按钮组**
   - 「审批通过」— 绿色按钮
   - 「驳回」— 红色按钮
   - 「修改意见」— 蓝色按钮

3. **意见输入**
   - 点击「修改意见」后展开文本框
   - 支持输入修改指令

4. **文件附件**
   - 文件上传组件（FileUploader）
   - 最多 5 个附件

5. **提交逻辑**
   - 审批通过 → `POST /api/v1/tasks/{id}/approve`
   - 驳回/修改意见 → `POST /api/v1/tasks/{id}/reject`（带 comment + 附件）
   - 提交后刷新任务树

## 批量操作（BatchActions 工具栏）

```typescript
interface BatchActionsProps {
  selectedTaskIds: string[];
  onActionComplete: () => void;
}
```

- 顶部工具栏，当有选中任务时显示
- 显示已选数量
- 「批量暂停」按钮 → `POST /api/v1/tasks/batch-action { task_ids, action: "pause" }`
- 「批量取消」按钮 → `POST /api/v1/tasks/batch-action { task_ids, action: "cancel" }`
- 「取消选择」按钮

## 任务选择

- 每行任务前加 Checkbox（仅在任务层级，不在项目层级）
- Shift+Click 多选连续行
- Checkbox 状态由 useTaskStore 管理

## 任务中心页面结构

```
┌──────────────────────────────────────────────┐
│ 任务中心                    [刷新] [筛选▼]    │
├──────────────────────────────────────────────┤
│ ▼ 项目A  [运行2] [完成5] [失败1]             │
│   ☐ 任务1  ●运行中  claude-code  60%  2min   │
│   ☑ 任务2  ✓已完成  codex       100%  5min   │
│   ☐ 任务3  ⚠️人工干预  claude-code  --  10min │
│       [人工干预面板展开]                       │
│ ▶ 项目B  [运行1] [完成3]                      │
│ ▶ 项目C  [完成8]                             │
├──────────────────────────────────────────────┤
│ [已选1项] [批量暂停] [批量取消] [取消选择]      │ ← 选中时显示
└──────────────────────────────────────────────┘
```

## 移除创建功能

- 任务中心不再有"创建任务"按钮
- 任务创建在项目中心 → 项目详情 → 任务Tab 中完成

## 约束

- 三层级数据一次性从 API 获取，不做瀑布式加载
- 人工干预面板只在任务状态为 `pending_human` 时渲染
- 批量操作需要二次确认弹窗
- 浅色主题，状态颜色使用 Ant Design 标准色

## 验收标准

- [ ] 三层级正确展示（项目→任务→明细）
- [ ] 人工干预面板展示上下文，审批/驳回/修改意见操作正常
- [ ] 驳回时可输入意见和上传附件
- [ ] 多选任务后批量暂停/取消正常
- [ ] 操作后有成功/失败提示
- [ ] 无"创建任务"入口
- [ ] 状态 badge 样式正确（运行中蓝色、完成绿色、失败红色、人工干预橙色）

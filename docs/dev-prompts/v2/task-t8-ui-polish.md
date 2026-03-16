# Nexus 工作流编辑器 UI 优化

## 目标
参照 n8n 编辑器的视觉风格，对工作流编辑器进行全面 UI 优化，使其美观、专业、协调。

## 参考风格
打开 https://n8n.io 截图参考其编辑器界面。核心特点：
- 画布：白底 + 浅灰点状网格
- 左侧节点面板：浅灰底，节点项为白色卡片带彩色左边框和圆角
- 工具栏：嵌入画布上方，半透明毛玻璃效果，紧凑排列
- 节点卡片：白底、圆角、左侧彩色竖条、小图标+文字
- 右侧配置面板：浅色底，表单输入框白底带边框
- 整体干净、留白恰当、颜色克制

## 必读文件（先读完再动手）
- frontend/src/pages/workflows/WorkflowEditorPage.tsx
- frontend/src/components/workflow/EditorToolbar.tsx
- frontend/src/components/workflow/NodePanel.tsx
- frontend/src/components/workflow/NodeConfigPanel.tsx
- frontend/src/components/workflow/nodes/BaseNode.tsx
- frontend/src/components/workflow/nodes/node-styles.ts
- frontend/src/components/workflow/nodes/index.ts
- frontend/src/components/Layout/MainLayout.tsx（理解 Content/ContentInner 的约束）
- frontend/src/styles/tokens/color.ts

## 具体要求

### 1. 全屏布局
- 编辑器页面必须充满整个内容区域（去掉 MainLayout Content 的 padding 和 ContentInner 的 max-width 限制）
- 使用 useEffect 覆盖父元素样式（已有实现，保留并确认生效）
- 三栏布局：左节点面板(240px) + 中画布(flex:1) + 右配置面板(320px，无节点选中时隐藏)

### 2. 工具栏
- 嵌入画布上方（在 CanvasWrapper 内，ReactFlow 之前）
- 半透明毛玻璃背景（rgba(255,255,255,0.85) + backdrop-filter: blur(8px)）
- 圆角卡片样式，margin: 8px 12px
- 紧凑布局，按钮不要太大
- 阴影轻微：0 1px 3px rgba(0,0,0,0.08)

### 3. 节点面板（左侧）
- 背景：#f8fafc（极浅灰）
- 右边框：1px solid #e2e8f0
- 分类标题：小号字、灰色、加粗
- 节点项：白底卡片（#ffffff），圆角 8px，轻微边框 #e2e8f0
- 每个节点项左侧有彩色竖条（3px，节点类型对应颜色）
- 悬停时边框变为节点颜色，背景微灰 #f1f5f9
- 图标颜色用节点类型颜色，文字深色 #334155

### 4. 画布
- 背景：#ffffff
- 网格：dots 类型，颜色 #e2e8f0，间距 20px，大小 1px
- MiniMap：白底 #f8fafc，边框 #e2e8f0，圆角
- Controls 控件：白底，放在画布右下角

### 5. 节点卡片
- 白底 #ffffff，圆角 10px
- 边框 2px solid #e2e8f0，选中时 #3b82f6
- 左侧彩色竖条（4px）
- 标题文字 #0f172a，副标题 #64748b
- 悬停时阴影加深
- 触发器节点（无输入端口）视觉上稍有区分，可以用彩色边框
- 连线端口（Handle）：小圆点，与节点颜色一致

### 6. 配置面板（右侧）
- 背景：#f8fafc
- 左边框：1px solid #e2e8f0
- 标题区域：节点类型图标+名称，深色文字
- 表单输入框：白底 #ffffff，边框 #e2e8f0，focus 时 #6366f1
- 标签文字：#334155
- 删除按钮：红色 #dc2626

### 7. 配色一致性
- 主色调：#6366f1（indigo，品牌色）
- 成功：#16a34a
- 警告：#d97706
- 错误：#dc2626
- 节点类型颜色保持现有 NODE_META 中的定义不变

## 完成标准
- [ ] 编辑器全屏充满容器，无多余留白
- [ ] 三栏布局正常：节点面板+画布+配置面板
- [ ] 所有区域配色统一协调，浅色主题
- [ ] 节点可拖拽到画布
- [ ] 点击节点后右侧配置面板出现，关闭节点后面板消失
- [ ] 前端 console 无 error
- [ ] 无 TypeScript 类型错误

## 不要做的事
- 不要修改 `backend/` 目录
- 不要修改 `frontend/src/types/workflow.ts` 中的类型定义
- 不要修改 `frontend/src/stores/useWorkflowStore.ts` 中的逻辑
- 不要 git commit

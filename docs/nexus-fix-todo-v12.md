# Nexus Fix Todo v12 — DAG 可视化美化 + SSE 连接状态修复

> 创建时间：2026-03-21 16:30 UTC+8

---

## ✅ 已修复

### Fix L：Nginx SSE 代理配置

**根因**：Nginx `/api/` location 缺少 SSE 必要配置（proxy_buffering off 等），导致 EventSource 连接建立后收不到数据或被缓冲。

**修复**：在 `/etc/nginx/conf.d/orchestrator.conf` 中新增 `/api/gateway/tasks/` location：
```nginx
location /api/gateway/tasks/ {
    proxy_pass http://127.0.0.1:8082;
    proxy_buffering off;
    proxy_cache off;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_read_timeout 86400s;
    chunked_transfer_encoding off;
}
```

**状态**：已部署，Nginx 已 reload。

---

## 待修复 Issues

### Issue I：TaskWorkflowDAG 视觉美化

**现状**：画布 280px 太小、浅色背景与白底节点对比度低、连线太淡、运行中节点无动画。

**修复方向**（`frontend/src/components/tasks/TaskWorkflowDAG.tsx` + `node-styles.ts`）：

1. **画布高度**：280px → 360px，`CanvasContainer` 改为暗色背景 `#f1f5f9` 配点阵
2. **节点运行中动画**：给 `status === 'running'` 的节点加 CSS pulse 动画：
   ```css
   @keyframes pulse-border {
     0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
     50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
   }
   ```
3. **连线增强**：已完成的边变绿（`#22c55e`），运行中的边变蓝（`#3b82f6`），未执行的保持灰色
4. **节点完成状态**：成功的节点左上角加 ✅ badge，失败的加 ❌ badge
5. **fitView padding**：增加 padding 确保节点不贴边
6. **dark theme 适配**：CanvasContainer 背景色跟随主题（当前写死 `#fafafa`）

### Issue J：SSE "连接中..." 状态显示修复

**现象**：前端 TaskDetailPage 中 Stream 标签页一直显示"连接中..."。

**可能原因**：
- EventSource onerror 触发后 `isConnected` 被设为 false，但连接实际已建立
- 前端 `VITE_API_BASE_URL` 配置可能不对，导致 URL 拼接错误
- Nginx 代理配置（已修复 Issue I/L）

**排查方向**：
1. 检查前端构建产物中 `VITE_API_BASE_URL` 默认值是否正确（应为 `/api`）
2. `es.onopen` 是否被正确触发 — 可以在前端加 `console.log('SSE connected')`
3. 确保 Nginx SSE 修复生效后，EventSource 能收到 `onopen` 事件
4. "连接中..." 文案改为更友好的 "等待连接..."，连接成功后显示 "已连接"

### Issue K：执行记录 Tab 空数据

**现象**：执行记录 tab 打开但没有数据。

**排查方向**：
1. 确认 `/api/v1/tasks/{id}/executions` 端点是否返回数据
2. 检查前端 TaskDetailPage 中执行记录 tab 的数据获取逻辑
3. 可能 task_id 和 execution_id 的关联关系需要检查（当前 node_executions 表中 task_id 字段可能为 NULL）

---

## 修复优先级

1. **Issue L**（Nginx SSE）✅ 已修复
2. **Issue I**（DAG 美化）→ 用户体验提升
3. **Issue J**（SSE 连接状态）→ 需要确认 Nginx 修复后是否已解决
4. **Issue K**（执行记录数据）→ 数据关联问题

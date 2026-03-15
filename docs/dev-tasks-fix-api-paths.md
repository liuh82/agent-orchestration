# 紧急修复：后台管理页面全部 404 — API 路径前缀缺失

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题
所有后台管理页面（全局统计、系统设置、通知配置、用户管理、Gateway 管理）都报 404 错误。

**根因**：前端 client.ts 的 `baseURL` 是 `/api`，而后台路由全部挂载在 `/api/v1/` 下。前端调用时缺少 `/v1` 前缀。

### 路径对照表

| 前端当前调用 | 实际发出的请求 | 后端正确路由 | 需要 |
|-------------|---------------|-------------|------|
| `/admin/stats/global` | `/api/admin/stats/global` | `/api/v1/admin/stats/global` | 改为 `/v1/admin/stats/global` |
| `/admin/settings` | `/api/admin/settings` | `/api/v1/admin/settings` | 改为 `/v1/admin/settings` |
| `/admin/notifications/channels` | `/api/admin/notifications/channels` | `/api/v1/notifications/channels` | 改为 `/v1/notifications/channels` |
| `/admin/users` | `/api/admin/users` | `/api/v1/admin/users` | 改为 `/v1/admin/users` |
| `/v1/gateway/bridges` | `/api/v1/gateway/bridges` | `/api/gateway/bridges` | 改为 `/gateway/bridges` |
| `/v1/gateway/bridges/{id}/disconnect` | `/api/v1/gateway/bridges/{id}/disconnect` | `/api/gateway/bridges/{id}/disconnect` | 改为 `/gateway/bridges/{id}/disconnect` |

**注意 Gateway 是反过来的** — 它的路径是 `/api/gateway`，没有 `/v1`！

## 需要修改的文件

### 1. `frontend/src/pages/admin/AdminDashboard.tsx`
第 195 行：
```ts
// 改前
api.get('/admin/stats/global')
// 改后
api.get('/v1/admin/stats/global')
```

### 2. `frontend/src/pages/admin/AdminStatsPage.tsx`
第 197 行：
```ts
// 改前
api.get('/admin/stats/global')
// 改后
api.get('/v1/admin/stats/global')
```

### 3. `frontend/src/api/settings.ts`
第 4 行和第 6 行：
```ts
// 改前
api.get('/admin/settings')
api.put('/admin/settings', { settings })
// 改后
api.get('/v1/admin/settings')
api.put('/v1/admin/settings', { settings })
```

### 4. `frontend/src/api/notifications.ts`
第 13 行（`listGlobal`）以及文件中其他 `/admin/notifications/` 开头的路径：
```ts
// 改前
api.get('/admin/notifications/channels')
// 改后
api.get('/v1/notifications/channels')
```
**注意**：通知接口后端前缀是 `/api/v1/notifications`，不是 `/api/v1/admin/notifications`。

### 5. `frontend/src/pages/admin/UserManagePage.tsx`
第 107 行、第 120 行、第 134 行：
```ts
// 改前
api.get('/admin/users', ...)
api.put(`/admin/users/${userId}`, ...)
api.put(`/admin/users/${userId}`, ...)
// 改后
api.get('/v1/admin/users', ...)
api.put(`/v1/admin/users/${userId}`, ...)
api.put(`/v1/admin/users/${userId}`, ...)
```

### 6. `frontend/src/pages/admin/GatewayPage.tsx`
第 93 行和第 104 行：
```ts
// 改前（这是上次 review 修的，但修反了！）
api.get('/v1/gateway/bridges', ...)
api.post(`/v1/gateway/bridges/${bridgeId}/disconnect`)
// 改后（Gateway 没有 /v1）
api.get('/gateway/bridges', ...)
api.post(`/gateway/bridges/${bridgeId}/disconnect`)
```

## 验证
修改完后，手动测试以下 API 调用确认都返回 200：
```bash
# 获取 token
TOKEN=$(curl -s -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

# 测试各接口
curl -s http://localhost:8082/api/v1/admin/stats/global -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8082/api/v1/admin/settings -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8082/api/v1/notifications/channels -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8082/api/v1/admin/users -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8082/api/gateway/bridges -H "X-API-Key: nexus-admin-key-2024"
```

## 注意事项
1. 搜索整个 frontend/src 目录，确保没有遗漏其他 `/admin/` 开头的 API 调用（应该都改为 `/v1/admin/`）
2. 前台页面（Dashboard、Projects、Tasks 等）的 API 路径不需要改，它们已经正确
3. 不要改后端路由，只改前端调用路径
4. commit 并推送到 GitHub，通知我部署

## 完成后
commit 推送，通知我。

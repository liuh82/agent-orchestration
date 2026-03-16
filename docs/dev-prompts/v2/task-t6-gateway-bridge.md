# Nexus 开发任务 T6：Gateway Bridge CRUD

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md（Gateway 部分）
- backend/app/routers/gateway.py
- backend/app/routers/bridges.py
- frontend/src/pages/admin/GatewayPage.tsx
- backend/app/models/gateway.py

## 任务目标
补全 Bridge 的增删改查功能。

## 具体要求

### 6.1 后端 API

新增接口（如 bridges.py 不存在则创建）：

```
POST   /api/v1/bridges              — 创建 Bridge
  Body: { name, bridge_type, host, port, protocol, auth_config }
  返回: { id, name, status, ... }

GET    /api/v1/bridges/{id}         — 获取 Bridge 详情

PUT    /api/v1/bridges/{id}         — 更新 Bridge 配置
  Body: { name?, host?, port?, protocol?, auth_config? }

DELETE /api/v1/bridges/{id}         — 删除 Bridge（断开连接后删除）
```

### 6.2 前端页面

GatewayPage 增加：
- 「新增 Bridge」按钮 → Modal 表单（名称、类型、主机、端口、协议、认证配置）
- 每行增加「编辑」按钮 → Modal 编辑表单
- 每行增加「删除」按钮 → Popconfirm 确认后调用删除 API
- Bridge 类型选项：websocket, http, grpc, stdio

### 6.3 认证配置
根据 bridge_type 显示不同认证字段：
- websocket: token 或 无
- http: api_key 或 basic_auth(user+password)
- grpc: tls_cert 或 无
- stdio: command (启动命令)

## 完成标准
- [ ] 可以创建新 Bridge
- [ ] 可以编辑 Bridge 配置
- [ ] 可以删除 Bridge
- [ ] Bridge 列表正常展示
- [ ] 前端 console 无 error

## 不要做的事
- 不要修改现有 list/disconnect API
- 不要 git commit

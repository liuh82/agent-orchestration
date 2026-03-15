# 测试验证提示词（本地 Claude Code）

---

## 第一步：构建验证

**提示词：**

```
请验证项目能否正常构建。

### 1. Python 后端编译检查
```bash
cd backend && python -m py_compile app/main.py && python -m py_compile app/auth.py && python -m py_compile app/rate_limit.py && python -m py_compile app/routers/gateway.py && python -m py_compile app/services/gateway/ws_server.py && echo "✅ Python build OK"
```

### 2. TypeScript remote-agent-bridge 类型检查
```bash
cd remote-agent-bridge && npx tsc --noEmit && echo "✅ TypeScript build OK"
```

### 3. Frontend 类型检查
```bash
cd frontend && npx tsc --noEmit && echo "✅ Frontend build OK"
```

如果有任何错误，报告错误信息。
```

---

## 第二步：依赖安全扫描

**提示词：**

```
请检查依赖安全漏洞。

### 1. remote-agent-bridge
```bash
cd remote-agent-bridge && npm audit 2>&1
```

### 2. frontend
```bash
cd frontend && npm audit 2>&1
```

报告任何 High/Critical 漏洞。
```

---

## 第三步：运行单元测试

**提示词：**

```
请运行项目的单元测试。

### 1. Python 测试（如果有）
```bash
cd backend && python -m pytest tests/ -v 2>&1 || echo "No pytest tests or tests failed"
```

### 2. TypeScript 测试
```bash
cd remote-agent-bridge && npm test 2>&1 || npx jest --config jest.config.json 2>&1
```

报告测试结果。
```

---

## 第四步：验证安全修复

**提示词：**

```
请验证安全修复是否正确实现。通过代码审查确认以下修复点：

### 1. auth.py - API Key 安全
检查：
- [ ] 生产环境（ENVIRONMENT=production）未设置 API_KEYS 时启动报错
- [ ] 开发环境有默认 Key 但有警告日志
- [ ] 支持 ADMIN_API_KEYS 环境变量

### 2. cli-adapter.ts - 命令注入修复
检查：
- [ ] agentType 必须来自 AGENT_MAPPINGS 或白名单
- [ ] prompt 参数经过 shell 转义
- [ ] validateCwd() 函数存在且正确实现

### 3. rate_limit.py - Rate Limiting
检查：
- [ ] slowapi 正确配置
- [ ] @limiter.limit 装饰器应用到关键 API

### 4. ws_server.py - 连接数限制
检查：
- [ ] MAX_CONNECTIONS 常量存在
- [ ] 连接数超限时返回正确错误码

报告每个检查项的结果（✅/❌ + 说明）。
```

---

## 第五步：功能回归测试

**提示词：**

```
请进行简单的功能回归测试（通过代码审查或手动测试）。

### 必须验证
1. WebSocket 连接和认证流程未被破坏
2. REST API 端点仍然可访问
3. 任务提交/路由功能正常
4. Bridge 注册/断开功能正常

### 测试方法
如果可以启动服务：
```bash
# Backend
cd backend && python -m uvicorn app.main:app --reload --port 8083 &

# 测试 WebSocket
wscat -c ws://localhost:8083/api/v1/gateway/ws?token=test-token

# 测试 REST API
curl http://localhost:8083/api/v1/gateway/bridges
```

如果无法启动服务，通过代码审查确认关键路径未被修改。
```

---

## 第六步：生成测试报告

**提示词：**

```
请汇总以上所有测试结果，生成测试报告并保存到：
/root/.openclaw/workspace/agent-orchestration/docs/reviews/test-report-2026-03-14.md

报告格式：

```markdown
# 测试验证报告

## 构建验证
- Python: ✅/❌ + 详情
- TypeScript: ✅/❌ + 详情
- Frontend: ✅/❌ + 详情

## 依赖安全
- remote-agent-bridge: ✅/❌ + 漏洞列表
- frontend: ✅/❌ + 漏洞列表

## 单元测试
- Python: 通过/失败 + 详情
- TypeScript: 通过/失败 + 详情

## 安全修复验证
- auth.py: ✅/❌
- cli-adapter.ts: ✅/❌
- rate_limit.py: ✅/❌
- ws_server.py: ✅/❌

## 功能回归
- WebSocket: ✅/❌
- REST API: ✅/❌
- 任务路由: ✅/❌
- Bridge管理: ✅/❌

## 整体结论
通过/不通过 + 待解决问题
```
```

---

## 执行顺序

1. 先运行第一步（构建验证）
2. 如果构建通过，运行第二步（依赖扫描）
3. 如果依赖无高危漏洞，运行第三步（单元测试）
4. 运行第四步（安全修复验证）
5. 运行第五步（功能回归）
6. 最后运行第六步生成报告

每步完成后报告结果再进入下一步。

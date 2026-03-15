# 安全审计提示词（用于本地 Claude Code）

项目路径：agent-orchestration（本地项目根目录）

---

## 第一步：安全审计

**提示词：**

```
请对当前项目进行全面的安全审计。项目包含两个部分：

1. Backend (Python/FastAPI) - 位于 backend/ 目录
   - Gateway WebSocket Server
   - REST API 路由
   - 数据库操作 (SQLAlchemy)

2. Remote Agent Bridge (TypeScript/Node.js) - 位于 remote-agent-bridge/ 目录
   - WebSocket 客户端
   - HTTP Server
   - 安全沙箱 (security/sandbox.ts)
   - 数据库操作 (better-sqlite3)
   - 命令执行 (adapters/cli-adapter.ts)

请从以下维度进行审计：

### 1. 注入攻击
- [ ] SQL 注入：检查所有数据库查询，是否使用参数化查询/ORM
- [ ] 命令注入：检查 cli-adapter.ts 和 sandbox.ts，命令拼接是否安全
- [ ] XSS：检查 HTTP 响应中是否有未转义的用户输入
- [ ] 路径遍历：检查文件操作中 path 参数是否经过校验

### 2. 认证授权
- [ ] WebSocket 连接认证机制是否可绕过
- [ ] API Key 验证是否安全（硬编码？日志泄露？）
- [ ] 是否存在越权风险（未授权访问其他用户的资源）

### 3. 数据安全
- [ ] 敏感信息（API Key、Token、密码）是否有泄露风险
  - 检查日志输出
  - 检查错误响应
  - 检查前端/配置文件
- [ ] 数据库中敏感数据是否加密存储
- [ ] WebSocket 通信是否使用 TLS

### 4. 输入验证
- [ ] API 请求参数是否有校验（长度、类型、范围）
- [ ] WebSocket 消息体是否有结构验证
- [ ] 文件路径参数是否限制在允许范围内

### 5. 依赖安全
- [ ] 检查 package.json 和 requirements.txt 中的依赖版本
- [ ] 是否有已知漏洞的依赖
- [ ] 运行 `npm audit` 检查前端依赖

### 6. 拒绝服务
- [ ] WebSocket 连接数是否有限制
- [ ] API 是否有 rate limiting
- [ ] 任务队列是否有上限
- [ ] 数据库连接池是否有限制

### 7. 竞态条件
- [ ] 检查全局状态管理（bridge_manager 等）
- [ ] 检查并发任务处理逻辑

请输出审计报告，格式如下：
- 每个发现标记风险等级：🔴 Critical / 🟡 High / 🟠 Medium / 🔵 Low
- 给出具体的文件位置和代码行号
- 提供修复建议和示例代码
- 最后给出整体安全评级和必须修复的问题清单
```

---

## 第二步：构建验证

**提示词：**

```
安全审计完成后，请进行构建验证：

1. Python 后端构建检查：
```bash
cd backend && python -m py_compile app/main.py && python -m py_compile app/routers/gateway.py && python -m py_compile app/services/gateway/*.py && echo "Python build OK"
```

2. TypeScript 前端构建检查：
```bash
cd remote-agent-bridge && npm install && npx tsc --noEmit && echo "TypeScript build OK"
```

3. 如果构建失败，修复所有错误后重新检查。

4. 运行 npm audit 检查依赖安全：
```bash
cd remote-agent-bridge && npm audit
```

请报告构建结果。
```

---

## 第三步：测试验证（如果项目有测试）

**提示词：**

```
请运行项目现有测试：

1. Python 后端测试（如果有）：
```bash
cd backend && python -m pytest tests/ -v 2>&1 || echo "No tests found"
```

2. TypeScript 前端测试（如果有）：
```bash
cd remote-agent-bridge && npm test 2>&1 || echo "No tests found"
```

如果没有测试，跳过此步并记录。
```

---

## 第四步：提交代码

**提示词：**

```
所有修复和验证完成后，请提交代码：

1. 查看变更：
```bash
git status && git diff --stat
```

2. 提交所有修复：
```bash
git add -A && git commit -m "fix: 修复代码审查P0/P1问题和安全审计发现

- 修复 bridge_manager 竞态条件
- 修复 create_bridge 事务错误处理
- 添加 WebSocket 消息运行时类型校验
- 修复 HTTP POST /tasks 任务入队
- 修复 SessionLocal 会话泄漏
- 强化沙箱命令检查
- 修复 WebSocket 连接 DB 会话泄漏
- 统一参数命名风格
- 安全审计修复"
```

3. 推送到远程：
```bash
git push origin main
```

推送完成后报告结果。
```

---

## 使用说明

按顺序执行第一步到第四步。每步完成后确认结果再进入下一步。
如果安全审计发现 Critical/High 级别问题，先修复再继续。

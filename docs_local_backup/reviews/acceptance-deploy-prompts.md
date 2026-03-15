# 验收确认 + 部署上线提示词（本地执行）

---

## 第一步：修复 P1 幽灵 Bridge 问题

**提示词：**

```
请修复 select_bridge() 未检查 WS 连接状态的问题。

问题: BridgeManager.select_bridge() 基于数据库 status 字段选择 Bridge，未检查 ws_server.is_connected(bridge_id)。数据库中存在"幽灵 Bridge"（status=online 但 WS 已断开）时任务路由失败返回 500。

修复:

1. 确认 ws_server.is_connected(bridge_id) 方法是否已存在，如不存在则添加。

2. 修改 select_bridge() 或调用链，在选择 Bridge 时过滤掉 WS 未连接的：

```python
def select_bridge(self, task) -> Optional[str]:
    candidates = []
    for bridge in self.get_active_bridges():
        bridge_id = bridge.id
        # 检查 WS 是否真的在线
        if self.ws_server and hasattr(self.ws_server, 'is_connected'):
            if not self.ws_server.is_connected(bridge_id):
                logger.debug(f"Bridge {bridge_id} is DB-online but WS-offline, skipping")
                bridge.status = "offline"
                self.db.commit()
                continue
        candidates.append(bridge)
    
    if not candidates:
        return None
    return min(candidates, key=lambda b: b.active_tasks or 0).id
```

3. 验证构建:
```bash
cd backend && python -m py_compile app/services/gateway/task_router.py && python -m pytest tests/ -v
```
```

---

## 第二步：修复 P2/P3 小问题（建议一起修）

**提示词：**

```
请修复以下小问题：

1. P2: backend/tests/test_org_features.py 中 9 个测试函数使用 return 而非 assert → 改为 assert True 或移除 return

2. P2: SQLAlchemy relationship overlaps 警告 → 在关系定义中添加 overlaps 参数

3. P3: 4 处 Pydantic 模型使用 class Config → 迁移到 model_config = ConfigDict(...)

修复后验证:
```bash
cd backend && python -m pytest tests/ -v
```
```

---

## 第三步：提交推送

**提示词：**

```
提交所有修复并推送：

```bash
git add -A
git commit -m "fix: 修复幽灵Bridge路由 + P2/P3清理

- select_bridge() 增加 WS 连接状态检查
- pytest 返回值兼容性修复
- SQLAlchemy overlaps 警告修复
- Pydantic ConfigDict 迁移"
git push origin main
```
```

---

## 第四步：生成验收确认报告

**提示词：**

```
请生成验收确认报告，汇总全流程结果。

参考以下阶段文档（在 docs/reviews/ 目录下）：
- code-review-2026-03-14.md — 首次代码审查
- fix-prompts.md — P0/P1 修复记录
- security-audit-2026-03-14.md — 安全审计
- security-fix-prompts.md — 安全修复记录
- test-report-2026-03-14.md — 测试验证
- code-review-final-2026-03-14.md — 最终代码复查

报告保存到: docs/reviews/acceptance-report-2026-03-14.md

格式：

```markdown
# 验收确认报告

项目: agent-orchestration
版本: v2.4.0
日期: 2026-03-14

## 流程完成状态

| 阶段 | 状态 | 报告 |
|------|------|------|
| 代码审查 | ✅ 完成 | code-review-2026-03-14.md |
| P0/P1 修复 | ✅ 完成 | (commit log) |
| 安全审计 | ✅ 完成 | security-audit-2026-03-14.md |
| 安全修复 | ✅ 完成 | (commit log) |
| 测试验证 | ✅ 通过 | test-report-2026-03-14.md |
| 代码复查 | ✅ 有条件通过 | code-review-final-2026-03-14.md |
| P1 幽灵Bridge | ✅ 已修复 | 本次 |
| 验收确认 | ✅ | 本报告 |

## 修复问题清单
- 列出所有修复的问题（P0+P1+P2+P3）

## 剩余已知问题
- 如有未修复的问题列出

## 整体验收结论
✅ 通过 / ❌ 不通过

## 下一步
- 部署上线
```
```

---

## 第五步：部署上线

**提示词：**

```
请执行部署上线。

### 1. 创建版本标签
```bash
git tag -a v2.4.0 -m "v2.4.0: 安全加固 + Bug修复

- 修复命令注入和路径遍历漏洞
- API Key 生产环境强制配置
- Rate Limiting 全端点覆盖
- WebSocket 连接数限制
- 依赖安全修复（0漏洞）
- 幽灵 Bridge 路由修复
- 137 单元测试全部通过"
git push origin v2.4.0
```

### 2. 部署（根据你的部署方式选择）

方式 A — 如果有部署脚本：
```bash
./deploy.sh v2.4.0
```

方式 B — 手动部署：
```bash
# Backend
cd backend
pip install -r requirements.txt
# 重启 uvicorn 服务

# Frontend
cd frontend
npm install && npm run build
# 重启 nginx 或静态文件服务
```

### 3. 部署后验证
```bash
# 健康检查
curl https://your-domain/health

# API 可用性
curl -H "Authorization: Bearer your-api-key" https://your-domain/api/agents/

# WebSocket
wscat -c wss://your-domain/api/v1/gateway/ws?token=your-api-key
```
```

---

## 执行顺序

1. 第一步 P1 修复 → 2. 第二步 P2/P3 → 3. 第三步提交推送 → 4. 第四步验收报告 → 5. 第五步部署

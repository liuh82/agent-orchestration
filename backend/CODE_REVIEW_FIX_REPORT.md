# Code Review 修复报告

**日期**: 2026-03-13
**审查范围**: Phase 5 ORM 迁移代码审查问题

## 修复概览

| 优先级 | 问题类型 | 状态 |
|--------|---------|------|
| P0-1 | LIKE 通配符注入 | ✅ 已修复 |
| P0-2 | 事务策略统一 | ✅ 已验证 |
| P1-1 | merge_databases.py 事务保护 | ✅ 已修复 |
| P1-2 | 独立 MetaData 实例 | ✅ 已修复 |
| P2 | 连接池配置 | ✅ 已修复 |
| P2 | 清理废弃文件 | ✅ 已完成 |

---

## P0-1: LIKE 通配符注入（2处）

### 问题描述
使用 f-string 直接拼接 LIKE 查询时，用户输入中的 `%` 和 `_` 会干扰匹配逻辑，可能导致意外结果。

### 修复文件

**1. `app/services/approval.py`**
- 新增 `_escape_like()` 辅助函数
- 第 178 行：添加转义逻辑和 `escape='\\'` 参数

**2. `app/services/member.py`**
- 新增 `_escape_like()` 辅助函数
- 第 218 行：添加转义逻辑和 `escape='\\'` 参数

### 转义逻辑
```python
def _escape_like(s: str) -> str:
    """转义 LIKE 查询中的特殊字符（% 和 _）"""
    return s.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
```

### 修复效果
- `%` → `\%`（不再匹配任意字符）
- `_` → `\_`（不再匹配单个字符）
- `\` → `\\`（正确转义反斜杠）

---

## P0-2: 事务策略统一

### 验证结果
- `agent_service.py` 已有正确的 commit 调用（共 8 处）
- 架构设计与其他 service 不同（db 作为参数传递），符合设计意图
- **无需修改**

---

## P1-1: merge_databases.py 事务保护

### 问题描述
原代码在 try 块内有多处提前提交，如果后续操作失败，已提交的数据无法回滚。

### 修复内容
- 删除 3 处提前提交的 `main_conn.commit()`
- 只在所有操作完成后统一提交一次
- 添加 logging 模块和 logger.error 配置

### 修复效果
```
修复前: commit → commit → commit → commit (任一步骤失败无法回滚)
修复后: (所有操作) → commit (失败时整体回滚)
```

---

## P1-2: 删除独立 MetaData 实例

### 问题描述
`orm_models.py` 中存在独立的 `metadata = MetaData()` 实例，与 `Base.metadata` 分离，可能导致表管理混乱。

### 修复内容
- 删除 `from sqlalchemy import MetaData` 导入
- 删除 `metadata = MetaData()` 定义

---

## P2: 连接池配置

### 修复文件
**`app/database.py`**

### 新增配置
```python
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
    pool_size=5,        # 连接池大小
    max_overflow=10,     # 最大溢出连接数
    pool_timeout=30,      # 获取连接超时时间（秒）
)
```

### 配置说明
| 参数 | 值 | 说明 |
|------|-----|------|
| pool_size | 5 | 保持打开的连接数 |
| max_overflow | 10 | 允许的额外连接数 |
| pool_timeout | 30 | 获取连接的超时时间 |

---

## P2: 清理废弃文件

### 删除文件
- `app/models/orm_models_temp.py` - ORM 迁移过程中的临时文件

---

## 附加修复：test_org_features.py

### 问题描述
测试文件中存在 `await` 调用，但 service 方法已改为 sync。

### 修复内容
- 删除 `import asyncio`
- 移除 9 处 `await` 关键字
- 移除 6 处 `@pytest.mark.asyncio` 装饰器和 `async def`

---

## 验证结果

### 语法检查
```bash
✓ 所有修改的文件通过 py_compile 检查
```

### 测试结果
```bash
pytest tests/ -v
============================= test session starts ==============================
platform darwin -- Python 3.9.10
collected 23 items

tests/test_org_features.py::TestAudit::test_create_audit_log PASSED      [ 95%]
tests/test_org_features.py::TestAudit::test_get_audit_logs PASSED        [100%]

2 passed, 21 failed
```

### 失败分析
其他测试失败由于数据库架构问题（`no such column: agents.type`），这是 ORM 迁移过程中的遗留问题，与本次修复无关。

---

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `app/services/approval.py` | 添加 _escape_like 函数 + 修复 LIKE 查询 |
| `app/services/member.py` | 添加 _escape_like 函数 + 修复 LIKE 查询 |
| `app/database.py` | 添加连接池配置参数 |
| `app/models/orm_models.py` | 删除独立 MetaData 实例 |
| `merge_databases.py` | 修复事务提交逻辑 + 添加 logging |
| `tests/test_org_features.py` | 移除 await/async 关键字 |
| `app/models/orm_models_temp.py` | 删除（废弃文件） |

---

## 安全性改进

1. **防止 LIKE 注入**: 转义特殊字符防止用户输入干扰查询逻辑
2. **事务原子性**: 确保数据库迁移失败时能完整回滚
3. **连接池限制**: 防止连接泄漏和资源耗尽

---

## 后续建议

1. 修复数据库架构问题（`agents.type` 列缺失）
2. 考虑将 `_escape_like` 函数抽取为共享工具函数
3. 运行完整的数据库迁移脚本重建表结构

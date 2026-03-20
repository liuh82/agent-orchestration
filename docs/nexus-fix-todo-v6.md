# Nexus 待修复问题清单 v6（2026-03-21 00:38）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix I（P0）：if_node `_coerce_expected` 收到 float 崩

**问题**：if_1 条件配置里 `value: 0.8`（JSON number），传入 `_coerce_expected(value: str)` 后第一行 `value.lower()` 崩溃。

**文件**：`backend/app/services/workflow_engine/nodes/if_node.py` 第 54 行，`_coerce_expected` 函数

**修复方向**：函数开头加类型 guard，非 string 就直接返回（float/int 已是目标类型）：

```python
def _coerce_expected(value):
    if not isinstance(value, str):
        return value
    # 原有逻辑...
```

---

## 当前测试进展（2026-03-21 00:38）

全链路测试结果：

| 节点 | 状态 | 耗时 |
|------|------|------|
| trigger_1 | ✅ success | - |
| input_1 | ✅ success | 6ms |
| spec_1 | ✅ success | - |
| plan_1 | ✅ success | 66s |
| agent_1 | ✅ success | 101ms |
| review_1 | ✅ success | 5.7s |
| verify_1 | ✅ success | 1.6s |
| if_1 | ❌ failed | - |

**Fix I 修完后**，if_1 的条件 `verify_1.pass_rate >= 0.8` 会正常判断，然后走对应分支到 output_1 或 agent_2。

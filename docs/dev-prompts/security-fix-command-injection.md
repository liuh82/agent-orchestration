# 安全修复：lobster_engine.py 命令注入风险

## 任务目标

修复 `backend/app/services/lobster_engine.py` 中的安全漏洞。该文件是旧 Lobster 引擎适配器，已被 Nexus 引擎替代，但仍需加固。

## 修改文件

```
backend/app/services/lobster_engine.py
```

## 具体修复项

### 1. execution_id 输入校验

`resume()` 和 `cancel()` 方法中 `execution_id` 直接传入 subprocess，需加 UUID 格式校验：

```python
import re

UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

def _validate_uuid(value: str) -> bool:
    return bool(UUID_PATTERN.match(value))
```

在 `resume`/`cancel`/`get_status`/`get_logs` 方法开头加：
```python
if not _validate_uuid(execution_id):
    raise ValueError(f"Invalid execution_id: {execution_id}")
```

### 2. temp_dir 使用 UUID 替代时间戳

当前 `/tmp/lobster-{timestamp}` 路径可预测，存在 TOCTOU 风险。改为：
```python
import uuid
temp_dir = f"/tmp/lobster-{uuid.uuid4().hex}"
```

### 3. context 参数限制

`execute()` 方法中 `context` 通过 `json.dumps` 传入 subprocess 参数（列表传参，无 shell 注入风险），但应限制 JSON 深度/大小防止资源耗尽：
```python
MAX_CONTEXT_SIZE = 1024 * 1024  # 1MB

context_json = json.dumps(context)
if len(context_json) > MAX_CONTEXT_SIZE:
    raise ValueError(f"Context too large: {len(context_json)} bytes (max {MAX_CONTEXT_SIZE})")
```

### 4. 文件头部添加 deprecated 标记

该引擎已被 Nexus 引擎替代：
```python
"""
Lobster workflow engine adapter (DEPRECATED).

This module is retained for backward compatibility but is superseded by
the Nexus workflow engine (app/services/workflow_engine/).
"""
```

### 5. lobster_path 白名单校验

`__init__` 接收的 `lobster_path` 应限制为合法可执行文件路径：
```python
def __init__(self, lobster_path: str = "lobster"):
    # Only allow absolute paths or bare command names (searched in PATH)
    if os.path.isabs(lobster_path):
        if not os.path.isfile(lobster_path) or not os.access(lobster_path, os.X_OK):
            raise ValueError(f"Invalid lobster_path: not an executable file")
    # bare name like "lobster" is OK — subprocess will search PATH
    self.lobster_path = lobster_path
```

## 约束

- Python 兼容 3.9：用 `Optional[str]` 不用 `str | None`
- 不修改任何接口签名
- 保持向后兼容
- 添加 `import re` 和 `import uuid`

## 验收标准

- [ ] `execution_id` 非法格式时抛出 ValueError
- [ ] `temp_dir` 使用 uuid4 生成
- [ ] `context` 超过 1MB 时抛出 ValueError
- [ ] `lobster_path` 绝对路径不存在或不可执行时抛出 ValueError
- [ ] 文件头部有 DEPRECATED 标记
- [ ] 模块可正常导入（`from app.services.lobster_engine import LobsterEngine`）
- [ ] 不影响现有功能

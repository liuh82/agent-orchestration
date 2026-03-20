# Nexus Bug 修复 — CC 执行 Prompt

> 项目路径：`/Users/lh8/projects/agent-orchestration`
> Bug 清单：`docs/nexus-bug-fix-list.md`
> 日期：2026-03-20

---

## Prompt 1: Bug #1 — 变量解析 alias_map（P0，最高优先级）

```
Read docs/nexus-bug-fix-list.md first, specifically Bug #1.

You are fixing a critical workflow engine bug: nodes bypass the VariableResolver's alias_map when resolving template variables.

## Problem

Multiple node types in backend/app/services/workflow_engine/nodes/ directly import and call `resolve_template()`, `resolve_variable()`, or `resolve_template_deep()` from the module-level variable_resolver. These calls do NOT pass `alias_map`, but the alias_map (which maps outputAlias → node_id) only exists on the VariableResolver instance stored in engine.py.

This means: if node "input_1" sets outputAlias="input", downstream nodes using {{input.description}} fail because the module-level functions don't know about the alias.

## Fix Steps

### Step 1: Add resolver to NodeContext

File: backend/app/services/workflow_engine/nodes/base.py

In the NodeContext class (or dataclass/NamedTuple), add:
```python
resolver: Optional["VariableResolver"] = None
```

Import VariableResolver at the top of the file (use TYPE_CHECKING if needed to avoid circular imports).

### Step 2: Inject resolver in engine

File: backend/app/services/workflow_engine/engine.py

In _execute_node(), after getting the resolver:
```python
resolver = _variable_resolvers.get(execution_id)
```

When creating NodeContext, pass the resolver:
```python
context = NodeContext(
    node_id=node_id,
    node_type=node_type,
    node_config=node_config,
    input_data=input_data,
    execution_id=execution_id,
    workflow_id=...,
    upstream_outputs=upstream_outputs,
    db_session=db,
    resolver=resolver,  # ADD THIS
)
```

### Step 3: Update ALL nodes to use context.resolver

For each file listed below, change the pattern:
  FROM: `resolve_template(template, context.upstream_outputs, ...)`
  TO:   `context.resolver.resolve_template(template)` if context.resolver else `resolve_template(template, context.upstream_outputs, ...)`

The fallback is important — don't break if resolver is None.

#### Files to update:

1. **spec_node.py** (line ~88):
   FROM: `resolve_template(requirement, context.upstream_outputs, context.input_data.get("_workflow_variables", {}), context.input_data.get("_loop_context"), context.input_data.get("_execution_context", {}))`
   TO: `context.resolver.resolve_template(requirement) if context.resolver else resolve_template(requirement, context.upstream_outputs, context.input_data.get("_workflow_variables", {}), context.input_data.get("_loop_context"), context.input_data.get("_execution_context", {}))`

2. **agent.py** (line ~136): Same pattern — resolve template for prompt

3. **code_node.py** (line ~85): Same pattern

4. **http_node.py** (line ~96-98): Uses resolve_template_deep — same fix but with context.resolver.resolve_deep()

5. **if_node.py** (line ~160): Uses resolve_variable — use context.resolver.resolve()

6. **loop_node.py** (line ~130, ~166): Same as if_node

7. **switch_node.py** (line ~85): Same as if_node

8. **transform.py** (line ~85, ~107): Same as if_node

9. **sub_workflow_node.py** (line ~111): Same as if_node

10. **plan_node.py** (if it exists and has the same issue): Same pattern

For each file:
- Remove `from ..variable_resolver import resolve_template, resolve_variable, resolve_template_deep` if no longer needed
- Or keep the import for the fallback case
- Use the resolver's methods which automatically have access to alias_map, node_outputs, workflow_variables, loop_context, etc.

### Step 4: Verify

Run:
```bash
cd backend && python3 -c "
from app.services.workflow_engine.nodes.base import NodeContext
from app.services.workflow_engine.variable_resolver import VariableResolver
r = VariableResolver()
r.set_node_output('input_1', {'description': 'test desc'}, alias='input')
print('Alias resolve:', r.resolve('input.description'))
print('Direct resolve:', r.resolve_template('{{input.description}}'))
print('OK')
"
```

Expected output:
```
Alias resolve: test desc
Direct resolve: test desc
OK
```

Commit: git add -A && git commit -m "fix(P0): 变量解析使用 VariableResolver 实例，支持 alias_map"
Do NOT push.
```

---

## Prompt 2: Bug #2 — db.commit 时序（P0）

```
Read docs/nexus-bug-fix-list.md first, specifically Bug #2.

You are fixing a data loss bug in the workflow engine: all node execution records are only committed once at the end, so a mid-execution crash loses all progress.

## Problem

In backend/app/services/workflow_engine/engine.py, the execute() method runs all parallel nodes via asyncio.gather(), and only commits in the finally block:
```python
try:
    await asyncio.gather(*tasks, return_exceptions=True)
finally:
    db.commit()
    db.close()
```

If the process crashes mid-execution, all completed node records are lost.

## Fix Steps

### Step 1: Add per-node commit in _execute_node

In backend/app/services/workflow_engine/engine.py, in the _execute_node() method, after the node execution completes (after updating node_exec status, output_data, etc., around line 290-310):

Add `db.commit()` after the successful flush. But be careful with SQLite concurrency.

### Step 2: Handle SQLite concurrency

SQLite has limited concurrent write support. Options:

**Option A (recommended): Use WAL mode + retry on locked**
- Ensure the database is in WAL mode: `PRAGMA journal_mode=WAL`
- Add a retry wrapper for db.commit() that catches `sqlalchemy.exc.OperationalError` and retries with exponential backoff (3 retries, 100ms base)

**Option B: Use an asyncio.Lock for DB writes**
- Create a module-level `db_lock = asyncio.Lock()`
- Wrap all db.commit() calls with `async with db_lock:`

Implement Option A first. If that's not sufficient, add Option B as well.

### Step 3: Add WAL mode check

In backend/app/models/base.py or wherever the engine/session is created, ensure:
```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()
```

### Step 4: Keep the finally commit as safety net

Keep the existing `db.commit()` in the finally block as a final safety net, but add a try/except around it since individual commits should have already saved the data.

### Verify

1. Run a simple workflow (trigger → spec), check that workflow_node_executions has records
2. The existing tests should still pass

Commit: git add -A && git commit -m "fix(P0): 节点级 db.commit + SQLite WAL 模式，防止中途 crash 丢失进度"
Do NOT push.
```

---

## Prompt 3: Bug #3 — WorkflowConfig 序列化 500（P1）

```
Read docs/nexus-bug-fix-list.md first, specifically Bug #3.

You are fixing a serialization bug: GET /api/v1/workflows/ returns 500 because WorkflowConfig Pydantic objects cannot be JSON serialized.

## Problem

When listing workflows, the config field is stored as JSON string in DB. After loading, it gets deserialized into a Pydantic WorkflowConfig object. FastAPI's JSONResponse cannot serialize nested Pydantic objects.

## Fix Steps

1. Read backend/app/routers/workflows.py — find get_workflows() and get_workflow()
2. Read backend/app/services/workflow.py — find the service functions they call
3. Ensure the returned workflow data uses plain dicts (not Pydantic models) for the config field
4. If using Pydantic model: use model.model_dump() or json.loads(config_str) to convert to dict
5. Test: `cd backend && python3 -c "from app.routers.workflows import get_workflows; print('import OK')"`

### Verify
```bash
cd backend && uvicorn main:app --host 127.0.0.1 --port 8082 &
sleep 3
curl -s http://127.0.0.1:8082/api/v1/workflows/ -H "Authorization: Bearer <token>" | python3 -m json.tool | head -20
```
(Use a valid token from the database or API_KEYS config)

Commit: git add -A && git commit -m "fix(P1): WorkflowConfig 序列化修复，返回 dict 而非 Pydantic 对象"
Do NOT push.
```

---

## Prompt 4: Bug #4 — 前端项目列表（P1，需手动排查）

```
Read docs/nexus-bug-fix-list.md first, specifically Bug #4.

You are debugging a frontend issue: the project list page shows no data even though the database has projects.

## Context
- Database has project: id=b8261dca-f7e9-458a-9bf2-9e8f1f4a82c3, name="Claude Code Desktop", status=active
- Backend is running on port 8082
- The GET /api/v1/projects/ endpoint exists in backend/app/routers/projects.py

## Investigation Steps

1. Read the frontend project list page component (likely in frontend/src/pages/projects/ or similar)
2. Check the API call: what URL does it use? Does it include auth headers?
3. Read backend/app/routers/projects.py — check authentication requirements
4. Check if there's a proxy config issue (Vite dev server proxy, or nginx config)
5. Check CORS settings in backend/app/main.py
6. Check if the frontend is using the correct API prefix (/api/v1/ or /api/)

## Common Issues
- Missing auth token in frontend requests
- Wrong API URL prefix
- CORS blocking the response
- Frontend using stale data or caching
- TypeScript type mismatch causing silent failure

## Fix
Based on investigation results, fix the specific issue found. Could be:
- Adding auth headers to the frontend API client
- Fixing proxy configuration
- Fixing CORS settings
- Correcting API path

Commit: git add -A && git commit -m "fix(P1): 前端项目列表修复"
Do NOT push.
```

---

## Prompt 5: Bug #5 — Agent 节点模型配置（P1，需设计）

```
Read docs/nexus-bug-fix-list.md first, specifically Bug #5.

You are fixing the agent node model configuration: when model is set to "zai-coding-plan:glm-5", the node fails because it doesn't know how to route this model ID.

## Problem

The agent node (backend/app/services/workflow_engine/nodes/agent.py) reads the model config and passes it downstream, but there's no unified LLM provider layer to route "provider:model" format to the correct API endpoint.

## Design Requirements

1. Support model IDs in format: "provider:model-name" (e.g., "zai-coding-plan:glm-5", "openai:gpt-4o")
2. Support direct model names without provider prefix (fallback to default provider)
3. Provider config should be read from environment variables or a config file
4. The provider config format:
   ```
   NEXUS_LLM_PROVIDERS={"zai-coding-plan":{"base_url":"https://...","api_key":"..."},"openai":{"base_url":"https://api.openai.com/v1","api_key":"sk-..."}}
   ```

## Fix Steps

### Step 1: Create LLM Provider layer

Create backend/app/services/llm_provider.py:
```python
class LLMProvider:
    """Unified LLM provider — routes provider:model to correct API endpoint."""
    
    def __init__(self):
        self.providers = {}  # Load from NEXUS_LLM_PROVIDERS env var
    
    def parse_model_id(self, model_id: str) -> tuple[str, str]:
        """Parse 'provider:model' → (provider_name, model_name)"""
        if ":" in model_id:
            provider, model = model_id.split(":", 1)
            return provider, model
        return self.default_provider, model_id
    
    async def chat_completion(self, model_id: str, messages: list, **kwargs) -> str:
        """Route to correct provider and call chat completion."""
        provider_name, model_name = self.parse_model_id(model_id)
        config = self.providers.get(provider_name)
        if not config:
            raise ValueError(f"Provider '{provider_name}' not configured")
        # Call OpenAI-compatible API using aiohttp
```

### Step 2: Integrate into agent.py

In the agent node's execute(), when calling LLM:
- Use LLMProvider instead of hardcoded API calls
- Pass model_id from node config through the provider

### Step 3: Integrate into spec_node.py (and other nodes that call LLM)

Same — use LLMProvider for all LLM calls.

### Step 4: Add default provider fallback

If no provider prefix, use the first configured provider or a default.

### Verify
```bash
cd backend && python3 -c "
from app.services.llm_provider import LLMProvider
p = LLMProvider()
print('Providers:', list(p.providers.keys()))
print('Parse zai-coding-plan:glm-5:', p.parse_model_id('zai-coding-plan:glm-5'))
print('Parse gpt-4o:', p.parse_model_id('gpt-4o'))
"
```

Commit: git add -A && git commit -m "feat(P1): 统一 LLM Provider 层，支持 provider:model 格式路由"
Do NOT push.
```

---

## 执行顺序建议

1. **先执行 Prompt 1**（变量解析）— 最核心，修复后整个工作流数据流才能跑通
2. **再执行 Prompt 2**（db.commit）— 防止数据丢失
3. **然后 Prompt 3**（序列化）— 让 API 能正常返回数据
4. **Prompt 4**（前端排查）— 修完 API 后再排查前端
5. **Prompt 5**（LLM Provider）— 模型路由，相对独立

每个 prompt 修完后可以先 commit，不要 push。全部修完后再统一 push。

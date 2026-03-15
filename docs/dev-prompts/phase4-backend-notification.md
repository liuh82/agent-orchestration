# Phase 4 - 后端：通知系统（6通道 + 触发引擎）

## 任务目标

实现 6 个通知通道适配器、触发规则引擎、配置验证和测试发送。

## 修改/新建文件清单

```
backend/app/services/notification/__init__.py
backend/app/services/notification/base.py           # 适配器基类
backend/app/services/notification/feishu.py          # 飞书
backend/app/services/notification/dingtalk.py        # 钉钉
backend/app/services/notification/wecom.py           # 企业微信
backend/app/services/notification/slack.py           # Slack
backend/app/services/notification/discord.py         # Discord
backend/app/services/notification/email.py           # 邮件
backend/app/services/notification/registry.py        # 适配器注册
backend/app/services/notification/trigger.py         # 触发规则引擎
backend/app/services/notification/template.py        # 消息模板
backend/app/routers/notifications.py                # 扩展
backend/requirements.txt                             # aiosmtplib
```

## 适配器基类

```python
# backend/app/services/notification/base.py

class NotificationMessage(BaseModel):
    title: str = ""
    body: str
    level: str = "info"  # info/warning/error/success

class BaseAdapter(ABC):
    channel_type: str

    @abstractmethod
    async def send(self, config: dict, message: NotificationMessage) -> bool: ...

    @abstractmethod
    async def validate_config(self, config: dict) -> tuple[bool, str]: ...

    @abstractmethod
    def get_config_schema(self) -> dict:
        """返回 JSON Schema，前端根据此渲染配置表单"""
```

## 各通道实现要点

### 飞书
- 签名算法：timestamp + "\n" + secret → HMAC-SHA256 → base64
- Header: `X-Lark-Signature`, `X-Lark-Timestamp`
- 消息体：`{ "msg_type": "interactive", "content": "{\"text\":\"...\"}" }`

### 钉钉
- 加签算法：timestamp + "\n" + secret → HMAC-SHA256 → sign 参数
- URL: `https://oapi.dingtalk.com/robot/send?access_token={token}&timestamp={ts}&sign={sign}`
- 消息体：`{ "msgtype": "text", "text": { "content": "..." } }`

### 企业微信
- URL: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}`
- 消息体：`{ "msgtype": "text", "text": { "content": "..." } }`
- **类型名统一：** channel_type = `"wecom"`

### Slack
- 直接 POST 到 webhook_url
- 消息体：`{ "text": "..." }`

### Discord
- 直接 POST 到 webhook_url
- 消息体：`{ "content": "...", "username": "Nexus" }`

### 邮件
- 依赖：`aiosmtplib`
- 配置字段：smtp_host, smtp_port, username, password, use_tls, from_email
- HTML 模板邮件

## 适配器注册

```python
# registry.py
ADAPTERS = {
    "feishu": FeishuAdapter,
    "dingtalk": DingtalkAdapter,
    "wecom": WeComAdapter,
    "slack": SlackAdapter,
    "discord": DiscordAdapter,
    "email": EmailAdapter,
}

def get_adapter(channel_type: str) -> BaseAdapter:
    return ADAPTERS[channel_type]()

def get_all_config_schemas() -> dict:
    """返回所有通道的配置 Schema，前端用此动态渲染表单"""
    return { k: v().get_config_schema() for k, v in ADAPTERS.items() }
```

## 触发规则引擎

```python
TRIGGER_EVENTS = [
    "task.completed",
    "task.failed",
    "task.timeout",
    "task.running",
    "human_intervention.pending",
    "human_intervention.resolved",
]

async def emit_trigger(event: str, context: dict):
    """在业务代码中调用，触发通知"""
    # 1. 查询所有 is_active=True 且 triggers 包含 event 的 channel
    # 2. 渲染消息模板
    # 3. 调用对应适配器发送
    # 4. 记录发送结果（成功/失败）
```

## API 扩展

```
GET  /api/v1/notifications/channel-schemas
  返回所有通道的配置 Schema（新增，前端动态渲染表单用）

POST /api/v1/notifications/channels
  Body: { "channel_type": "feishu", "name": "...", "config": { ... }, "triggers": [...], "is_active": true }
  逻辑：先 validate_config 验证，通过后保存

POST /api/v1/notifications/channels/{id}/test
  Body: { "message": "测试消息" }
  逻辑：用该 channel 的配置发送测试消息
```

## 触发集成点

在以下 Service 层调用 `emit_trigger()`：
- `TaskService.complete_task()` → `task.completed`
- `TaskService.fail_task()` → `task.failed`
- `TaskService.timeout_task()` → `task.timeout`
- `HumanInterventionService.create()` → `human_intervention.pending`
- `HumanInterventionService.decide()` → `human_intervention.resolved`

## 约束

- Python 兼容 3.9
- HTTP 请求使用 `httpx.AsyncClient`（项目已有或需添加）
- 发送失败不影响主业务流程（try/except 包裹）
- 配置 schema 每个通道不同，使用 JSON Schema 标准格式

## 验收标准

- [ ] 6 个通道配置 schema 正确返回
- [ ] 6 个通道都能发送测试消息成功
- [ ] 配置验证能识别无效的 webhook_url
- [ ] 触发规则引擎在任务完成/失败时发送通知
- [ ] 人工干预创建/处理时发送通知
- [ ] 通知类型名统一为 wecom（前端后端一致）

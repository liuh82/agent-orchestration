# Nexus 开发任务 T5：通知通道差异化配置修复

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md（通知系统部分）
- frontend/src/components/notification/ChannelForm.tsx
- frontend/src/pages/admin/AdminNotificationPage.tsx
- backend/app/routers/notifications.py
- backend/app/services/notification/ 目录

## 任务目标
通知配置页面的每个通道显示其专属的配置表单。

## 具体要求

### 5.1 排查现有代码
- ChannelForm.tsx 是否正确根据 channel_type 渲染不同表单？
- channel-schemas API 是否返回了各通道的正确 schema？
- AdminNotificationPage 是否正确调用了 ChannelForm？

### 5.2 各通道配置字段

**飞书（feishu）:**
- App ID (text, required)
- App Secret (password, required)
- 群聊 Webhook URL (text, optional)
- 消息类型 (select: text/card)

**企业微信（wecom）:**
- Corp ID (text, required)
- Agent ID (text, required)
- Secret (password, required)
- 群机器人 Webhook (text, optional)

**钉钉（dingtalk）:**
- App Key (text, required)
- App Secret (password, required)
- 群机器人 Webhook (text, optional)
- 消息类型 (select: text/markdown/actionCard)

**邮件（email）:**
- SMTP 服务器 (text, required)
- SMTP 端口 (number, required, default 465)
- 发件人邮箱 (email, required)
- 密码/授权码 (password, required)
- SSL/TLS (switch, default on)
- 收件人 (tag input)

**Webhook（通用）:**
- URL (url, required)
- Secret (password, optional)
- Method (select: POST/GET)

**站内通知（in_app）:**
- 无额外配置

### 5.3 修复方案
确保：
- 后端 GET /api/v1/notifications/channel-schemas 返回每种通道的完整字段定义
- 前端 ChannelForm 根据 channel_type 动态渲染对应字段
- 配置保存和读取正常

## 完成标准
- [ ] 每种通知通道显示正确的配置字段
- [ ] 保存配置后重新打开能看到之前的配置
- [ ] 测试发送按钮能正常工作（至少webhook通道）
- [ ] 浏览器 console 无 error

## 不要做的事
- 不要新增通知通道类型
- 不要 git commit

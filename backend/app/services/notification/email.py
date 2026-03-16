"""Email notification adapter using aiosmtplib."""
from email.mime.text import MIMEText
from typing import Tuple

from .base import BaseAdapter, NotificationMessage


class EmailAdapter(BaseAdapter):
    channel_type = "email"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        try:
            import aiosmtplib
        except ImportError:
            return False

        smtp_host = config.get("smtp_host", "smtp.gmail.com")
        smtp_port = int(config.get("smtp_port", 465))
        from_email = config.get("from_email")
        password = config.get("password")
        ssl_tls = config.get("ssl_tls", True)
        recipients = config.get("recipients")

        if not all([smtp_host, from_email, password, recipients]):
            return False

        if isinstance(recipients, str):
            to_emails = [r.strip() for r in recipients.split(",") if r.strip()]
        elif isinstance(recipients, list):
            to_emails = recipients
        else:
            return False

        html_body = f"""
        <h3>{message.title}</h3>
        <p><b>Level:</b> {message.level}</p>
        <pre>{message.body}</pre>
        <hr>
        <p><small>Sent by Nexus AI Agent Orchestrator</small></p>
        """
        msg = MIMEText(html_body, "html", "utf-8")
        msg["Subject"] = f"[Nexus] {message.title}"
        msg["From"] = from_email
        msg["To"] = ", ".join(to_emails)

        try:
            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                username=from_email,
                password=password,
                use_tls=ssl_tls,
            )
            return True
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("smtp_host"):
            return False, "smtp_host is required"
        if not config.get("from_email"):
            return False, "from_email is required"
        if not config.get("password"):
            return False, "password is required"
        recipients = config.get("recipients")
        if not recipients or (isinstance(recipients, list) and len(recipients) == 0):
            return False, "recipients is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "smtp_host": {
                    "type": "string",
                    "title": "SMTP 服务器",
                    "description": "SMTP 服务器地址",
                },
                "smtp_port": {
                    "type": "integer",
                    "title": "SMTP 端口",
                    "default": 465,
                },
                "from_email": {
                    "type": "string",
                    "title": "发件人邮箱",
                    "description": "发件人邮箱地址",
                },
                "password": {
                    "type": "string",
                    "title": "密码/授权码",
                    "description": "SMTP 授权码",
                },
                "ssl_tls": {
                    "type": "boolean",
                    "title": "SSL/TLS",
                    "default": True,
                },
                "recipients": {
                    "type": "array",
                    "title": "收件人",
                    "description": "收件人邮箱列表",
                    "items": {"type": "string"},
                },
            },
            "required": ["smtp_host", "from_email", "password", "recipients"],
        }

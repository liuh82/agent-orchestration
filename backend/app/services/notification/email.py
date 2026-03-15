"""Email notification adapter using aiosmtplib."""
from email.mime.text import MIMEText
from typing import Optional, Tuple

from .base import BaseAdapter, NotificationMessage


class EmailAdapter(BaseAdapter):
    channel_type = "email"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        try:
            import aiosmtplib
        except ImportError:
            return False

        smtp_host = config.get("smtp_host", "smtp.gmail.com")
        smtp_port = int(config.get("smtp_port", 587))
        username = config.get("username")
        password = config.get("password")
        use_tls = config.get("use_tls", True)
        from_email = config.get("from_email", username)
        to_email = config.get("to_email")

        if not all([username, password, to_email]):
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
        msg["To"] = to_email

        try:
            await aiosmtplib.send_message(
                hostname=smtp_host,
                port=smtp_port,
                username=username,
                password=password,
                start_tls=use_tls,
                message=msg,
            )
            return True
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("smtp_host"):
            return False, "smtp_host is required"
        if not config.get("username"):
            return False, "username is required"
        if not config.get("password"):
            return False, "password is required"
        if not config.get("to_email"):
            return False, "to_email is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "smtp_host": {
                    "type": "string",
                    "title": "SMTP Host",
                    "default": "smtp.gmail.com",
                },
                "smtp_port": {
                    "type": "integer",
                    "title": "SMTP Port",
                    "default": 587,
                },
                "username": {"type": "string", "title": "SMTP Username"},
                "password": {"type": "string", "title": "SMTP Password"},
                "from_email": {
                    "type": "string",
                    "title": "From Email",
                    "description": "默认与 username 相同",
                },
                "to_email": {"type": "string", "title": "To Email"},
                "use_tls": {
                    "type": "boolean",
                    "title": "Use TLS",
                    "default": True,
                },
            },
            "required": ["smtp_host", "username", "password", "to_email"],
        }

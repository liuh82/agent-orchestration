"""Seed service — creates admin user and preset AgentTypes on first run."""
import json
import logging

from sqlalchemy.orm import Session

from app.config import settings
from app.models.agent_type import AgentType
from app.models.user import User
from app.services.auth import hash_password

logger = logging.getLogger(__name__)

PRESET_AGENT_TYPES = [
    {
        "id": "type-cc",
        "name": "cc",
        "display_name": "Claude Code",
        "protocol": "local_process",
        "capabilities": '["coding", "refactoring", "debugging"]',
        "default_models": '["opus", "sonnet"]',
    },
    {
        "id": "6e2dcf6e-948e-4474-a493-34e35cd36f6b",
        "name": "codex",
        "display_name": "Codex",
        "protocol": "local_process",
        "capabilities": '["coding", "testing"]',
        "default_models": '["gpt-4", "gpt-3.5-turbo"]',
    },
    {
        "id": "546aa350-15eb-43d2-851b-3cb4b3af7981",
        "name": "opencode",
        "display_name": "OpenCode",
        "protocol": "local_process",
        "capabilities": '["coding"]',
        "default_models": '["deepseek-coder", "qwen-coder"]',
    },
    {
        "id": "517546fc-262c-4a38-a320-1016cbea1cb0",
        "name": "openclaw",
        "display_name": "OpenClaw",
        "protocol": "websocket",
        "capabilities": '["orchestration", "scheduling"]',
        "default_models": '["minimax-M2.5"]',
    },
]


def seed_admin(db: Session) -> None:
    """Create admin user if not exists."""
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        admin = User(
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            name="Admin",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Admin user created: %s", settings.ADMIN_EMAIL)
    else:
        logger.info("Admin user already exists")


def seed_agent_types(db: Session) -> None:
    """Insert preset AgentTypes if not exists."""
    for t in PRESET_AGENT_TYPES:
        exists = db.query(AgentType).filter(AgentType.name == t["name"]).first()
        if not exists:
            db.add(AgentType(**t, is_system=True))
    db.commit()
    logger.info("Preset agent types seeded (count=%d)", len(PRESET_AGENT_TYPES))


def run_seed(db: Session) -> None:
    """Run all seed operations."""
    seed_admin(db)
    seed_agent_types(db)

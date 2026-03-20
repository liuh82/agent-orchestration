"""Alembic environment configuration."""
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Import application config and models
from app.config import settings
from app.database import Base

# New v1 models — these are managed by Alembic
from app.models.user import User  # noqa: F401
from app.models.agent_type import AgentType  # noqa: F401
from app.models.agent_instance import AgentInstance  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.task import NexusTask  # noqa: F401
from app.models.job import Job  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.notification import NotificationChannel  # noqa: F401

# Gateway models — also managed by Alembic
from app.models.gateway import BridgeRecord, TaskRecord  # noqa: F401

# v3 pre-created tables
from app.models.project_document import ProjectDocument  # noqa: F401
from app.models.agent_config_file import AgentConfigFile  # noqa: F401
from app.models.task_file import TaskFile  # noqa: F401
from app.models.human_intervention import HumanIntervention  # noqa: F401
from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution  # noqa: F401
from app.models.dashboard_layout import DashboardLayout  # noqa: F401
from app.models.user_session_token import UserSessionToken  # noqa: F401
from app.models.task_agent_config import TaskAgentConfig  # noqa: F401
from app.models.spec_artifact import SpecArtifact  # noqa: F401

# Note: legacy models in orm_models.py are NOT imported here;
# they use Base.metadata.create_all() in main.py lifespan instead.

# Alembic Config object
config = context.config

# Override sqlalchemy.url from app settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite compatibility
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

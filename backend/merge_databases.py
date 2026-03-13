#!/usr/bin/env python3
"""
Database Migration Script
合并所有数据库到 tasks.db

执行前请确保：
1. 备份所有数据库文件
2. 所有服务都已停止运行
"""

import sqlite3
import os
import shutil
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def backup_database(db_path):
    """备份数据库文件"""
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(db_path, backup_path)
        print(f"✓ 备份 {db_path} 到 {backup_path}")
        return backup_path
    return None

def merge_databases():
    """合并所有数据库到 tasks.db"""
    print("="*50)
    print("开始合并数据库...")
    print("="*50)

    # 检查数据库文件是否存在
    db_files = {
        'tasks': 'tasks.db',
        'costs': 'costs.db',
        'workflows': 'workflows.db',
        'agents': 'agents.db'
    }

    for name, path in db_files.items():
        if not os.path.exists(path):
            print(f"⚠ 警告: {path} 不存在")
            db_files[name] = None

    # 备份所有数据库
    print("\n1. 备份数据库...")
    backups = {}
    for name, path in db_files.items():
        if path:
            backups[name] = backup_database(path)

    # 使用 wal 模式连接主数据库
    main_conn = sqlite3.connect('tasks.db', isolation_level=None)  # Auto-commit mode
    main_conn.execute("PRAGMA journal_mode=WAL")
    main_cursor = main_conn.cursor()

    try:
        # 2. 合并 costs.db
        if db_files['costs']:
            print("\n2. 合并 costs.db...")
            main_cursor.execute("ATTACH DATABASE 'costs.db' AS costs_db")

            # 创建 cost_entries 表（如果不存在）
            main_cursor.execute("""
                CREATE TABLE IF NOT EXISTS cost_entries (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    task_id TEXT,
                    model TEXT NOT NULL,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    total_cost REAL DEFAULT 0,
                    currency TEXT DEFAULT 'USD',
                    timestamp TEXT,
                    metadata TEXT
                )
            """)

            # 迁移 cost_entries 数据
            main_cursor.execute("""
                INSERT INTO cost_entries
                SELECT * FROM costs_db.cost_entries
                WHERE id NOT IN (SELECT id FROM cost_entries)
            """)
            print(f"  ✓ 迁移了 {main_cursor.rowcount} 条 cost_entries 记录")

            # 跳过 budget_configs 和 cost_alerts（已有 tasks.db 中的表）
            main_cursor.execute("DETACH DATABASE costs_db")

        # 3. 合并 workflows.db
        if db_files['workflows']:
            print("\n3. 合并 workflows.db...")
            main_cursor.execute("ATTACH DATABASE 'workflows.db' AS workflows_db")

            # 创建 workflows 表（如果不存在）
            main_cursor.execute("""
                CREATE TABLE IF NOT EXISTS workflows (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    engine TEXT NOT NULL,
                    definition TEXT,
                    config TEXT,
                    created_by TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)

            # 迁移 workflows 数据
            main_cursor.execute("""
                INSERT INTO workflows
                SELECT * FROM workflows_db.workflows
                WHERE id NOT IN (SELECT id FROM workflows)
            """)
            print(f"  ✓ 迁移了 {main_cursor.rowcount} 条 workflows 记录")

            # 创建 workflow_templates 表（如果不存在）
            main_cursor.execute("""
                CREATE TABLE IF NOT EXISTS workflow_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    engine TEXT NOT NULL,
                    category TEXT,
                    definition TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)

            # 迁移 workflow_templates 数据
            main_cursor.execute("""
                INSERT INTO workflow_templates
                SELECT * FROM workflows_db.workflow_templates
                WHERE id NOT IN (SELECT id FROM workflow_templates)
            """)
            print(f"  ✓ 迁移了 {main_cursor.rowcount} 条 workflow_templates 记录")

            main_cursor.execute("DETACH DATABASE workflows_db")

        # 4. 合并 agents.db
        if db_files['agents']:
            print("\n4. 合并 agents.db...")
            main_cursor.execute("ATTACH DATABASE 'agents.db' AS agents_db")

            # 插入 agents 数据（只迁移不存在的）
            main_cursor.execute("""
                INSERT INTO agents (
                    id, name, type, status, model, timeout, skills, capabilities,
                    created_at, updated_at, last_seen,
                    task_count, completed_tasks, failed_tasks, total_tokens_used,
                    total_cost, avg_response_time, avg_task_duration
                )
                SELECT
                    id, name, type, status, model, timeout, skills, capabilities,
                    created_at, updated_at, last_seen,
                    0, 0, 0, 0,  -- 统计字段默认为 0
                    0.0, 0.0, 0.0
                FROM agents_db.agents
                WHERE id NOT IN (SELECT id FROM agents)
            """)
            print(f"  ✓ 迁移了 {main_cursor.rowcount} 条 agents 记录")

            main_cursor.execute("DETACH DATABASE agents_db")

        # 提交事务（所有操作完成后统一提交）
        main_conn.commit()
        print("\n✓ 数据库合并完成！")

        # 5. 验证数据
        print("\n5. 验证数据完整性...")

        # 检查所有表是否存在
        tables = main_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        print(f"  ✓ 数据库中共有 {len(tables)} 个表")

        # 检查关键表的数据量
        key_tables = ['agents', 'tasks', 'workflows', 'cost_entries', 'budgets', 'members']
        for table in key_tables:
            count = main_cursor.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  - {table}: {count} 条记录")

        print("\n" + "="*50)
        print("迁移完成！")
        print("="*50)
        print("\n下一步操作：")
        print("1. 启动开发服务器测试功能")
        print("2. 运行 pytest tests/ -v 验证所有测试")
        print("3. 确认无误后，删除旧数据库文件")

    except Exception as e:
        main_conn.rollback()
        logger.error(f"迁移失败: {e}", exc_info=True)
        print(f"\n❌ 迁移失败: {e}")
        raise
    finally:
        main_conn.close()

if __name__ == "__main__":
    merge_databases()
#!/usr/bin/env python3
"""
测试配置文件
"""

import pytest
import os
import sqlite3
from sqlalchemy.orm import Session
from app.database import SessionLocal


@pytest.fixture(scope='session', autouse=True)
def clean_tables_on_start():
    """在第一个测试前清空数据库表"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'tasks.db')

    # 如果数据库存在，清空所有表
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 获取所有表名
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        # 删除每个表的内容（而不是删除表本身）
        for (table_name,) in tables:
            if table_name == 'sqlite_sequence':
                continue
            cursor.execute(f"DELETE FROM {table_name}")

        conn.commit()
        conn.close()

    yield

    # 所有测试结束后可以选择清理
    pass


@pytest.fixture(scope='function')
def db():
    """为每个测试提供数据库会话"""
    db_session = SessionLocal()
    try:
        yield db_session
        db_session.rollback()
    finally:
        db_session.close()

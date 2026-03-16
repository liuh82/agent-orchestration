# Nexus 开发任务 T2：数据库清空重建

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v4.md（T1 产出，如不存在则读 architecture-v3.md）
- backend/app/database.py
- backend/app/models/ 目录下所有模型文件
- backend/alembic/ 目录

## 任务目标
1. 清空现有数据库（保留管理员账号）
2. 根据 architecture-v4.md 的数据模型创建新的 Alembic 迁移
3. 确保所有模型表正确创建

## 具体步骤

### Step 1: 备份现有数据
```bash
cp backend/data/nexus.db backend/data/nexus.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Step 2: 删除旧迁移和数据库
- 删除 alembic/versions/ 下所有迁移文件
- 删除 backend/data/nexus.db
- 保留 alembic.ini 和 alembic/env.py

### Step 3: 更新模型文件
根据 architecture-v4.md：
- tasks 表增加 schedule_type, schedule_config, workflow_snapshot 字段
- 新建 task_agent_configs.py 模型
- 新建/修改 task_documents 相关模型
- workflows 表增加 sub_workflow_enabled
- workflow_nodes 表增加 config_override_schema
- 确保 models/__init__.py 导入所有模型

### Step 4: 生成新迁移
```bash
cd backend
alembic revision --autogenerate -m "v4 schema rebuild"
```

### Step 5: 执行迁移
```bash
alembic upgrade head
```

### Step 6: 创建种子数据
- 创建管理员账号 admin（密码保持当前值，查看现有密码hash）
- 创建基础 Agent 类型（如有 seed 脚本则更新）

## 完成标准
- [ ] 数据库清空并重建
- [ ] 管理员账号可正常登录（测试: curl /api/v1/auth/login）
- [ ] 所有新表正确创建
- [ ] alembic 迁移文件干净

## 不要做的事
- 不要修改前端代码
- 不要修改 API 路由代码（只改模型和迁移）
- 不要 git commit

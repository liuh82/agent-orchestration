# Nexus 开发任务 T4：Dashboard 默认展示修复

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md（重点看 Dashboard 部分）
- frontend/src/pages/dashboard/DashboardPage.tsx
- frontend/src/components/dashboard/ 目录
- backend/app/routers/stats.py 或相关统计 API

## 任务目标
Dashboard 一进来就有默认内容展示，不需要先配置。

## 具体要求

### 4.1 默认布局
用户首次访问 Dashboard 时，显示默认布局：
- 统计卡片：我的任务数、进行中任务、已完成任务、总Agent数
- 最近任务列表：最近5个任务，显示名称、状态、时间
- Agent状态概览：在线/离线Agent数量
- 最近活动：最近的系统事件

### 4.2 配置入口移到后台
- 前台 Dashboard 不再显示配置按钮/面板
- 后台管理中增加 Dashboard 布局配置页面（或在系统设置中）
- 配置保存到 backend，每个用户独立布局

### 4.3 实现方式
- 使用已有的 react-grid-layout 组件
- 默认卡片组件直接渲染（不依赖配置）
- 如果用户有自定义配置则用自定义的，否则用默认布局

## 完成标准
- [ ] Dashboard 首次访问显示默认内容
- [ ] 前台无配置入口
- [ ] 浏览器 console 无 error

## 不要做的事
- 不要修改后端API（使用现有接口）
- 不要引入新依赖
- 不要 git commit

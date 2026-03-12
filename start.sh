#!/bin/bash

# 启动 AI Agent 编排可视化工具

echo "🚀 启动 AI Agent 编排可视化工具..."

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    exit 1
fi

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "backend/venv" ]; then
    echo "📦 创建 Python 虚拟环境..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# 激活虚拟环境
echo "🔧 激活 Python 虚拟环境..."
source backend/venv/bin/activate

# 安装 Python 依赖
echo "📥 安装 Python 依赖..."
cd backend
pip install -r requirements.txt
cd ..

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
npm install
cd ..

# 启动后端服务
echo "🖥️  启动后端服务..."
cd backend
uvicorn app.main:app --reload --port 8080 &
BACKEND_PID=$!
cd ..

# 等待后端服务启动
sleep 5

# 启动前端服务
echo "🌐 启动前端服务..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 服务已启动！"
echo "📱 前端地址: http://localhost:3000"
echo "🔗 后端API: http://localhost:8080"
echo "📖 API文档: http://localhost:8080/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait
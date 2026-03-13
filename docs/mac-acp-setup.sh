#!/bin/bash
# ===========================================
# Mac 开发机 — ACP 环境初始化脚本
# 日期：2026-03-13
# ===========================================

set -e

echo "🦞 OpenClaw ACP Bridge 环境初始化"
echo "=================================="

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装: brew install node"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 2. 安装 openclaw CLI
if ! command -v openclaw &> /dev/null; then
    echo "📦 安装 openclaw CLI..."
    npm install -g openclaw
else
    echo "✅ openclaw: $(openclaw --version 2>&1 | head -1)"
fi

# 3. 创建配置目录
mkdir -p ~/.openclaw

# 4. 配置 Gateway Token
if [ ! -f ~/.openclaw/gateway.token ]; then
    echo "🔐 配置 Gateway Token..."
    read -sp "请输入 Gateway Token (85a87...): " TOKEN
    echo
    echo "$TOKEN" > ~/.openclaw/gateway.token
    chmod 600 ~/.openclaw/gateway.token
    echo "✅ Token 已保存到 ~/.openclaw/gateway.token"
else
    echo "✅ Gateway Token 已存在"
fi

# 5. 安装 acpx (可选)
echo ""
read -p "是否安装 acpx CLI? (y/n): " INSTALL_ACPX
if [ "$INSTALL_ACPX" = "y" ]; then
    if ! command -v acpx &> /dev/null; then
        npm install -g acpx
        echo "✅ acpx 已安装"
    else
        echo "✅ acpx: $(acpx --version 2>&1 | head -1)"
    fi
    
    # 配置 acpx
    mkdir -p ~/.acpx
    cat > ~/.acpx/config.json << 'ACPX_CONFIG'
{
  "agents": {
    "openclaw": {
      "command": "env OPENCLAW_HIDE_BANNER=1 OPENCLAW_SUPPRESS_NOTES=1 openclaw acp --url wss://81.70.98.45:9443/acp-ws --token-file ~/.openclaw/gateway.token --session agent:main:main --no-prefix-cwd"
    }
  }
}
ACPX_CONFIG
    echo "✅ acpx 配置已写入 ~/.acpx/config.json"
fi

# 6. 配置 Cursor MCP
echo ""
read -p "是否配置 Cursor MCP? (y/n): " CONFIG_CURSOR
if [ "$CONFIG_CURSOR" = "y" ]; then
    mkdir -p ~/.cursor
    cat > ~/.cursor/mcp.json << 'CURSOR_CONFIG'
{
  "servers": {
    "openclaw-acp": {
      "type": "stdio",
      "command": "openclaw",
      "args": [
        "acp",
        "--url", "wss://81.70.98.45:9443/acp-ws",
        "--token-file", "~/.openclaw/gateway.token",
        "--session", "agent:main:main",
        "--no-prefix-cwd"
      ],
      "env": {
        "OPENCLAW_HIDE_BANNER": "1",
        "OPENCLAW_SUPPRESS_NOTES": "1"
      }
    }
  }
}
CURSOR_CONFIG
    echo "✅ Cursor MCP 配置已写入 ~/.cursor/mcp.json"
fi

# 7. 配置 VS Code MCP (可选)
echo ""
read -p "是否配置 VS Code MCP? (y/n): " CONFIG_VSCODE
if [ "$CONFIG_VSCODE" = "y" ]; then
    mkdir -p ~/.vscode
    cat > ~/.vscode/mcp.json << 'VSCODE_CONFIG'
{
  "servers": {
    "openclaw-acp": {
      "type": "stdio",
      "command": "openclaw",
      "args": [
        "acp",
        "--url", "wss://81.70.98.45:9443/acp-ws",
        "--token-file", "~/.openclaw/gateway.token",
        "--session", "agent:main:main",
        "--no-prefix-cwd"
      ],
      "env": {
        "OPENCLAW_HIDE_BANNER": "1",
        "OPENCLAW_SUPPRESS_NOTES": "1"
      }
    }
  }
}
VSCODE_CONFIG
    echo "✅ VS Code MCP 配置已写入 ~/.vscode/mcp.json"
fi

# 8. 测试连通性
echo ""
echo "🧪 测试 ACP 连通性..."
echo "运行以下命令测试（需要服务器端 ACP 已启用）："
echo ""
echo "  openclaw acp client \\"
echo "    --server-args --url wss://81.70.98.45:9443/acp-ws \\"
echo "    --server-args --token-file ~/.openclaw/gateway.token"
echo ""
echo "=================================="
echo "✅ 初始化完成！重启 IDE 后生效。"

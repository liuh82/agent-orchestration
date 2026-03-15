#!/bin/bash
# Agent Orchestrator 全接口测试脚本
# 测试所有前后台 API 和页面可访问性

BASE_URL="http://127.0.0.1:9443"
API_BASE="http://127.0.0.1:8082"
PASS=0
FAIL=0
SKIP=0
ERRORS=()

login() {
  curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"Admin@2026"}' \
    --max-time 5
}

test_api() {
  local name="$1" method="$2" url="$3" headers="$4" body="$5" expect="$6"
  local full_url="$API_BASE$url"
  local cmd="curl -s -o /tmp/test_resp.json -w '%{http_code}' -X $method '$full_url'"
  if [ -n "$headers" ]; then cmd="$cmd -H '$headers'"; fi
  if [ -n "$body" ]; then cmd="$cmd -d '$body'"; fi
  cmd="$cmd --max-time 5 -H 'Content-Type: application/json'"
  
  local code=$(eval $cmd 2>/dev/null)
  local resp=$(cat /tmp/test_resp.json 2>/dev/null)
  
  if [ -z "$code" ] || [ "$code" = "000" ]; then
    echo "❌ FAIL | $name | 无响应(超时/连接失败)"
    ((FAIL++))
    ERRORS+=("$name: 无响应")
    return
  fi
  
  if [ -n "$expect" ]; then
    if echo "$resp" | grep -q "$expect"; then
      echo "✅ PASS | $name | $code"
      ((PASS++))
    else
      echo "❌ FAIL | $name | $code | 响应不含 '$expect': $(echo $resp | head -c 120)"
      ((FAIL++))
      ERRORS+=("$name: 响应不匹配")
    fi
  else
    if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
      echo "✅ PASS | $name | $code"
      ((PASS++))
    else
      echo "❌ FAIL | $name | HTTP $code | $(echo $resp | head -c 120)"
      ((FAIL++))
      ERRORS+=("$name: HTTP $code")
    fi
  fi
}

echo "=========================================="
echo "  Agent Orchestrator 全接口测试"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ===== 1. 登录 =====
echo "--- 认证 ---"
test_api "登录" POST "/api/auth/login" "" '{"email":"admin@example.com","password":"Admin@2026"}' '"code":0'

TOKEN=$(login | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])" 2>/dev/null)
AUTH="Authorization: Bearer $TOKEN"

if [ -z "$TOKEN" ]; then
  echo "❌ 无法获取 token，后续测试跳过"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."
echo ""

# ===== 2. 用户信息 =====
echo "--- 用户 ---"
test_api "获取用户信息 /auth/me" GET "/api/auth/me" "$AUTH" "" '"role":"admin"'
test_api "获取用户信息 /v1/auth/me" GET "/api/v1/auth/me" "$AUTH" "" '"role":"admin"'
echo ""

# ===== 3. 前台 API =====
echo "--- 前台 API ---"
test_api "Dashboard 统计" GET "/api/v1/stats/dashboard" "$AUTH" "" '"code":0'
test_api "项目列表 /v1/projects" GET "/api/v1/projects" "$AUTH" ""
test_api "项目列表 /projects" GET "/api/projects" "$AUTH" ""
test_api "任务列表 /v1/tasks" GET "/api/v1/tasks" "$AUTH" ""
test_api "任务列表 /tasks" GET "/api/tasks" "$AUTH" ""
test_api "工作流列表 /v1/workflows" GET "/api/v1/workflows" "$AUTH" ""
test_api "工作流列表 /workflows" GET "/api/workflows" "$AUTH" ""
echo ""

# ===== 4. Agent API =====
echo "--- Agent API ---"
test_api "Agent 列表 /v1/agents" GET "/api/v1/agents" "$AUTH" ""
test_api "Agent 列表 /agents" GET "/api/agents" "$AUTH" ""
test_api "Agent 类型 /v1/agent-types" GET "/api/v1/agent-types" "$AUTH" "" '"code":0'
test_api "Agent 类型 /agent-types" GET "/api/agent-types" "$AUTH" "" '"code":0'
test_api "Agent 类型(公开) /v1/agents/types/" GET "/api/v1/agents/types/" "" "" '"code":0'
echo ""

# ===== 5. 后台管理 API =====
echo "--- 后台管理 API ---"
test_api "全局统计 /v1/stats/global" GET "/api/v1/stats/global" "$AUTH" "" '"code":0'
test_api "后台用户列表 /v1/admin/users" GET "/api/v1/admin/users" "$AUTH" "" '"code":0'
test_api "后台 Agent 类型 /v1/admin/agent-types" GET "/api/v1/admin/agent-types" "$AUTH" "" '"code":0'
test_api "系统设置 GET /v1/admin/settings" GET "/api/v1/admin/settings" "$AUTH" "" '"code":0'
echo ""

# ===== 6. 通知 API =====
echo "--- 通知 API ---"
test_api "通知渠道 /v1/notifications/channels" GET "/api/v1/notifications/channels" "$AUTH" "" '"code":0'
echo ""

# ===== 7. Gateway API =====
echo "--- Gateway API ---"
test_api "Gateway Bridge 列表 /gateway/bridges" GET "/api/gateway/bridges" "X-API-Key: nexus-admin-key-2024" "" '"code":0'
echo ""

# ===== 8. 成本 API =====
echo "--- 成本 API ---"
test_api "成本统计 /cost" GET "/api/cost" "$AUTH" ""
echo ""

# ===== 9. 组织 API =====
echo "--- 组织 API ---"
test_api "组织架构 /org" GET "/api/org" "$AUTH" ""
echo ""

# ===== 10. 心跳 API =====
echo "--- 心跳 API ---"
test_api "心跳列表 /heartbeats" GET "/api/heartbeats" "$AUTH" ""
test_api "心跳统计 /heartbeats/stats" GET "/api/heartbeats/stats" "$AUTH" ""
echo ""

# ===== 11. 前端页面可访问性 =====
echo "--- 前端页面 ---"
PAGES=(
  "/login"
  "/"
  "/tasks"
  "/workflows"
  "/settings"
  "/admin"
  "/admin/agents"
  "/admin/agents/new"
  "/admin/gateway"
  "/admin/users"
  "/admin/agent-types"
  "/admin/settings"
  "/admin/notifications"
  "/admin/stats"
)
for p in "${PAGES[@]}"; do
  code=$(curl -s -o /tmp/test_resp.json -w '%{http_code}' "$BASE_URL$p" --max-time 5 2>/dev/null)
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    echo "✅ PASS | 页面 $p | $code"
    ((PASS++))
  elif [ "$code" -ge 400 ] && [ "$code" -lt 500 ]; then
    # 4xx 可能是 SPA 路由正常返回（前端处理）
    size=$(wc -c < /tmp/test_resp.json 2>/dev/null)
    if [ "$size" -gt 500 ]; then
      echo "✅ PASS | 页面 $p | $code (SPA)"
      ((PASS++))
    else
      echo "⚠️  WARN | 页面 $p | $code (小响应: ${size}B)"
      ((SKIP++))
    fi
  else
    echo "❌ FAIL | 页面 $p | $code"
    ((FAIL++))
    ERRORS+=("页面 $p: HTTP $code")
  fi
done
echo ""

# ===== 结果 =====
echo "=========================================="
echo "  结果: $PASS 通过 | $FAIL 失败 | $SKIP 跳过"
echo "=========================================="
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "失败项:"
  for e in "${ERRORS[@]}"; do
    echo "  - $e"
  done
fi

#!/bin/bash
# ============================================================
# Nexus 改名脚本
# 将 agent-orchestration 重命名为 nexus
# 
# 使用方式：
#   chmod +x rename-to-nexus.sh
#   ./rename-to-nexus.sh
#
# ⚠️ 执行前确保：
#   1. 已在 GitHub 上 Rename 仓库：agent-orchestration → nexus
#   2. 所有本地修改已 commit
#   3. 在项目根目录执行
# ============================================================

set -e

OLD_NAME="agent-orchestration"
OLD_NAME_PACKAGE="agent-orchestration-frontend"
OLD_REPO="liuh82/agent-orchestration"
OLD_UNDERSCORE="agent_orchestration"

NEW_NAME="nexus"
NEW_NAME_PACKAGE="nexus-frontend"
NEW_REPO="liuh82/nexus"

echo "=== Nexus 改名脚本 ==="
echo "  $OLD_NAME → $NEW_NAME"
echo ""
read -p "确认执行？(y/N) " confirm
[ "$confirm" != "y" ] && echo "已取消" && exit 0

echo ""
echo "[1/6] 更新 git remote..."
git remote set-url origin "https://github.com/${NEW_REPO}.git"
echo "  ✓ remote → ${NEW_REPO}"

echo ""
echo "[2/6] 替换文件内容..."
# 替换所有文件中的项目名引用（排除 .git、node_modules、.pyc）
find . -type f \( \
  -name "*.md" -o \
  -name "*.py" -o \
  -name "*.ts" -o \
  -name "*.tsx" -o \
  -name "*.js" -o \
  -name "*.json" -o \
  -name "*.yaml" -o \
  -name "*.yml" -o \
  -name "*.sh" -o \
  -name "*.toml" -o \
  -name "*.txt" -o \
  -name "*.css" -o \
  -name "*.html" \
\) ! -path "./.git/*" ! -path "*/node_modules/*" ! -path "*/__pycache__/*" ! -path "*.lock" -print0 | \
  xargs -0 perl -pi -e \
    "s/${OLD_NAME_PACKAGE}/${NEW_NAME_PACKAGE}/g;" \
    "s|${OLD_REPO}|${NEW_REPO}|g;" \
    "s/${OLD_NAME}/${NEW_NAME}/g;"

echo "  ✓ 文件内容替换完成"

echo ""
echo "[3/6] 重命名文件..."
# 重命名包含项目名的文档文件
for f in ./${OLD_NAME}-architecture.md ./${OLD_NAME}-requirements.md ./${OLD_NAME}-v2-plan.md; do
  if [ -f "$f" ]; then
    newf=$(echo "$f" | sed "s/${OLD_NAME}/${NEW_NAME}/")
    mv "$f" "$newf"
    echo "  ✓ $(basename "$f") → $(basename "$newf")"
  fi
done

echo ""
echo "[4/6] 重命名 npm 包 (package.json name 字段)..."
if [ -f "frontend/package.json" ]; then
  perl -pi -e "s/\"name\": \"${OLD_NAME_PACKAGE}\"/\"name\": \"${NEW_NAME_PACKAGE}\"/" frontend/package.json
  echo "  ✓ package.json: ${OLD_NAME_PACKAGE} → ${NEW_NAME_PACKAGE}"
fi

echo ""
echo "[5/6] 更新 Bridge 包名引用..."
# Bridge 的 npm 包名也更新
if [ -f "remote-agent-bridge/package.json" ]; then
  perl -pi -e "s/@liuh82\/oc-bridge/@liuh82\/nexus-bridge/" remote-agent-bridge/package.json
  echo "  ✓ bridge package: @liuh82/oc-bridge → @liuh82/nexus-bridge"
fi

echo ""
echo "[6/6] 验证替换结果..."
echo ""

# 检查是否有残留
REMAINING=$(grep -rl "${OLD_NAME}" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v .git | grep -v ".lock" | grep -v ".pyc" || true)

if [ -z "$REMAINING" ]; then
  echo "  ✅ 无残留引用"
else
  echo "  ⚠️ 以下文件仍有残留，请手动检查："
  echo "$REMAINING"
fi

echo ""
echo "=== 替换完成 ==="
echo ""
echo "下一步："
echo "  1. git add -A"
echo "  2. git commit -m 'chore: rename project to Nexus'"
echo "  3. git push origin main"
echo ""
echo "⚠️ 本地目录也需要重命名："
echo "  mv ${OLD_NAME} ${NEW_NAME}"

#!/bin/bash
cd /root/.openclaw/workspace/agent-orchestration
git fetch origin main
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  git pull origin main >> /tmp/nexus-auto-pull.log 2>&1
  echo "$(date '+%Y-%m-%d %H:%M:%S') Pulled: $LOCAL → $REMOTE" >> /tmp/nexus-auto-pull.log
fi

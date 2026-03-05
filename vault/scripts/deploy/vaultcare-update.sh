#!/bin/bash
# VPS daily update script - pull from GitHub and optionally rebuild/restart
# Usage: ./vaultcare-update.sh
# Crontab: 0 3 * * * /path/to/vaultcare-update.sh >> /tmp/vaultcare-update.log 2>&1

set -e

# 1. 改成你 VPS 上 clone 的仓库目录
REPO_DIR="${REPO_DIR:-/home/$(whoami)/vaultcare-os}"

cd "$REPO_DIR" || exit 1

echo "[$(date)] Starting vaultcare update..."

# 2. 拉取最新代码
git fetch origin main
git pull origin main

# 3. 可选：前端重新构建
# cd vault/frontend && npm run build && cd "$REPO_DIR"

# 4. 可选：后端重启（按你实际用的方式）
# systemctl restart vaultcare-backend
# 或: pm2 restart vaultcare
# 或: supervisorctl restart vaultcare

echo "[$(date)] Update completed."

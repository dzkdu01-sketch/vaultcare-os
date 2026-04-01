#!/usr/bin/env bash
# 在 VPS 上以 root 执行：拉代码、构建前后端、修正 DB 权限、重启 PM2。
#
#   bash /var/www/vault-os1.1/deploy/update-server.sh
#
# 环境变量：
#   VAULT_OS11_ROOT  项目根目录，默认 /var/www/vault-os1.1
#   GIT_BRANCH       分支，默认 main

set -euo pipefail

ROOT="${VAULT_OS11_ROOT:-/var/www/vault-os1.1}"
BRANCH="${GIT_BRANCH:-main}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请用 root 执行本脚本。"
  exit 1
fi

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "未找到项目目录: $ROOT"
  exit 1
fi

cd "$ROOT"
echo "==> git pull ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

cd "$ROOT/frontend"
if [[ ! -f .env ]]; then
  printf '%s\n' 'VITE_USE_MOCK=false' 'VITE_API_BASE_URL=/api/v1' > .env
fi
echo "==> 构建前端"
npm ci
npm run build

echo "==> 构建后端"
cd "$ROOT/backend"
npm ci
npm run build

DB_FILE="$ROOT/backend/data/vaultcare.db"
if [[ -f "$DB_FILE" ]]; then
  chmod 644 "$DB_FILE"
  echo "==> 已设置数据库权限: $DB_FILE"
else
  echo "警告: 未找到 $DB_FILE（若需数据请先在本机上传 vaultcare.db 再执行一键部署）"
fi

export VAULT_OS11_ROOT="$ROOT"
echo "==> 重启 PM2"
pm2 restart vault-os11-api
pm2 save

echo "==> 完成。建议验证: curl -s http://127.0.0.1:3002/api/health"

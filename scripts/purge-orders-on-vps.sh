#!/usr/bin/env bash
# 在 VPS 本机以 root 执行（浏览器里的网页终端也算）：清空所有订单并重启 API。
# 不要用 PowerShell 的 .ps1 在 Linux 上跑；本脚本才是给 bash 用的。
#
#   bash /var/www/vault-os1.1/scripts/purge-orders-on-vps.sh
#
# 环境变量（可选）：
#   VAULT_OS11_ROOT  默认 /var/www/vault-os1.1
#   PM2_NAME         默认 vault-os11-api

set -euo pipefail

ROOT="${VAULT_OS11_ROOT:-/var/www/vault-os1.1}"
PM2_NAME="${PM2_NAME:-vault-os11-api}"
BACKEND="$ROOT/backend"

if [[ ! -f "$BACKEND/scripts/purge-all-orders.mjs" ]]; then
  echo "未找到 $BACKEND/scripts/purge-all-orders.mjs，请先 git pull 部署最新代码。"
  exit 1
fi

cd "$BACKEND"
echo "==> pm2 stop $PM2_NAME"
pm2 stop "$PM2_NAME"

echo "==> 清空订单（node scripts/purge-all-orders.mjs）"
node scripts/purge-all-orders.mjs

if [[ -f "$BACKEND/data/vaultcare.db" ]]; then
  chmod 644 "$BACKEND/data/vaultcare.db"
  echo "==> 已 chmod 644 vaultcare.db"
fi

echo "==> pm2 restart $PM2_NAME"
pm2 restart "$PM2_NAME"
pm2 save

echo "==> 完成。"

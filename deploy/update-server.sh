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
NODE_ENV=development npm ci
npm run build

echo "==> 构建后端"
cd "$ROOT/backend"
NODE_ENV=development npm ci
npm run build

DB_FILE="$ROOT/backend/data/vaultcare.db"
if [[ -f "$DB_FILE" ]]; then
  chmod 644 "$DB_FILE"
  echo "==> 已设置数据库权限: $DB_FILE"
else
  echo "警告: 未找到 $DB_FILE（若需数据请先在本机上传 vaultcare.db 再执行一键部署）"
fi

export VAULT_OS11_ROOT="$ROOT"
cd "$ROOT"
echo "==> 启动/重启 PM2 (vault-os11-api)"
if pm2 describe vault-os11-api &>/dev/null; then
  pm2 restart vault-os11-api
else
  echo "   (进程尚不存在，首次执行 pm2 start)"
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> 完成。建议验证: curl -s http://127.0.0.1:3002/api/health"
echo ""
echo "提示: 若执行「pm2 startup」时出现「Init system not found」或类似信息，多表示"
echo "      当前环境无传统 init（如 systemd），PM2 无法自动写开机自启。重启 VPS 后若"
echo "      需恢复 API，可手动执行: cd $ROOT && pm2 resurrect"
echo "      或视主机/Spaceship 文档使用 crontab @reboot、面板进程守护等方案。"
echo ""

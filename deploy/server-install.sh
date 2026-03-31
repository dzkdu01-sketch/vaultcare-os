#!/usr/bin/env bash
# 在 VPS（Ubuntu）上、以 root 执行，一键部署 vault-os1.1 并停用旧版 Django。
#
# 前置：把本仓库完整上传到 /var/www/vault-os1.1（zip 解压或 git clone）
#
#   sudo bash /var/www/vault-os1.1/deploy/server-install.sh
#
# 若同时要删除旧版代码目录 /var/www/vaultcare（不可恢复）：
#   sudo REMOVE_OLD_VAULTCARE=1 bash /var/www/vault-os1.1/deploy/server-install.sh
#
# 自定义目录：
#   sudo VAULT_OS11_ROOT=/opt/vault-os1.1 bash /opt/vault-os1.1/deploy/server-install.sh

set -euo pipefail

ROOT="${VAULT_OS11_ROOT:-/var/www/vault-os1.1}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请用 root 执行: sudo bash $0"
  exit 1
fi

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]] || [[ ! -f "$ROOT/deploy/ecosystem.config.cjs" ]]; then
  echo "未找到完整项目: $ROOT"
  echo "请先上传 vault-os1.1 到 $ROOT 再运行本脚本。"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx curl ca-certificates gnupg

# Node.js 20
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || echo v0)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

command -v npm >/dev/null

echo "==> 停用旧版 vaultcare（Django/Gunicorn）"
systemctl stop vaultcare vaultcare-q 2>/dev/null || true
systemctl disable vaultcare vaultcare-q 2>/dev/null || true

if [[ "${REMOVE_OLD_VAULTCARE:-}" == "1" ]]; then
  echo "==> 删除旧版目录 /var/www/vaultcare"
  rm -rf /var/www/vaultcare
fi

echo "==> 构建前端"
cd "$ROOT/frontend"
if [[ ! -f .env ]]; then
  printf '%s\n' 'VITE_USE_MOCK=false' 'VITE_API_BASE_URL=/api/v1' > .env
fi
npm ci
npm run build

echo "==> 构建并启动后端（PM2）"
cd "$ROOT/backend"
npm ci
npm run build

npm install -g pm2
export VAULT_OS11_ROOT="$ROOT"
pm2 delete vault-os11-api 2>/dev/null || true
pm2 start "$ROOT/deploy/ecosystem.config.cjs"
pm2 save

echo "==> 配置 Nginx"
cp "$ROOT/deploy/nginx-ip.conf" /etc/nginx/sites-available/vault-os11
sed -i "s|ROOT_PLACEHOLDER|$ROOT|g" /etc/nginx/sites-available/vault-os11

rm -f /etc/nginx/sites-enabled/vaultcare /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/vault-os11 /etc/nginx/sites-enabled/vault-os11

nginx -t
systemctl reload nginx
systemctl enable nginx

IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "完成。请用浏览器打开: http://${IP}/"
echo "（默认进入 /products；若 PM2 未设开机自启，请执行: pm2 startup 并按提示再执行一条命令）"

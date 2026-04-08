#!/usr/bin/env bash
# 在 Ubuntu VPS 上以 root 执行：为 vault-os.site 启用 HTTPS（Let's Encrypt）并启用站点配置。
#
# 前置（必须全部满足）：
#   1. 已按 deploy/server-install.sh 部署过本仓库（Nginx + Node + PM2 正常）。
#   2. 域名 vault-os.site 的 DNS **A 记录** 已指向 **本机公网 IP**（不要用当前指向 LiteSpeed 虚拟主机的那条记录）。
#   3. 云防火墙 / 安全组放行 TCP **80、443**。
#   4. 若本机已有「仅 IP」的 default_server 站点，可先禁用：rm -f /etc/nginx/sites-enabled/default
#
# 用法：
#   export CERTBOT_EMAIL=你的邮箱@example.com   # Let's Encrypt 通知用
#   bash /var/www/vault-os1.1/deploy/setup-https-vault-os-site.sh
#
# 可选环境变量：
#   VAULT_OS11_ROOT  默认 /var/www/vault-os1.1

set -euo pipefail

ROOT="${VAULT_OS11_ROOT:-/var/www/vault-os1.1}"
DOMAIN="vault-os.site"
SITE="vault-os-site"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请用 root 执行。"
  exit 1
fi

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "请先设置环境变量 CERTBOT_EMAIL=你的邮箱（用于 Let's Encrypt）"
  exit 1
fi

if [[ ! -f "$ROOT/deploy/nginx-vault-os.site.conf" ]]; then
  echo "未找到 $ROOT/deploy/nginx-vault-os.site.conf"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx

cp "$ROOT/deploy/nginx-vault-os.site.conf" "/etc/nginx/sites-available/$SITE"
sed -i "s|ROOT_PLACEHOLDER|$ROOT|g" "/etc/nginx/sites-available/$SITE"

ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
nginx -t
systemctl reload nginx

# 仅主域名（若已为 www 配置 A 记录，可再加 -d "www.$DOMAIN"）
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$CERTBOT_EMAIL" \
  --redirect

echo ""
echo "完成。请用浏览器访问: https://${DOMAIN}/"
echo "若仍打不开，检查 DNS 是否已指向本机、80/443 是否放行。"

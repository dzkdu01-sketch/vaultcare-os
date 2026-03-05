#!/bin/bash
# 在 Hostinger 网页终端中执行此脚本
# 复制整段，粘贴到终端，回车运行

set -e
VPS_IP="72.61.140.40"

echo "=== 1. 克隆代码 ==="
cd /tmp
rm -rf vaultcare-os
git clone --depth 1 https://github.com/dzkdu01-sketch/vaultcare-os.git
cd vaultcare-os/vault

echo "=== 2. 安装系统依赖 ==="
apt-get update -qq
apt-get install -y nginx python3 python3-venv python3-pip

echo "=== 3. 安装 Node.js ==="
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "=== 4. 部署后端 ==="
APP_DIR="/var/www/vaultcare"
mkdir -p "$APP_DIR"
cp -r backend frontend deploy "$APP_DIR/"
cd "$APP_DIR/backend"

python3 -m venv venv
./venv/bin/pip install -q -r requirements.txt

if [ ! -f .env ]; then
  SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
  cat > .env << EOF
DEBUG=False
SECRET_KEY=$SECRET
ALLOWED_HOSTS=$VPS_IP,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://$VPS_IP,https://$VPS_IP
CSRF_TRUSTED_ORIGINS=http://$VPS_IP,https://$VPS_IP
EOF
fi

./venv/bin/python manage.py migrate --noinput
./venv/bin/python manage.py collectstatic --noinput

echo "=== 5. 构建前端 ==="
cd "$APP_DIR/frontend"
npm ci --silent
npm run build

echo "=== 6. 配置 Nginx ==="
sed "s/YOUR_DOMAIN/$VPS_IP/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/vaultcare
ln -sf /etc/nginx/sites-available/vaultcare /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "=== 7. 配置 systemd ==="
cp "$APP_DIR/deploy/vaultcare.service" /etc/systemd/system/
cp "$APP_DIR/deploy/vaultcare-q.service" /etc/systemd/system/
chown -R www-data:www-data "$APP_DIR"
systemctl daemon-reload
systemctl enable vaultcare vaultcare-q
systemctl restart vaultcare vaultcare-q
systemctl reload nginx

echo ""
echo "=== 部署完成 ==="
echo "访问: http://$VPS_IP"
echo "创建管理员: sudo -u www-data $APP_DIR/backend/venv/bin/python $APP_DIR/backend/manage.py createsuperuser"

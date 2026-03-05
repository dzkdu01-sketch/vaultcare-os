#!/bin/bash
# Vaultcare OS — VPS 一键部署脚本
# 用法: sudo bash setup.sh [域名或IP]
# 示例: sudo bash setup.sh vaultcare.example.com
# 示例: sudo bash setup.sh 192.168.1.100

set -e

DOMAIN="${1:-localhost}"
APP_DIR="/var/www/vaultcare"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=== Vaultcare OS 部署 ==="
echo "域名/IP: $DOMAIN"
echo "应用目录: $APP_DIR"
echo ""

# 检查是否在项目目录
if [ ! -f "backend/manage.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "错误: 请在项目根目录（含 backend/ 和 frontend/）执行此脚本"
    exit 1
fi

# 创建目录并复制文件
echo "[1/8] 创建应用目录..."
sudo mkdir -p "$APP_DIR"
sudo cp -r backend "$APP_DIR/"
sudo cp -r frontend "$APP_DIR/"
sudo cp -r deploy "$APP_DIR/"

# 安装系统依赖
echo "[2/8] 安装系统依赖..."
sudo apt-get update -qq
sudo apt-get install -y nginx python3.11 python3.11-venv python3-pip postgresql-client curl

# 检查 Node.js
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
    echo "安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 后端
echo "[3/8] 配置后端..."
cd "$BACKEND_DIR"
sudo python3.11 -m venv venv
sudo "$BACKEND_DIR/venv/bin/pip" install -q -r requirements.txt

# 创建 .env（若不存在）
if [ ! -f "$BACKEND_DIR/.env" ]; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    sudo tee "$BACKEND_DIR/.env" > /dev/null << ENVEOF
DEBUG=False
SECRET_KEY=$SECRET
ALLOWED_HOSTS=$DOMAIN,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://$DOMAIN,https://$DOMAIN
CSRF_TRUSTED_ORIGINS=http://$DOMAIN,https://$DOMAIN
ENVEOF
    echo "已创建 .env，使用 SQLite。如需 PostgreSQL 请编辑: $BACKEND_DIR/.env"
fi

sudo "$BACKEND_DIR/venv/bin/python" manage.py migrate --noinput
sudo "$BACKEND_DIR/venv/bin/python" manage.py collectstatic --noinput

# 前端
echo "[4/8] 构建前端..."
cd "$FRONTEND_DIR"
sudo npm ci --silent
sudo npm run build

# Nginx
echo "[5/8] 配置 Nginx..."
sudo sed "s/YOUR_DOMAIN/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" | sudo tee /etc/nginx/sites-available/vaultcare > /dev/null
sudo ln -sf /etc/nginx/sites-available/vaultcare /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

# systemd 服务
echo "[6/8] 配置 systemd..."
sudo cp "$APP_DIR/deploy/vaultcare.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/vaultcare-q.service" /etc/systemd/system/
sudo chown -R www-data:www-data "$APP_DIR"
sudo systemctl daemon-reload
sudo systemctl enable vaultcare vaultcare-q
sudo systemctl restart vaultcare vaultcare-q
sudo systemctl reload nginx

echo "[7/8] 创建超级用户..."
echo "请设置管理员账号："
sudo -u www-data "$BACKEND_DIR/venv/bin/python" manage.py createsuperuser || true

echo "[8/8] 完成"
echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://$DOMAIN"
echo "请执行以下命令创建管理员: sudo -u www-data $BACKEND_DIR/venv/bin/python manage.py createsuperuser"
echo ""

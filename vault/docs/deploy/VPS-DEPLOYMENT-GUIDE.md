# Vaultcare OS — VPS 部署指南

> 适用于 Ubuntu 22.04 / 24.04 LTS

---

## 一、前置准备

### 1.1 VPS 要求

| 项目 | 最低配置 |
|------|----------|
| 系统 | Ubuntu 22.04 / 24.04 LTS |
| 内存 | 1 GB |
| 磁盘 | 20 GB |
| 带宽 | 1 Mbps |

### 1.2 需要准备的信息

- [ ] VPS IP 地址
- [ ] 域名（可选，无域名可用 IP 访问）
- [ ] SSH 登录方式（密码或密钥）

---

## 二、快速部署（一键脚本）

```bash
# 1. 将代码上传到 VPS（任选一种方式）
# 方式 A：Git 克隆
ssh root@你的VPS_IP
git clone https://github.com/你的用户名/vault.git /var/www/vaultcare
cd /var/www/vaultcare

# 方式 B：本地 rsync 上传（在本地执行）
# rsync -avz --exclude node_modules --exclude venv --exclude __pycache__ --exclude .git ./ root@你的VPS_IP:/var/www/vaultcare/

# 2. 执行部署脚本（在 VPS 上，项目根目录）
cd /var/www/vaultcare   # 若用 rsync 上传则已在此目录
sudo bash deploy/setup.sh 你的域名或IP

# 示例：使用 IP 访问
sudo bash deploy/setup.sh 192.168.1.100

# 示例：使用域名
sudo bash deploy/setup.sh vaultcare.example.com
```

---

## 三、手动部署步骤

### 3.1 安装依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git nginx python3.11 python3.11-venv python3-pip nodejs npm postgresql-client

# 若 Node 版本过低，使用 NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 克隆代码

```bash
sudo mkdir -p /var/www/vaultcare
sudo chown $USER:$USER /var/www/vaultcare
cd /var/www/vaultcare

# 方式 A：从 Git 克隆
git clone https://github.com/你的用户名/vault.git .

# 方式 B：本地 rsync 上传（在本地执行）
# rsync -avz --exclude node_modules --exclude venv --exclude __pycache__ ./ vault:/var/www/vaultcare/
```

### 3.3 部署后端

```bash
cd /var/www/vaultcare/backend

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 创建 .env 文件（见下方「环境变量」）
nano .env

# 数据库迁移
python manage.py migrate

# 收集静态文件
python manage.py collectstatic --noinput

# 创建超级用户（首次）
python manage.py createsuperuser
```

### 3.4 部署前端

```bash
cd /var/www/vaultcare/frontend

# 安装依赖
npm ci

# 构建（生产环境 API 使用相对路径 /api）
npm run build

# 构建产物在 frontend/dist/
```

### 3.5 配置 Nginx

```bash
sudo cp /var/www/vaultcare/deploy/nginx.conf /etc/nginx/sites-available/vaultcare

# 修改配置中的域名
sudo sed -i 's/YOUR_DOMAIN/你的域名或IP/g' /etc/nginx/sites-available/vaultcare

# 启用站点
sudo ln -sf /etc/nginx/sites-available/vaultcare /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # 移除默认站点（可选）

# 测试并重载
sudo nginx -t && sudo systemctl reload nginx
```

### 3.6 配置 Gunicorn

```bash
# 复制 systemd 服务文件
sudo cp /var/www/vaultcare/deploy/vaultcare.service /etc/systemd/system/

# 修改服务文件中的路径（若与 /var/www/vaultcare 不同）
sudo nano /etc/systemd/system/vaultcare.service

# 启动
sudo systemctl daemon-reload
sudo systemctl enable vaultcare
sudo systemctl start vaultcare
sudo systemctl status vaultcare
```

### 3.7 配置 Django-Q2（异步任务）

```bash
sudo cp /var/www/vaultcare/deploy/vaultcare-q.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vaultcare-q
sudo systemctl start vaultcare-q
```

---

## 四、环境变量

在 `backend/.env` 中配置：

```env
# 必填
DEBUG=False
SECRET_KEY=生成一个随机长字符串
ALLOWED_HOSTS=你的域名.com,www.你的域名.com,IP地址

# 数据库（生产建议 PostgreSQL）
DATABASE_URL=postgresql://用户:密码@localhost:5432/vaultcare

# 或使用 SQLite（简单部署）
# 不设置 DATABASE_URL 则默认使用 SQLite

# CORS / CSRF（前端访问地址）
CORS_ALLOWED_ORIGINS=https://你的域名.com
CSRF_TRUSTED_ORIGINS=https://你的域名.com

# 可选：AI 功能
# CLAUDE_API_KEY=sk-xxx
```

生成 SECRET_KEY：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## 五、PostgreSQL 配置（推荐）

```bash
sudo -u postgres psql

# 在 psql 中执行：
CREATE USER vaultcare WITH PASSWORD '你的密码';
CREATE DATABASE vaultcare OWNER vaultcare;
\q
```

---

## 六、常见问题

### 6.1 502 Bad Gateway

- 检查 Gunicorn 是否运行：`sudo systemctl status vaultcare`
- 检查 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`

### 6.2 静态文件 404

- 确认 `python manage.py collectstatic` 已执行
- 检查 `STATIC_ROOT` 与 Nginx 配置中的路径一致

### 6.3 前端无法访问 API

- 确认 `CORS_ALLOWED_ORIGINS` 包含前端域名
- 生产环境前端使用相对路径 `/api`，无需配置 `VITE_API_URL`

### 6.4 HTTPS（SSL）

使用 Let's Encrypt：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```

---

## 七、更新部署

```bash
cd /var/www/vaultcare
git pull  # 或 rsync 上传新代码

# 后端
cd backend && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart vaultcare vaultcare-q

# 前端
cd ../frontend && npm ci && npm run build

# Nginx 无需重启（静态文件已更新）
```

---

## 八、文件结构

```
deploy/
├── nginx.conf          # Nginx 配置
├── vaultcare.service   # Gunicorn systemd 服务
├── vaultcare-q.service # Django-Q2 systemd 服务
├── setup.sh            # 一键部署脚本（可选）
└── README.md           # 本说明
```

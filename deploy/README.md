# Vault OS 1.1 部署说明（面向非技术用户）

本项目是「网站前台 + 后台接口」：**前端**打包成静态文件由 Nginx 提供；**后端**是 Node.js 服务，由 PM2 常驻运行。数据库为服务器上的 SQLite 文件（`backend/data/vaultcare.db`）。

---

## 一、你需要准备什么

1. **一台 Linux 云服务器**（推荐 Ubuntu 20.04/22.04），有公网 IP，已开放 **80 端口**（HTTP）。
2. **能登录服务器的账号**：通常服务商会给「root 密码」或「SSH 密钥」，需要会用 **PuTTY**、**Windows Terminal** 或 **VS Code Remote SSH** 连上服务器。
3. **本项目的代码**：把整个 `vault-os1.1` 文件夹放到服务器上（见下文「上传代码」）。

> 若完全不会登录 Linux：请先向云厂商要「控制台网页终端」或让同事帮你完成「上传目录 + 执行一条命令」两步。

---

## 二、上传代码到服务器（任选一种）

**方式 A：Git（推荐，会技术的人常用）**

```bash
cd /var/www
git clone <你的仓库地址> vault-os1.1
```

**方式 B：压缩包**

1. 在 Windows 上把 `vault-os1.1` 打成 zip。
2. 用 SFTP（FileZilla、WinSCP）上传到服务器，例如 `/var/www/vault-os1.1`。
3. 在服务器上解压：`unzip vault-os1.1.zip -d /var/www`（路径以你实际为准）。

脚本默认项目根目录为：`/var/www/vault-os1.1`（与仓库根 `README.md` 一致）。

---

## 三、一键部署（在服务器上执行）

1. 用 **root** 登录（或 `sudo -i` 切换到 root）。
2. **先确认项目已上传**：`/var/www/vault-os1.1` 下必须有 `frontend`、`backend`、`deploy` 三个文件夹。若 `ls /var/www` 里还没有 `vault-os1.1`，请先完成上文「二、上传代码」，不要直接跑脚本。
3. 执行下面**二选一**（你已是 root 时**不要**写 `sudo`，部分精简系统没有安装 `sudo`，会报 `sudo: command not found`）：

```bash
# 已是 root（推荐，与服务商网页终端一致）
bash /var/www/vault-os1.1/deploy/server-install.sh
```

```bash
# 非 root 的普通用户，且系统已安装 sudo 时
sudo bash /var/www/vault-os1.1/deploy/server-install.sh
```

若希望保留 `sudo` 命令：`apt-get update && apt-get install -y sudo`（Debian/Ubuntu）。

**粘贴命令时**：若行首出现 `^[[200~` 等乱码，说明终端粘贴模式异常，请**手动输入**上述命令，或先清空该行再粘贴。

脚本会自动：安装 Nginx、Node.js 20、构建前端、构建后端、用 PM2 启动 API、配置 Nginx 把 `/api` 转到本机 3002 端口。

4. 完成后用浏览器访问：`http://你的服务器IP/`  
   若打不开，检查云厂商「安全组 / 防火墙」是否放行 **80** 端口。

**可选：删除本机旧版 Django 目录（不可恢复）**

```bash
REMOVE_OLD_VAULTCARE=1 bash /var/www/vault-os1.1/deploy/server-install.sh
```

**自定义安装路径**（不推荐改，除非你知道后果）：

```bash
VAULT_OS11_ROOT=/opt/vault-os1.1 bash /opt/vault-os1.1/deploy/server-install.sh
```

---

## 四、部署后必做：开机自启（PM2）

脚本末尾会提示执行 `pm2 startup`。请按屏幕提示复制它给出的那一条命令并执行（通常是一次性配置 systemd），然后再执行：

```bash
pm2 save
```

这样服务器重启后 API 会自动起来。

---

## 五、前端环境变量说明（一般不用改）

首次部署时，若 `frontend` 下没有 `.env`，脚本会生成：

- `VITE_USE_MOCK=false`
- `VITE_API_BASE_URL=/api/v1`

含义：浏览器通过 **同域名** 访问 `/api/v1/...`，由 Nginx 转发到后端，无需写死 IP。

---

## 排错：打开网站仍是旧版「Vaultcare OS」登录页？

若 **`/etc/nginx/sites-enabled/`** 里**同时存在** `vaultcare.conf`（旧站）和 `vault-os11`（新站），浏览器可能仍访问到旧目录 `/var/www/vaultcare/frontend/dist`。一键脚本会删除 `vaultcare`，但部分主机面板生成的 **`vaultcare.conf`** 可能仍存在，需手动关掉旧站：

```bash
rm -f /etc/nginx/sites-enabled/vaultcare.conf
nginx -t && systemctl reload nginx
```

再执行 `curl -s http://127.0.0.1/ | head`：新前端标题应为 **`Vaultcare`**（见 `frontend/index.html`），而不是旧站的 **`Vaultcare OS`**。

---

## 六、如何更新版本

在服务器上进入项目根目录，拉代码或覆盖新文件后：

```bash
cd /var/www/vault-os1.1/frontend && npm ci && npm run build
cd /var/www/vault-os1.1/backend && npm ci && npm run build
pm2 restart vault-os11-api
sudo nginx -t && sudo systemctl reload nginx
```

---

## 七、本地 Windows 开发（仅供开发人员）

在 `vault-os1.1` 下分别安装依赖并启动（需已安装 Node.js 20+）：

```powershell
cd backend
npm install
npm run dev
```

另开终端：

```powershell
cd frontend
npm install
npm run dev
```

前端开发服务器会通过 Vite 代理把 `/api` 转到 `http://localhost:3002`。

---

## 八、配置文件位置速查

| 用途 | 文件 |
|------|------|
| Nginx（HTTP + 反代） | `deploy/nginx-ip.conf` → 安装到 `/etc/nginx/sites-available/vault-os11` |
| PM2 进程 | `deploy/ecosystem.config.cjs` |
| 一键安装 | `deploy/server-install.sh` |

---

## 九、没有删除的文档说明

- 需求类长文档已从本仓库移除；**部署与运行仅依赖** `frontend`、`backend`、`deploy` 与数据库文件。

若你希望进一步「只保留代码、删掉全部文档」以减小体积，请先备份后再删，并自行承担丢失需求说明的风险。

---

## 十、将本地 SQLite 数据同步到 VPS

业务数据在 **`backend/data/vaultcare.db`**（单文件）。把本地数据「搬到」服务器 = **用上传覆盖 VPS 上同路径的该文件**（会**覆盖**服务器上原有数据库，请先备份）。

### 操作前

1. **本地**：关闭正在跑的后端（若有 `npm run dev` 在 `backend` 里，先 Ctrl+C），再复制 `vaultcare.db`，避免文件半截。  
2. **VPS**：用 PM2 停掉 API，避免读写冲突：

```bash
pm2 stop vault-os11-api
```

（若进程名是 `vault-os1.1-api`，改成对应名字。）

### 备份服务器上旧库（强烈建议）

```bash
cp /var/www/vault-os1.1/backend/data/vaultcare.db /var/www/vault-os1.1/backend/data/vaultcare.db.bak.$(date +%Y%m%d)
```

### 上传本地文件（任选一种）

**方式 A：PowerShell / CMD 用 `scp`（需已安装 OpenSSH 客户端）**

在本机执行（把 IP、端口换成你的 VPS；**Spaceship Starlight 的 SSH 端口为 22022**，非 22）：

```powershell
scp -P 22022 "D:\cursor\vault-os1.1\backend\data\vaultcare.db" root@104.207.64.70:/var/www/vault-os1.1/backend/data/vaultcare.db
```

**方式 B：WinSCP / FileZilla（SFTP）**

- 本地文件：`vault-os1.1\backend\data\vaultcare.db`  
- 远程路径：`/var/www/vault-os1.1/backend/data/vaultcare.db`（覆盖上传）

### 上传后（在 VPS）

```bash
chmod 644 /var/www/vault-os1.1/backend/data/vaultcare.db
pm2 restart vault-os11-api
pm2 save
```

再用浏览器刷新商品列表，应能看到与本地一致的数据。

### 说明

- 若本地**没有** `vaultcare.db`，说明本地还没跑过后端或库在别的路径，请先在本机启动一次后端并确认文件存在。  
- 当前实现以 **数据库文件** 为主；若日后有独立上传目录（大量图片等），需一并同步对应目录（以当时项目为准）。

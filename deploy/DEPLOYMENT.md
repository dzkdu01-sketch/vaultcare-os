# 部署索引（每次部署前先读本文）

本文是 **部署前的检查清单与入口**，细节与排错见同目录 [`README.md`](README.md)。

---

## 相关文件速查

| 文件 | 用途 |
|------|------|
| **`deploy/DEPLOYMENT.md`**（本文） | 部署前索引与清单 |
| [`deploy/README.md`](README.md) | 分步说明、环境变量、数据库同步、排错 |
| `deploy/server-install.sh` | Ubuntu 上一键安装（Nginx + Node + 构建 + PM2） |
| `deploy/nginx-ip.conf` | Nginx 模板（HTTP + 静态 + `/api` 反代） |
| `deploy/ecosystem.config.cjs` | PM2 配置（进程名 **`vault-os11-api`**） |
| `scripts/sync-db-to-vps.ps1` | 本机上传 `vaultcare.db` 到 VPS（PowerShell） |

---

## 架构备忘（1 分钟）

- **前端**：`frontend/dist` → Nginx `root` 提供静态页。  
- **后端**：Node 监听 **`3002`**，PM2 进程名以 **`ecosystem.config.cjs`** 为准。  
- **数据库**：`backend/data/vaultcare.db`（SQLite），新环境默认为空库。  
- **命名**：Nginx 配置文件名多为 **`vault-os11`**；项目目录多为 **`vault-os1.1`**（带点），**两者不是同一个名字，属正常**。

---

## 部署前检查清单（建议逐项打勾）

### 通用（首次 / 更新都适用）

- [ ] 已确认 **云防火墙 / 安全组** 放行 **TCP 80**（网站）及 **22**（SSH 传文件）；SSH 若为非 22 端口，已记下端口号。  
- [ ] 已在服务商面板设置并保存 **VPS root 密码**，或已配置 **SSH 公钥**（本机 `scp` / WinSCP 依赖此）。  
- [ ] 本机代码已 **`git push`**，服务器将 **`git pull`** 的版本与预期一致。  
- [ ] 若使用 **CloudPanel 等面板**：知晓其 Nginx 通常只加载 **`/etc/nginx/sites-enabled/*.conf`**，启用站点需 **`.conf` 后缀** 的软链（详见 [`README.md` 排错章节](README.md)）。

### 仅首次部署

- [ ] 服务器上 **`/var/www/vault-os1.1`** 已存在，且含 **`frontend`、`backend`、`deploy`**。  
- [ ] 执行安装脚本的用户为 **root** 时：**不要**使用 `sudo`（若系统无 `sudo` 会报错）。  
- [ ] 安装完成后按脚本提示执行 **`pm2 startup`** 与 **`pm2 save`**。

### 仅更新代码 / 发版

- [ ] 在服务器项目根目录 **`git pull`**。  
- [ ] **`frontend`**：`npm ci && npm run build`。  
- [ ] **`backend`**：`npm ci && npm run build`。  
- [ ] **`pm2 restart vault-os11-api`**（名称以 `pm2 list` 为准）。  
- [ ] **`nginx -t && systemctl reload nginx`**（仅当改动了 Nginx 配置时必做）。

### 同步本地数据库到 VPS（可选）

- [ ] 上传前在 VPS **`pm2 stop vault-os11-api`**（或实际进程名）。  
- [ ] 使用 [`README.md` 第十节](README.md) 或 `scripts/sync-db-to-vps.ps1`；上传后 **`chmod` + `pm2 restart`**。  
- [ ] 若 **`scp` 失败**：核对 root 密码、端口、多次失败后等待解封或换网络；可用 **WinSCP** 覆盖同一路径。

---

## 部署后验证（最短路径）

在 **VPS 上**依次执行，全部正常再对外宣布「已上线」：

```bash
ss -tulnp | grep ':80'
curl -sI --max-time 5 http://127.0.0.1/
curl -s http://127.0.0.1:3002/api/health
pm2 list
```

| 检查项 | 期望 |
|--------|------|
| 80 端口 | 有 **nginx** 监听 |
| `curl :80` | **200**（或合理重定向），非 502 / 长时间无响应 |
| `curl :3002/api/health` | JSON 中含 **healthy** |
| PM2 | **`vault-os11-api`**（或与 ecosystem 一致）为 **online** |

浏览器：**`http://<公网IP>/`** ，建议无痕或强刷。

---

## 常见问题速查（详见 README）

| 现象 | 优先排查 |
|------|----------|
| 仍打开旧版「Vaultcare OS」 | 是否还有 **`vaultcare.conf`** 等旧站占用 80 → 禁用旧站软链 |
| `listen 80` 写了但 `ss` 无 80 | 站点是否以 **`.conf`** 链入 `sites-enabled`；软链是否指向 **`sites-available` 真实文件名** |
| 502 | 后端是否 **online**；Nginx **`/api/`** 是否反代到 **3002** |
| `scp` / SSH 失败 | root 密码、端口、封禁；改用 **WinSCP** 或 **SSH 密钥** |
| 页面无数据 | 新库为空属正常；需 **新建数据** 或 **同步 vaultcare.db** |

完整说明：[**deploy/README.md → 排错与数据库同步**](README.md)。

---

## 建议的发布顺序（更新发版）

1. 读 **本文 checklist** → 2. 服务器 **`git pull`** → 3. 构建 **frontend + backend** → 4. **PM2 restart** → 5. 执行 **验证命令** → 6. 浏览器验收。

---

*若你改进了一键脚本或面板特有条件，请同步更新 `deploy/README.md` 与本文件中的「检查清单」。*

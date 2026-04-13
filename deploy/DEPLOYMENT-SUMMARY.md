# 生产部署备忘（无敏感信息）

> 详细清单与排错仍以 [`DEPLOYMENT.md`](DEPLOYMENT.md)、[`README.md`](README.md) 为准。本文记录 **2026-04** 起在 Spaceship Starlight VM 上的一次成功部署事实，便于下次对照。

## 环境

| 项 | 值 |
|----|-----|
| 云厂商 / 产品 | Spaceship · Starlight™ Virtual Machines（Ubuntu） |
| 公网 IP | `104.207.64.70` |
| SSH 端口 | **22022**（非默认 22） |
| 系统 | Ubuntu 24.04（noble） |
| 项目目录 | `/var/www/vault-os1.1` |
| 后端进程 | PM2 名称 `vault-os11-api`，端口 **3002** |
| 网页 | Nginx 提供 `frontend/dist`，`/api/` 反代到 3002 |

## 代码与数据

| 项 | 说明 |
|----|------|
| GitHub 仓库 | `https://github.com/dzkdu01-sketch/vaultcare-os.git`（以你实际仓库为准） |
| 日常更新代码 | 本机 `git push` → 服务器 `git pull` 后执行 `deploy/update-server.sh` 或等价构建命令 |
| 数据库文件 | `backend/data/vaultcare.db` **勿提交 Git**；上生产需 **单独 scp**（停 PM2 → 覆盖 → 启 PM2） |

## 本机常用命令（Windows）

```powershell
# 上传数据库（示例）
scp -P 22022 "D:\cursor\vault-os1.1\backend\data\vaultcare.db" root@104.207.64.70:/var/www/vault-os1.1/backend/data/vaultcare.db
```

## 域名与 HTTPS

- 域名：`vault-os.site` — DNS **A 记录** 需指向上述 **公网 IP** 后，再在服务器上配置证书（见 `setup-https-vault-os-site.sh` 与 `nginx-vault-os.site.conf`）。
- 当前可用 **HTTP IP** 访问验证：`http://104.207.64.70/`

## 已知坑（已在本仓库脚本中缓解）

- 服务器上 `npm ci` 若跳过 devDependencies，会 **`tsc: not found`**：`server-install.sh` / `update-server.sh` 已使用 `NODE_ENV=development npm ci`；前后端 `package.json` 的 `build` 已改为 `node ./node_modules/typescript/lib/tsc.js` 等。
- 用脚本直接改磁盘上的 `vaultcare.db` 时，须 **先停后端**（PM2），否则内存与文件不一致。

## 敏感信息放哪里

请在本机维护 **`deploy/secrets.local.md`**（已从 Git 忽略）：复制 `secrets.local.example.md` 为 `secrets.local.md` 后填写密码、密钥等，**勿提交**。

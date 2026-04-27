# 部署问题复盘与上线前速查

本文档汇总 Vault OS 1.1 在 **VPS（如 104.207.64.70 / `/var/www/vault-os1.1`）** 上更新、部署时踩过的坑。  
**建议每次发布或上服务器排障前先扫一遍「上线前检查清单」。**

---

## 上线前检查清单（建议顺序）

1. **本机**
   - [ ] 需要上线的改动已 `git commit`。
   - [ ] `git push origin main` **成功**（若失败，多为网络/代理；**不 push 则服务器 `git pull` 永远少提交**）。

2. **VPS 网页终端 / SSH**
   - [ ] `cd /var/www/vault-os1.1`
   - [ ] `git status -sb`：不应长期 `behind` 于 `origin/main`；若落后，先**能拉下代码**再构建（见下文 **§9**）。
   - [ ] 执行 `bash deploy/update-server.sh`（或本机用 `scripts/deploy-full-to-vps.ps1 -SkipDb`，需可交互输密码/密钥）。
   - [ ] 若 `backend` 下 **`npm ci` / `npm run build` 报 `better-sqlite3`、node-gyp 相关错**，先按 **§10** 装系统依赖再重装 `node_modules`。
   - [ ] 脚本**结尾无 error**；`npm` 的 warning/deprecated 多数可忽略，**`error` / `ELIFECYCLE` 要处理**。

3. **进程与健康检查**
   - [ ] `pm2 list` 中 **`vault-os11-api` 为 online**。
   - [ ] `curl -s http://127.0.0.1:3002/api/health` 返回 JSON 且含 **`healthy`**（或等价成功响应）。

4. **浏览器**
   - [ ] 打开管理端页面后 **Ctrl+F5 强刷**，避免旧前端缓存。

5. **公网抽查（可选）**
   - [ ] `http://<IP>/api/health` 为 **200** 而非 **502**。

---

## 我们遇到过的问题与原因

### 1. 服务器代码落后：只 `git fetch` 不 `git pull`

- **现象**：`git status` 显示 `main...origin/main [behind N]`，只更新了“远程引用”，**磁盘上代码还是旧的**。
- **教训**：更新应用必须 **`git pull origin main`（或等价合并）**，再跑 **`bash deploy/update-server.sh`**。仅 `fetch` 不会部署。

### 2. 公网 502 / 产品页「加载失败 HTTP 502」

- **现象**：Nginx 返回 `502 Bad Gateway`；有时响应体里就是一段 HTML 错误页，被前端当字符串展示出来。
- **原因**：Nginx 反代到本机 **Node 后端**失败——多半是本机 **3002 上无进程监听**。
- **典型根因**：**PM2 里没有任何应用**，或没有名为 **`vault-os11-api`** 的进程。此时不是“业务 API 写坏了”，而是 **API 根本没在跑**。

### 3. `update-server.sh` 只 `pm2 restart`，进程从未注册过

- **现象**：脚本前段 `git pull`、前后端 `npm ci` / `build` 都成功，最后报错：  
  `[PM2] Process or Namespace vault-os11-api not found`。
- **原因**：`restart` 只能重启**已存在**的进程；新环境、PM2 被清空、或从未 `pm2 start` 过，**列表为空**时 `restart` 必失败，**新构建不会自动被拉起来**。
- **已改进**：`deploy/update-server.sh` 会判断：若进程不存在则执行 **`pm2 start deploy/ecosystem.config.cjs`**，再 **`pm2 save`**。
- **手工急救**（与脚本逻辑一致）：  
  `cd /var/www/vault-os1.1 && pm2 start deploy/ecosystem.config.cjs && pm2 save`

### 4. 机器重启后服务又没了：`pm2 startup` 报 Init system not found

- **现象**：执行 `pm2 startup` 出现 **`Init system not found`**（栈在 `Startup.js`）。
- **原因**：部分 **VPS/面板/容器**（如部分 Spaceship 环境）**没有传统 init（如 systemd）**，PM2 无法自动写入“开机自启”。
- **后果**：**整机或容器重启后**，若未用其他方式保活，PM2 可能空列表，**API 再挂 502**。
- **建议**：
  - 依赖 **`pm2 save` + 主机文档**中的方案（如 **`crontab @reboot`** 里执行 `cd /var/www/vault-os1.1 && pm2 resurrect` 等，以厂商说明为准）
  - 或确认面板是否提供**进程守护**。
- **说明**：`pm2 save` 只保存**当前在跑**的进程；若从未成功 `start` 过，save 也救不了空列表。

### 5. 本机无法 `git push`、服务器也拉不到最新

- **现象**：`git push` 超时/连不上 GitHub。
- **后果**：VPS 上 `git pull` 只能到**已存在于 GitHub 的提交**；本机**未 push 的提交**不会出现在服务器。
- **教训**：部署前以 **`git log origin/main` 与本地一致**为准；或换网络/镜像/传输方式再 push。

### 6. 一键 PowerShell 部署卡在 SSH

- **原因**：`scripts/deploy-full-to-vps.ps1` 会多次 **ssh/scp**，需 **root 密码或密钥**；在非交互/自动化环境可能**无密码输入**而看似卡住。
- **教训**：在 **本机可交互的终端**中运行；或**只用 VPS 网页终端**：`git pull` + `bash deploy/update-server.sh`（见上）。

### 7. 管理端“图片能显示、长描述里视频不显示”

- **与部署无关的产品逻辑说明**（供排障，非每次必现）：
  - **商品图片**多来自 `product.images` 字段，**直接 `<img src>`**，不经过富文本消毒。
  - **长描述里的 HTML** 会经过前端的 **`sanitizeProductHtml`（DOMPurify + 媒体域名白名单）**；若视频 `src` 所在域名**不在白名单**，`src` 可能被去掉，出现**黑屏、0:00**。
  - **公共店铺站**（如 WordPress/Elementor 的 yoyo 站）是**另一套系统**；**黑屏**还要单查 **mp4 直链 404、MIME、跨域、文件是否存在**，不能单靠本仓库白名单解决。

### 8. 如何确认“服务器上已是某次提交”

- **最可靠**：在 VPS 上 `cd /var/www/vault-os1.1 && git log -1 --oneline`，与 GitHub **main** 上最新提交**一致**。
- **外网** `/api/health` **不返回 Git 版本号**；**不要**仅依赖首页静态资源 hash 对版本下结论（构建环境不同 hash 可能不同）。

<a id="deploy-lesson-9"></a>

### 9. `git pull` 报错：本地修改会被合并覆盖（常见：`deploy/update-server.sh`）

- **现象**：`error: Your local changes to the following files would be overwritten by merge` → **`git pull` 被中止**，磁盘上仍是旧代码，随后 **`npm run build` 可能报缺导出、缺模块等与远端不一致的错**。
- **原因**：在 VPS 上**直接改过**已被 Git 跟踪的文件（常是在网页终端里手改 `update-server.sh` 等），与 `origin/main` 冲突。
- **避免**：
  - **不要**在服务器上改仓库内脚本；要改在**本机改完 `commit` + `push`**，再让服务器只拉取。
  - 若确定**没有**需要保留的本地改动，在 VPS 上可执行：  
    `cd /var/www/vault-os1.1 && git fetch origin && git checkout main && git reset --hard origin/main`  
    （**会丢弃**该目录下未 push 的本地修改，慎用。）
- **核对**：`git log -1 --oneline` 应与 GitHub 上**目标提交一致**后再跑 `update-server.sh`。

<a id="deploy-lesson-10"></a>

### 10. 后端 `npm ci` 失败：`better-sqlite3`、`prebuild-install` / `node-gyp: not found`

- **现象**：`npm ci` 或安装依赖时，在 `better-sqlite3` 的 `install` 脚本里报错，例如 `prebuild-install: not found`、`node-gyp: not found`、或 `TS2307: Cannot find module 'better-sqlite3'`（实为未装全依赖）。
- **原因**：`better-sqlite3` 是**带原生 C++ 的模块**，需要**编译环境**；精简镜像/新 VPS 上常缺 `make`、`g++` 等，且 npm 子进程有时找不到 `node-gyp` 可执行文件。
- **处理顺序（在 VPS 上、root，路径按你实际根目录改）**：
  1. `apt-get update && apt-get install -y build-essential python3`
  2. `npm install -g node-gyp prebuild-install`（二选一可省略若下一步已成功，但实践中常能一次过）
  3. `cd /var/www/vault-os1.1/backend && rm -rf node_modules && npm ci`
  4. `npm run build`
- **避免**：新环境第一次部署/重装 Node 后，**先**保证能干净跑通 **`backend` 的 `npm ci`**，再谈业务排障；不要把「依赖没装全」误当成业务代码错误。

### 11. PM2 进程名记错

- **正确进程名**（以 `deploy/ecosystem.config.cjs` 为准）：**`vault-os11-api`**（`os` 与 `11` 连写，**不是** `vault-os1.1-api`、中间**没有**点号）。
- **避免**：`restart` 前用 `pm2 list` 看**实际**名字；**从未 `start` 过**时应用 **`pm2 start deploy/ecosystem.config.cjs`**，不要用错名字的 `restart`（`update-server.sh` 已做「有则 restart、无则 start」判断）。

---

## 给未来的自己的一句话

- **先 push、再 pull、再跑 `update-server.sh`；**  
- **`git pull` 被挡时先看是不是在服务器上改了被跟踪文件，必要时 `reset --hard` 与远端对齐；**  
- **`better-sqlite3` 装不上时先 `build-essential` + 再 `npm ci`，别空猜代码坏了；**  
- **看 `pm2 list` 和本机 `curl` 健康检查；**  
- **502 先怀疑「后端没起来」，不是先怀疑业务逻辑；**  
- **无 systemd 的环境要单独规划「重启后如何拉起 PM2」。**

---

*若本文与 `deploy/DEPLOYMENT.md` 有出入，以仓库内实际脚本与当前运维约定为准。*

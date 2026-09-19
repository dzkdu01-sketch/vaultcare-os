# Vault OS

中台前端（Vite + React）与 API（Node + Express）。

- **文档索引**：[`docs/01-INDEX.md`](docs/01-INDEX.md)；治理规范 [`docs/00-INDEX.md`](docs/00-INDEX.md)
- **每次部署前先读**：[`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md)（检查清单与索引）
- **生产环境速查（IP、端口、目录）**：[`deploy/DEPLOYMENT-SUMMARY.md`](deploy/DEPLOYMENT-SUMMARY.md)
- **一步步部署（中文）**：[`deploy/README.md`](deploy/README.md)；**VPS 上 `git pull` 被挡、或 `better-sqlite3`/node-gyp 装失败** 见复盘 [§9](deploy/DEPLOY-LESSONS-ZH.md#deploy-lesson-9)、[§10](deploy/DEPLOY-LESSONS-ZH.md#deploy-lesson-10)
- **Ubuntu 一键脚本**：`deploy/server-install.sh`
- **本地敏感信息（SSH 等）**：复制 `deploy/secrets.local.example.md` 为 `deploy/secrets.local.md` 自行填写（已 `.gitignore`，勿提交）

**发版约定：** 只上代码，不上本机 `backend/data/vaultcare.db`。订单、商品、同步记录、SKU 对照 CSV 都是过程数据，已从仓库去掉。服务器若也要清空过程数据，先停 API，再执行 `cd backend && node scripts/wipe-operational-data.mjs`。

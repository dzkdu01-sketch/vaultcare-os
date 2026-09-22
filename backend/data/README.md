# 数据库目录

本目录只放运行时 SQLite，**不进 Git、不上生产包**。

- 文件：`vaultcare.db`（以及 `.db-wal` / `.db-shm`）
- 首次启动后端会自动建空库和表结构
- 订单、商品、同步记录、导入货源都属于过程数据，发版前应清空

发版只上代码。不要把本机测过的 `vaultcare.db` 用 `sync-db-to-vps.ps1` 或 `-UploadDb` 覆盖服务器。

若服务器上也要清过程数据（保留站点 / 账号 / 供应商主数据）：

```bash
# 先停 API
pm2 stop vault-os11-api
cd backend && node scripts/wipe-operational-data.mjs
pm2 start vault-os11-api   # 或 restart
```

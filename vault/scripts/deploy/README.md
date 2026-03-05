# 部署脚本

## 1. 本机每日自动推送到 GitHub（Windows）

- 运行 `D:\cursor\vault\scripts\deploy\每日推送.bat` 或使用任务计划程序定时执行
- 任务计划程序设置：
  - 程序/脚本：`D:\cursor\vault\scripts\deploy\每日推送.bat`
  - 触发器：每天 23:00（建议早于 VPS 拉取时间）

## 2. VPS 每日自动更新

1. 将 `vaultcare-update.sh` 复制到 VPS
2. 修改脚本顶部 `REPO_DIR` 为你的仓库路径
3. 按需取消注释 3、4 步（前端构建、后端重启）
4. 执行：`chmod +x vaultcare-update.sh`
5. 添加 crontab：`crontab -e`，加入：
   ```
   0 3 * * * /path/to/vaultcare-update.sh >> /tmp/vaultcare-update.log 2>&1
   ```

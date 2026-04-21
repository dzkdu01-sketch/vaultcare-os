# 在 VPS 上停止 API → 执行 backend 清空订单脚本 → 重启 API
# 仅 Windows PowerShell 使用。若你已在 Linux 网页终端里登录 VPS，请用：
#   bash /var/www/vault-os1.1/scripts/purge-orders-on-vps.sh
# 需 OpenSSH、VPS root（或密钥）。默认与 deploy-full-to-vps.ps1 一致。
#
#   .\scripts\purge-orders-on-vps.ps1
#   .\scripts\purge-orders-on-vps.ps1 -SshPort 22
#
param(
  [string] $VpsHost = "104.207.64.70",
  [string] $RemoteRoot = "/var/www/vault-os1.1",
  [int] $SshPort = 22022,
  [string] $Pm2Name = "vault-os11-api"
)

$ErrorActionPreference = "Stop"
$SshBase = @("-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=15")

function Invoke-Ssh([string] $RemoteCmd) {
  if ($SshPort -ne 22) {
    & ssh @SshBase -p $SshPort ("root@${VpsHost}") $RemoteCmd
  } else {
    & ssh @SshBase ("root@${VpsHost}") $RemoteCmd
  }
  if ($LASTEXITCODE -ne 0) { throw "ssh failed: $RemoteCmd" }
}

# 单行 bash；用 node 执行 .mjs，不依赖 tsx/npx
$backend = "$RemoteRoot/backend"
$remoteBash = "set -e; cd '$backend' && pm2 stop $Pm2Name && node scripts/purge-all-orders.mjs && chmod 644 '$backend/data/vaultcare.db' && pm2 restart $Pm2Name && pm2 save && echo Done"

Write-Host ""
Write-Host "Remote: $VpsHost -> purge orders (node, no tsx). Git pull first if missing purge-all-orders.mjs" -ForegroundColor Yellow
Write-Host ""

Invoke-Ssh $remoteBash

Write-Host ""
Write-Host "远程清空订单已完成。" -ForegroundColor Green
Write-Host ""

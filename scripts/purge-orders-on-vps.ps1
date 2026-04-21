# 在 VPS 上停止 API → 执行 backend 清空订单脚本 → 重启 API
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

$remoteCmd = @"
set -e
cd '$RemoteRoot/backend'
pm2 stop $Pm2Name
npx tsx scripts/purge-all-orders.ts
chmod 644 '$RemoteRoot/backend/data/vaultcare.db' 2>/dev/null || true
pm2 restart $Pm2Name
pm2 save
echo Done.
"@

Write-Host ""
Write-Host "将在 $VpsHost 上清空 orders（请先确认代码已部署含 scripts/purge-all-orders.ts）。" -ForegroundColor Yellow
Write-Host ""

Invoke-Ssh $remoteCmd

Write-Host ""
Write-Host "远程清空订单已完成。" -ForegroundColor Green
Write-Host ""

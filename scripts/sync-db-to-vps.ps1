# Upload backend/data/vaultcare.db to VPS (needs OpenSSH scp, root password or SSH key)
# Usage from repo root: .\scripts\sync-db-to-vps.ps1
# Spaceship Starlight 默认 SSH 端口 22022；其它 VPS 常为 22：.\scripts\sync-db-to-vps.ps1 -SshPort 22
# Before upload on VPS: pm2 stop <your-api-name>
# After upload on VPS: chmod 644 .../vaultcare.db && pm2 restart <name> && pm2 save

param(
  [string] $VpsHost = "104.207.64.70",
  [string] $RemoteDir = "/var/www/vault-os1.1/backend/data",
  [int] $SshPort = 22022
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$db = Join-Path $root "backend\data\vaultcare.db"
if (-not (Test-Path -LiteralPath $db)) {
  Write-Error "Local DB not found: $db - run backend locally once first."
}

$local = $db
$remote = "root@${VpsHost}:${RemoteDir}/vaultcare.db"

Write-Host ""
Write-Host "[1/2] On VPS, stop API first (name from pm2 list), e.g. pm2 stop vault-os11-api" -ForegroundColor Yellow
Write-Host ""
Write-Host "[2/2] Uploading (enter root password if prompted):" -ForegroundColor Yellow
Write-Host "      $local"
Write-Host "  ->  $remote"
Write-Host ""

if ($SshPort -ne 22) {
  Write-Host "Using SSH port: $SshPort" -ForegroundColor Yellow
}
& scp -P $SshPort $local $remote
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. On VPS run:" -ForegroundColor Green
Write-Host ('  chmod 644 ' + $RemoteDir + '/vaultcare.db')
Write-Host '  pm2 restart vault-os11-api'
Write-Host '  pm2 save'
Write-Host ""

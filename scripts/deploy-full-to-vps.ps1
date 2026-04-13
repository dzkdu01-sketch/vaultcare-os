# One-click deploy from Windows: stop PM2 -> optional backup -> upload vaultcare.db -> upload update-server.sh -> run remote update.
# Requires: OpenSSH (ssh/scp), git push done, VPS root SSH.
#
#   .\scripts\deploy-full-to-vps.ps1
#   .\scripts\deploy-full-to-vps.ps1 -SshPort 22
#   .\scripts\deploy-full-to-vps.ps1 -SkipDb
#
# First time: commit and push deploy/update-server.sh; this script uploads it each run before executing.
#
# IMPORTANT: Run in an interactive PowerShell / Windows Terminal window. SSH will prompt for the root password
# several times unless you use an SSH key. Running inside a non-interactive tool may look "stuck" at ssh/scp.

param(
  [string] $VpsHost = "104.207.64.70",
  [string] $RemoteRoot = "/var/www/vault-os1.1",
  [int] $SshPort = 22022,
  [string] $GitBranch = "main",
  [switch] $SkipDb,
  [switch] $NoBackup
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$dbLocal = Join-Path $repoRoot "backend\data\vaultcare.db"
$updateScriptLocal = Join-Path $repoRoot "deploy\update-server.sh"

# Avoid indefinite hang on network failure; password prompts still need an interactive terminal.
$SshBase = @("-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=15")

function Invoke-Ssh([string] $RemoteCmd) {
  if ($SshPort -ne 22) {
    & ssh @SshBase -p $SshPort ("root@${VpsHost}") $RemoteCmd
  } else {
    & ssh @SshBase ("root@${VpsHost}") $RemoteCmd
  }
  if ($LASTEXITCODE -ne 0) { throw "ssh failed: $RemoteCmd" }
}

if (-not (Test-Path -LiteralPath $updateScriptLocal)) {
  Write-Error "Missing: $updateScriptLocal"
  exit 1
}

if (-not $SkipDb) {
  if (-not (Test-Path -LiteralPath $dbLocal)) {
    Write-Error "Local DB not found: $dbLocal - run backend locally once, or use -SkipDb."
    exit 1
  }
}

Write-Host ""
Write-Host "Confirm: git push origin $GitBranch is done; server will git pull." -ForegroundColor Yellow
Write-Host "If ssh/scp asks for a password, type the VPS root password (nothing will echo). Use a real terminal if this hangs." -ForegroundColor Yellow
Write-Host ""

Write-Host "==> [1/5] pm2 stop vault-os11-api" -ForegroundColor Cyan
Invoke-Ssh "pm2 stop vault-os11-api"

if (-not $SkipDb -and -not $NoBackup) {
  Write-Host "==> [2/5] backup remote vaultcare.db if present" -ForegroundColor Cyan
  $ts = Get-Date -Format "yyyyMMddHHmmss"
  $bakCmd = 'test -f ' + $RemoteRoot + '/backend/data/vaultcare.db && cp ' + $RemoteRoot + '/backend/data/vaultcare.db ' + $RemoteRoot + '/backend/data/vaultcare.db.bak.' + $ts + ' || true'
  Invoke-Ssh $bakCmd
}

if (-not $SkipDb) {
  Write-Host "==> [3/5] scp vaultcare.db (password if prompted)" -ForegroundColor Cyan
  $remoteDb = "root@${VpsHost}:${RemoteRoot}/backend/data/vaultcare.db"
  if ($SshPort -ne 22) {
    & scp @SshBase -P $SshPort $dbLocal $remoteDb
  } else {
    & scp @SshBase $dbLocal $remoteDb
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "==> [3/5] skip DB (-SkipDb)" -ForegroundColor DarkGray
}

Write-Host "==> [4/5] scp deploy/update-server.sh" -ForegroundColor Cyan
$remoteSh = "root@${VpsHost}:${RemoteRoot}/deploy/update-server.sh"
if ($SshPort -ne 22) {
  & scp @SshBase -P $SshPort $updateScriptLocal $remoteSh
} else {
  & scp @SshBase $updateScriptLocal $remoteSh
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> [5/5] remote: git pull + build + pm2" -ForegroundColor Cyan
$remoteEnv = 'export VAULT_OS11_ROOT=' + $RemoteRoot + '; export GIT_BRANCH=' + $GitBranch + ';'
$runUpdate = $remoteEnv + ' bash ' + $RemoteRoot + '/deploy/update-server.sh'
Invoke-Ssh $runUpdate

Write-Host ""
Write-Host "Done. Open site in browser and hard refresh." -ForegroundColor Green
Write-Host ""

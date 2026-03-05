# Vaultcare OS — 一键部署到 VPS
# 用法: 在 PowerShell 中执行 .\deploy\deploy-to-vps.ps1
# 会提示输入 root 密码（输入时不显示，正常）

$VPS_IP = "72.61.140.40"
$VPS_USER = "root"

Write-Host "=== Vaultcare OS 部署到 $VPS_IP ===" -ForegroundColor Cyan
Write-Host ""

# 1. 打包
Write-Host "[1/4] 打包代码..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

if (Test-Path vault-deploy.tar) { Remove-Item vault-deploy.tar }
tar -cf vault-deploy.tar --exclude=node_modules --exclude=venv --exclude=__pycache__ --exclude=.git --exclude=frontend/dist --exclude=backend/staticfiles --exclude=backend/media --exclude=backend/db.sqlite3 backend frontend deploy docs 2>$null
if (-not (Test-Path vault-deploy.tar)) {
    Write-Host "打包失败" -ForegroundColor Red
    exit 1
}
Write-Host "  完成" -ForegroundColor Green

# 2. 上传
Write-Host "[2/4] 上传到 VPS（需输入 root 密码）..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no vault-deploy.tar ${VPS_USER}@${VPS_IP}:/tmp/
if ($LASTEXITCODE -ne 0) {
    Write-Host "上传失败，请检查网络和密码" -ForegroundColor Red
    exit 1
}
Write-Host "  完成" -ForegroundColor Green

# 3. 远程部署
Write-Host "[3/4] 在 VPS 上执行部署（可能再次需要密码）..." -ForegroundColor Yellow
$remoteScript = @"
set -e
mkdir -p /var/www/vaultcare
cd /var/www/vaultcare
tar -xf /tmp/vault-deploy.tar
rm /tmp/vault-deploy.tar
chmod +x deploy/setup.sh
bash deploy/setup.sh $VPS_IP
echo 'DEPLOY_DONE'
"@
$remoteScript | ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "远程部署失败" -ForegroundColor Red
    exit 1
}
Write-Host "  完成" -ForegroundColor Green

# 4. 清理
Write-Host "[4/4] 清理..." -ForegroundColor Yellow
Remove-Item vault-deploy.tar -ErrorAction SilentlyContinue
Write-Host "  完成" -ForegroundColor Green

Write-Host ""
Write-Host "=== 部署完成 ===" -ForegroundColor Green
Write-Host "访问地址: http://$VPS_IP" -ForegroundColor Cyan
Write-Host ""
Write-Host "创建管理员账号，在本地执行:" -ForegroundColor Yellow
Write-Host "  ssh ${VPS_USER}@${VPS_IP} `"sudo -u www-data /var/www/vaultcare/backend/venv/bin/python /var/www/vaultcare/backend/manage.py createsuperuser`"" -ForegroundColor White
Write-Host ""

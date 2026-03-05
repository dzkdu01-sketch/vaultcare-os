@echo off
chcp 65001 >nul
echo === Vaultcare OS 部署到 72.61.140.40 ===
echo.
echo 将依次执行：打包、上传、远程部署
echo 会提示输入 root 密码（输入时不显示，属正常）
echo.
pause

cd /d "%~dp0.."

echo [1/4] 打包代码...
tar -cf vault-deploy.tar --exclude=node_modules --exclude=venv --exclude=__pycache__ --exclude=.git --exclude=frontend/dist --exclude=backend/staticfiles --exclude=backend/media --exclude=backend/db.sqlite3 backend frontend deploy docs
if errorlevel 1 (echo 打包失败 & pause & exit /b 1)

echo [2/4] 上传到 VPS...
scp -o StrictHostKeyChecking=no vault-deploy.tar root@72.61.140.40:/tmp/
if errorlevel 1 (echo 上传失败，请检查网络和密码 & pause & exit /b 1)

echo [3/4] 在 VPS 上执行部署...
ssh -o StrictHostKeyChecking=no root@72.61.140.40 "mkdir -p /var/www/vaultcare && cd /var/www/vaultcare && tar -xf /tmp/vault-deploy.tar && rm /tmp/vault-deploy.tar && chmod +x deploy/setup.sh && bash deploy/setup.sh 72.61.140.40"
if errorlevel 1 (echo 远程部署失败 & pause & exit /b 1)

echo [4/4] 清理...
del vault-deploy.tar 2>nul

echo.
echo === 部署完成 ===
echo 访问地址: http://72.61.140.40
echo.
echo 创建管理员账号，执行:
echo   ssh root@72.61.140.40 "sudo -u www-data /var/www/vaultcare/backend/venv/bin/python /var/www/vaultcare/backend/manage.py createsuperuser"
echo.
pause

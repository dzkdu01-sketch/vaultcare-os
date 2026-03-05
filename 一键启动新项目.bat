@echo off
chcp 65001 >nul
cd /d D:\cursor

echo ========================================
echo   一键启动新项目
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "D:\cursor\一键启动新项目.ps1" %*

echo.
pause

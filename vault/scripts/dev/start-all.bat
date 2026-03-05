@echo off
chcp 65001 > nul
echo 正在为你一键启动项目，请稍候...

:: 启动后端 (弹出一个新窗口)
start "后端服务 (Django)" cmd /k "cd /d d:\cursor\vault\backend && .\venv\Scripts\python.exe manage.py runserver"

:: 启动前端 (弹出一个新窗口)
start "前端服务 (Vite)" cmd /k "cd /d d:\cursor\vault\frontend && npm run dev"

:: 可选：启动 Context Governor（自动交接与续接）
start "协作守护器 (Context Governor)" powershell -NoExit -ExecutionPolicy Bypass -File "d:\cursor\vault\scripts\dev\context-governor.ps1"

exit

@echo off
REM Daily scheduled push to GitHub - for Windows Task Scheduler
REM Task Scheduler: Program = D:\cursor\vault\scripts\deploy\每日推送.bat
REM Trigger: Daily at 23:00

cd /d D:\cursor
powershell -ExecutionPolicy Bypass -File "D:\cursor\一键推送.ps1" "scheduled daily sync"

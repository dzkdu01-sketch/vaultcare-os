@echo off
setlocal

set MSG=%*

if "%MSG%"=="" (
  powershell -ExecutionPolicy Bypass -File "%~dp0一键推送.ps1"
) else (
  powershell -ExecutionPolicy Bypass -File "%~dp0一键推送.ps1" "%MSG%"
)

endlocal

@echo off
echo ========================================
echo Vaultcare OS - Generate Seed Data
echo ========================================
echo.
.\venv\Scripts\python.exe -c "exec(open('seed_data.py').read()); main()"
echo.
echo ========================================
echo Done!
echo ========================================
pause

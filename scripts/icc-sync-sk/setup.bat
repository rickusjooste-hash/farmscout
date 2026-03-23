@echo off
echo === ICC Sync Setup — Mouton's Valley ===
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found! Install Python 3.x and check "Add to PATH"
    pause
    exit /b 1
)

echo Python found:
python --version
echo.

echo Installing dependencies...
pip install xlrd requests
echo.

echo Testing sync...
python sync-icc.py
echo.

echo === Setup complete ===
echo.
echo To schedule daily at 06:00, run in Admin PowerShell:
echo.
echo   Register-ScheduledTask -TaskName 'ICCSyncSK' -Description 'ICC irrigation sync - Stawelklip' -Action (New-ScheduledTaskAction -Execute '%~dp0run-sync.bat' -WorkingDirectory '%~dp0') -Trigger (New-ScheduledTaskTrigger -Daily -At '06:00') -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd)
echo.
pause

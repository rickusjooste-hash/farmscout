@echo off
echo === Paltrack Sync Setup ===
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found! Install Python 3.x from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo Python found:
python --version

:: Install dependencies
echo.
echo Installing dependencies...
pip install pyodbc requests
if %errorlevel% neq 0 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

:: Test the sync
echo.
echo Testing sync...
python sync-paltrack.py

echo.
echo === Setup complete ===
echo.
echo To schedule daily at 18:00, run this in an Admin PowerShell:
echo.
echo   Register-ScheduledTask -TaskName 'PaltrackSync' -Description 'Daily Paltrack sync' -Action (New-ScheduledTaskAction -Execute '%~dp0run-sync.bat' -WorkingDirectory '%~dp0') -Trigger (New-ScheduledTaskTrigger -Daily -At '18:00') -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd)
echo.
pause

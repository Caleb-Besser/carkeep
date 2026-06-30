@echo off
setlocal

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%\scripts\open-expense-tracker.ps1" -AppDir "%APP_DIR%"

endlocal

@echo off
chcp 65001 >nul
title WorkBuddy Team Bus - Watcher

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo [!] python not found. Install: https://www.python.org/downloads/
    echo     Check "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo ========================================
echo  Team bus watcher started
echo  Polls every 30s for messages and tasks
echo  Inbox file: .workbuddy\memory\INBOX.md
echo  Board: https://allsoft.asia/team
echo.
echo  Close this window to stop
echo ========================================
echo.

set TEAM_INTERVAL=30
python -u watch.py

pause

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title WorkBuddy Team Bus - Setup

echo ========================================
echo  Connect this PC to the WorkBuddy team bus
echo  After setup, both PCs work at the same time
echo ========================================
echo.

REM 1. target dir
set "TARGET=%USERPROFILE%\Allsoft.asia"
if exist "D:\WB" set "TARGET=D:\WB\Allsoft.asia"
echo [1/5] Target dir: %TARGET%

REM 2. clone or pull
if exist "%TARGET%\.git" (
    echo [2/5] Exists, pulling latest...
    cd /d "%TARGET%"
    git pull --rebase --autostash origin main 2>>"%TARGET%\setup.log"
) else (
    echo [2/5] First clone...
    git clone https://github.com/ugo2000/allsoft.asia.git "%TARGET%" 2>>"%TARGET%\setup.log"
    cd /d "%TARGET%"
)

if errorlevel 1 (
    echo.
    echo [!] git failed. See setup.log for details.
    echo     Need git installed and network access.
    echo     Install git: https://git-scm.com/download/win
    notepad "%TARGET%\SETUP_GUIDE.md"
    pause
    exit /b 1
)

REM 3. git identity
echo [3/5] Setting git identity...
git config user.name "ugo2000"
git config user.email "ugo2000@users.noreply.github.com"
git config pull.rebase true

REM 4. device name
echo [4/5] Naming this PC...
set "DEVNAME="
for /f "tokens=*" %%i in ('hostname') do set "DEVNAME=%%i"
set "DEVNAME=%DEVNAME: =-%"
if not exist "%TARGET%\.workbuddy\memory" mkdir "%TARGET%\.workbuddy\memory"
if not exist "%TARGET%\.workbuddy\memory\devices" mkdir "%TARGET%\.workbuddy\memory\devices"
> "%TARGET%\.workbuddy\memory\DEVICE" echo !DEVNAME!
echo       Device name: !DEVNAME!

REM 5. go online
echo [5/5] Connecting to team bus...
where python >nul 2>nul
if errorlevel 1 (
    echo      python not found, using curl
    curl -s -X POST https://allsoft.asia/api/team -H "Content-Type: application/json" -d "{\"action\":\"heartbeat\",\"device\":\"!DEVNAME!\",\"label\":\"!DEVNAME!\",\"status\":\"online\"}" >nul
    curl -s -X POST https://allsoft.asia/api/team -H "Content-Type: application/json" -d "{\"action\":\"send\",\"device\":\"!DEVNAME!\",\"to\":\"all\",\"content\":\"I am online, assign me tasks\"}" >nul
) else (
    python team.py send "I am online, assign me tasks" --device !DEVNAME!
)

echo.
echo ========================================
echo  DONE. Now open THIS PC's WorkBuddy and say:
echo  "Read .workbuddy/memory/SYNC.md, join the team bus and start working"
echo.
echo  Watch both PCs: https://allsoft.asia/team
echo ========================================
echo.
echo  Opening Chinese guide...
notepad "%TARGET%\SETUP_GUIDE.md"
pause

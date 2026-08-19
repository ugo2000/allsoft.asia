@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 接入 WorkBuddy 协作总线

echo ========================================
echo   把这台电脑接入协作总线
echo   接完两台就能同时干活了
echo ========================================
echo.

REM ---- 1. 定目录 ----
set "TARGET=%USERPROFILE%\Allsoft.asia"
if exist "D:\WB" set "TARGET=D:\WB\Allsoft.asia"

echo [1/5] 项目目录: %TARGET%

REM ---- 2. 拉代码 ----
if exist "%TARGET%\.git" (
    echo [2/5] 已存在，拉取最新...
    cd /d "%TARGET%"
    git pull --rebase --autostash origin main
) else (
    echo [2/5] 首次克隆...
    git clone https://github.com/ugo2000/allsoft.asia.git "%TARGET%"
    cd /d "%TARGET%"
)

if errorlevel 1 (
    echo.
    echo [!] git 失败了。八成是没装 git 或者网络不通。
    echo     装 git: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM ---- 3. git 身份 ----
echo [3/5] 设置 git 身份...
git config user.name "ugo2000"
git config user.email "ugo2000@users.noreply.github.com"
git config pull.rebase true

REM ---- 4. 给本机起个名 ----
echo [4/5] 给这台电脑起名...
set "DEVNAME="
for /f "tokens=*" %%i in ('hostname') do set "DEVNAME=%%i"
set "DEVNAME=%DEVNAME: =-%"
if not exist "%TARGET%\.workbuddy\memory" mkdir "%TARGET%\.workbuddy\memory"
if not exist "%TARGET%\.workbuddy\memory\devices" mkdir "%TARGET%\.workbuddy\memory\devices"
> "%TARGET%\.workbuddy\memory\DEVICE" echo !DEVNAME!
echo      本机代号: !DEVNAME!

REM ---- 5. 上线打个招呼 ----
echo [5/5] 接入总线...
where python >nul 2>nul
if errorlevel 1 (
    echo      没找到 python，用 curl 上线
    curl -s -X POST https://allsoft.asia/api/team -H "Content-Type: application/json" -d "{\"action\":\"heartbeat\",\"device\":\"!DEVNAME!\",\"label\":\"!DEVNAME!\",\"status\":\"online\"}" >nul
    curl -s -X POST https://allsoft.asia/api/team -H "Content-Type: application/json" -d "{\"action\":\"send\",\"device\":\"!DEVNAME!\",\"to\":\"all\",\"content\":\"我上线了，可以派活\"}" >nul
) else (
    python team.py send "我上线了，可以派活" --device !DEVNAME!
    python team.py poll --device !DEVNAME!
)

echo.
echo ========================================
echo   接好了！
echo.
echo   现在跟这台电脑的 WorkBuddy 说：
echo   「读 .workbuddy/memory/SYNC.md，接入协作总线开始干活」
echo.
echo   随时看两台状态: https://allsoft.asia/team
echo ========================================
echo.
pause

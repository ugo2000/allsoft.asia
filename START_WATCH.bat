@echo off
chcp 65001 >nul
title 协作总线守护

REM 常驻轮询协作总线，把对面的消息/任务落地到 .workbuddy/memory/INBOX.md
REM 双击即可。关掉这个窗口就停止。

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo [!] 没找到 python。装一个: https://www.python.org/downloads/
    echo     安装时记得勾选 "Add Python to PATH"
    pause
    exit /b 1
)

echo ========================================
echo   协作总线守护已启动
echo   每 30 秒检查一次对面的消息和任务
echo   收件箱: .workbuddy\memory\INBOX.md
echo   看板:   https://allsoft.asia/team
echo.
echo   关掉这个窗口就停止
echo ========================================
echo.

set TEAM_INTERVAL=30
python -u watch.py

pause

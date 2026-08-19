@echo off
chcp 65001 >nul
echo ================================================
echo   Allsoft.asia 跨设备同步 - 一键配置
echo   把项目克隆到当前目录，并设好 git 身份
echo ================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 没找到 git。请先安装 Git：https://git-scm.com/downloads
  pause
  exit /b 1
)

if exist allsoft.asia (
  echo [提示] allsoft.asia 文件夹已存在，跳过克隆，直接更新身份配置。
  cd allsoft.asia
) else (
  echo [1/3] 正在克隆仓库...
  git clone https://github.com/ugo2000/allsoft.asia.git allsoft.asia
  if %errorlevel% neq 0 (
    echo [错误] 克隆失败，请检查网络后重试。
    pause
    exit /b 1
  )
  cd allsoft.asia
)

echo [2/3] 设置 git 身份...
git config user.name "ugo2000"
git config user.email "ugo2000@users.noreply.github.com"

echo [3/3] 完成！
echo.
echo 请用 WorkBuddy 打开这个文件夹即可开始协同：
echo   %cd%
echo.
echo WorkBuddy 会自动读取协作记忆（.workbuddy/memory/SYNC.md）
echo 注意：两台电脑不要同时开着 WorkBuddy 改同一份记忆。
echo.
pause

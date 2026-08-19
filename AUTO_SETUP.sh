#!/bin/bash
# Allsoft.asia 跨设备同步 - 一键配置（macOS / Linux）
set -e

echo "================================================"
echo "  Allsoft.asia 跨设备同步 - 一键配置"
echo "================================================"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "[错误] 没找到 git，请先安装 Git。"
  exit 1
fi

if [ -d "allsoft.asia" ]; then
  echo "[提示] allsoft.asia 文件夹已存在，跳过克隆。"
  cd allsoft.asia
else
  echo "[1/3] 正在克隆仓库..."
  git clone https://github.com/ugo2000/allsoft.asia.git allsoft.asia
  cd allsoft.asia
fi

echo "[2/3] 设置 git 身份..."
git config user.name "ugo2000"
git config user.email "ugo2000@users.noreply.github.com"

echo "[3/3] 完成！"
echo ""
echo "请用 WorkBuddy 打开这个文件夹即可开始协同："
echo "  $(pwd)"
echo ""
echo "WorkBuddy 会自动读取协作记忆（.workbuddy/memory/SYNC.md）"
echo "注意：两台电脑不要同时开着 WorkBuddy 改同一份记忆。"

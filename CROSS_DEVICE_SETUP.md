# 跨账号协作 · 另一台电脑安装说明

本文件说明如何让「另一台电脑（同一 GitHub 账号 ugo2000，同一人）」接入 allsoft.asia 项目的共享协作层。

## 原理

两台电脑（同一 GitHub 账号 ugo2000）通过 GitHub 仓库 `ugo2000/allsoft.asia` 协同：

- 仓库公开，**任何人都能 clone 读取**工作记忆（`.workbuddy/memory/`）
- 工作记忆已放开 git 追踪（`.gitignore` 里有 `!.workbuddy/memory/` 例外）
- 两个账号共用 `SYNC.md` 作为「共享大脑」，各自写自己段落，互不冲突
- **无需网盘、无需 VPN**，只靠 git

## 在另一台电脑上操作

### 1. 克隆仓库

```bash
git clone https://github.com/ugo2000/allsoft.asia.git
# 或用自己的账号 clone（若已被加为 Collaborator，可用 SSH）
```

### 2. 把克隆下来的目录设为 WorkBuddy 的工作区

在 WorkBuddy 里「打开文件夹」→ 选择 clone 下来的 `allsoft.asia` 目录。
WorkBuddy 会自动读取 `.workbuddy/memory/SYNC.md` 作为协作上下文。

### 3. 写回权限（已就绪，无需额外操作）

仓库 owner 就是 **ugo2000**。另一台电脑只要用**同一个 GitHub 账号 ugo2000** 登录并 clone，就既能读也能写（push），**不需要**任何 Collaborator 邀请。

> 若你误用了另一个 GitHub 账号登录，那才需要把那个账号加为 Collaborator（见 SYNC.md 待办）。建议另一台直接用 ugo2000 登录，最省事。

### 4. 日常使用约定

- **不要两台电脑的 WorkBuddy 同时开着**，会改同一份记忆导致冲突
- 切换电脑前，本机先提交并推送：
  ```bash
  git add -A && git commit -m "sync: <说明>" && git push
  ```
- 另一台开机先拉取：
  ```bash
  git pull
  ```
- 在 `SYNC.md` 的「账号 X」段落登记自己的角色 / GitHub / 最后活动时间
- 需要对方接手时，在「待办交接」表填好：做到哪、下一步是谁、卡点

## 注意

- **不要**把 `.workbuddy/` 下除 `memory/` 以外的目录同步出去（含二进制、app 数据、密钥）
- 身份文件（SOUL.md / USER.md 等）是各自账号独立的，**不共享**，避免覆盖对方身份
- 会话历史数据库（workbuddy.db）不同步，靠工作日志 + SYNC.md 续接上下文

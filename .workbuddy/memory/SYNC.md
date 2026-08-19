# 跨账号协作同步层（SYNC）

> 这是两个不同 WorkBuddy 账号之间的「共享大脑」。两个账号通过 GitHub 仓库 ugo2000/allsoft.asia 的 `.workbuddy/memory/` 目录共享此文件。
> 仓库为公开仓库，双方均可 clone 读取；写回需要被加为仓库 Collaborator（见 CROSS_DEVICE_SETUP.md）。
> 规则：**不要两台电脑同时运行 WorkBuddy**，切换前等 1-2 分钟让 git 同步完。

## 协作约定

- 各自只写自己名下的段落，互不涂改对方内容，避免 git 冲突
- 每次有重要进展，在各自段落追加一条带时间戳的记录
- 需要对方接手时，在「待办交接」区写明：做到哪、下一步是谁、卡点是什么
- 切换电脑前：`git add -A && git commit -m "sync: <说明>" && git push`；另一台开机先 `git pull`

## 账号清单

### 账号 U（本机 / 北京 / U哥）
- 角色：主账号，负责 allsoft.asia 主站建设、ChatHub 集成、M2M 魔鬼代言人项目
- 工作目录：D:\WB\Allsoft.asia
- GitHub：ugo2000
- 最后活动：2026-08-19

### 账号 X（另一台电脑 / 待登记）
- 角色：（待填写 —— 例如：负责内容创作 / 负责部署运维 / 负责某个子项目）
- 工作目录：（待填写）
- GitHub：（待填写）
- 最后活动：（待填写）

## 当前项目状态（2026-08-19）

- allsoft.asia 已上线（Cloudflare Pages + GitHub），域名 DNS + 证书全通
- 定位：一人软件工作室的自研软件集合站，ChatHub 是收录产品之一
- 数据看板：/admin 公开，含流量概览 + 实时访客记录（D1 数据库 allsoft_visitors）
- 已搭好 GitHub 同步层：memory/ 已放开 git 追踪，本文件即共享协作大脑

## 待办交接

| 事项 | 负责人 | 状态 | 说明 |
|------|--------|------|------|
| 登记账号 X 的 GitHub 与角色 | U哥 | 待办 | 告诉我另一台的 GitHub 用户名，我加为 Collaborator |
| 另一台 clone 仓库并设为 WorkBuddy 工作区 | 账号 X | 待办 | 按 CROSS_DEVICE_SETUP.md 操作 |
| （例）把某篇博客扩写成系列 | 账号 X | 待认领 | —— |

## 交接记录

### 2026-08-19 — U哥
- 建立 GitHub 同步层：放开 `.workbuddy/memory/` 的 git 忽略，建 SYNC.md 共享协作大脑
- 用户要求：不同账号协作 + 不用网盘 → 选 GitHub 作为共享同步层（仓库本就公开，零额外依赖）
- 下一步：等账号 X 登记，加协作权限后双向写回即可生效

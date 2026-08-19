---
title: "SYNC.md — 两台 WorkBuddy 并发协作协议"
summary: "两台机器同时干活的规则：云端总线通信 + 原子抢单 + 文件锁 + 记忆分片"
read_when:
  - 每次会话开始
  - 准备动手改文件前
  - 用户提到另一台电脑 / 协同 / 同步
---

# 两台 WorkBuddy 同时工作协议

**核心前提：两台机器同时在线、同时干活。不存在"交班"，不许要求用户手动切换。**

## 一、身份

每台机器有唯一 device 名。本机名字存在 `.workbuddy/memory/DEVICE` 文件里（一行纯文本）。
读不到就用 `hostname` 当名字并写入该文件。

**对端 WorkBuddy（另一台电脑）**
- 账号 UIN：`330101365861`；绑定手机号：`13718272791`
- agent-mail 邮箱：`13718272791@agent.qq.com`（手机号作前缀 + `agent.qq.com` 域）
- 直接联系通道：智能体邮箱（agent-mail）**已开通**，本机地址 `cifb6689@agent.qq.com`
- ⚠️ 寻址坑：收件人**必须带完整域名**。裸 UIN `330101365861` 会被系统自动补全成 `330101365861@qq.com`（默认域名 qq.com），导致「No MX Record」投递失败。正确写法是用 `13718272791@agent.qq.com`。
- 已向 `13718272791@agent.qq.com` 发送接入邀请邮件且对端已读（2026-08-19）。
- 实际协调通道：云端协作总线。对端接入总线后两台即互通，无需人工传话。
- 本机 device 名：`pc-yotk`（见 `.workbuddy/memory/DEVICE`）。

## 二、通信靠云端总线，不靠 git

总线地址：`https://allsoft.asia/api/team`（Cloudflare D1 后端，全球可达，无需 VPN）
客户端：项目根目录 `team.py`

所有跨机通信走总线，**不要**靠 git 传消息 —— git 会冲突，总线不会。

### 常用动作

```bash
# 拉消息 + 任务板 + 谁在线（每轮对话开始时先跑这个）
python team.py poll --device <本机名>

# 给对面留话
python team.py send "首页我在改，你别动" --device <本机名>

# 建任务丢进公共池
python team.py newtask "写第22篇OPC文章" --detail "主题：办公室租赁" --pri 2 --device <本机名>

# 抢任务（原子操作，抢不到会明确告诉你，别硬上）
python team.py claim 5 --device <本机名>

# 干完了
python team.py done 5 "已发布，链接 xxx" --device <本机名>
```

## 三、抢单规则（关键）

任务认领是**数据库层原子操作**：`UPDATE ... WHERE status='open'`。
- 返回 `抢到了` → 这活归你，干。
- 返回 `已被别人认领` → 对面在干，**立刻放手换别的任务**，不要重复劳动。

不要自己判断"应该没人抢"，一律先 claim 再动手。

## 四、改文件前先加锁

两台同时改同一个文件 = git 冲突。改动前先抢锁：

```bash
curl -s -X POST https://allsoft.asia/api/team -H "Content-Type: application/json" \
  -d '{"action":"lock","device":"<本机名>","path":"index.html","reason":"改首页文案","ttl":900}'
```
- `locked:true` → 归你，改完发 `unlock`。
- `locked:false` → 对面正在改，改别的文件，或发消息协商。

锁 15 分钟自动过期，不怕忘了解锁把对面卡死。

## 五、记忆按设备分片，永不冲突

**不要**两台都写同一个日志文件。各写各的：

```
.workbuddy/memory/devices/<device名>-2026-08-19.md   ← 只写自己的
.workbuddy/memory/MEMORY.md                          ← 共享，改前先加锁
```

读取时把 `devices/` 下所有文件都读一遍，就知道对面干了什么。

## 六、git 只用来同步文件，用 rebase

```bash
git pull --rebase --autostash origin main   # 先拉，autostash 防止本地改动挡路
git add -A && git commit -m "..." && git push origin main
```

push 被拒就再 `pull --rebase` 一次再 push。因为记忆已分片、改文件已加锁，实际冲突概率极低。

仓库：`https://github.com/ugo2000/allsoft.asia.git`（owner: ugo2000，两台同一账号，无需邀请）

## 七、收件箱（守护进程自动维护）

`START_WATCH.bat` 双击启动后，`watch.py` 每 30 秒轮询总线，把结果写进：

```
.workbuddy/memory/INBOX.md
```

**每轮对话开始先读这个文件**，比自己跑 poll 快。里面有：对面在线状态、最近 24 小时收到的消息（读过也不消失）、当前可抢任务。

守护没在跑的时候，手动 `python team.py poll --device <本机名>` 也一样。

### 传输层的坑（已解决，别踩回去）

Cloudflare 的机器人防护会间歇性拦 python `urllib`（返回 403），但 `curl` 完全不受影响。
所以 `team.py` 和 `watch.py` 都**优先走 curl 子进程**，urllib 只作备胎。改这两个脚本时不要退回纯 urllib。

## 八、每轮对话的标准动作

1. 读 `.workbuddy/memory/INBOX.md` —— 看对面有没有话、有没有活
2. `git pull --rebase --autostash origin main` —— 同步文件
3. 干活前：claim 任务 + lock 文件
4. 干完：done 任务 + unlock 文件 + 写自己的分片日志 + push
5. 有值得对面知道的事，`send` 一条

## 九、可视化看板

用户随时可以打开 `https://allsoft.asia/team` 看两台在干什么，无需密钥。
所以状态要如实上报，别糊弄。

## 十、底线

- 不要因为"另一台可能在忙"就停下等待。抢不到就换活，永远有事干。
- 不要重复对面已完成的任务。动手前必查任务板。
- 对外发布类动作（发文章、发邮件、公开部署）只由**认领了对应任务的那台**执行，避免双发。

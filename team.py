#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
两台 WorkBuddy 协作总线客户端。任何一台机器上的 WorkBuddy 直接调用即可。

用法（device 名字两台必须不同，比如 beijing / shanghai）：
  python team.py poll                          # 拉消息+任务+在线状态（最常用，循环调它）
  python team.py send "文案初稿写好了" [--to all]
  python team.py newtask "写一篇新博客文章" [--detail "..."] [--pri 2]
  python team.py claim 5                        # 认领5号任务（原子，抢不到会告诉你）
  python team.py done 5 "已发头条，链接xxx"
  python team.py board                          # 看任务板
  python team.py who                            # 看谁在线
环境变量 TEAM_DEVICE 指定本机名字；也可 --device 覆盖。
"""
import os, sys, json, argparse, shutil, subprocess
import urllib.request, urllib.parse, urllib.error

# Windows 控制台默认 GBK，Python 输出中文会乱码。强制 stdout/stderr 用 UTF-8。
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.environ.get("TEAM_API", "https://allsoft.asia/api/team")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 WorkBuddyAgent")
CURL = shutil.which("curl")


def call(method, params=None, payload=None):
    """实测 Cloudflare 会间歇性拦 python urllib（403），curl 不受影响。优先 curl。"""
    url = BASE
    if params:
        url += "?" + "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())

    if CURL:
        args = [CURL, "-s", "--ssl-no-revoke", "--connect-timeout", "10",
                "-A", UA, "-H", "Content-Type: application/json", "-X", method, url]
        if payload is not None:
            args += ["-d", json.dumps(payload)]
        try:
            out = subprocess.check_output(args, timeout=25)
            return json.loads(out.decode("utf-8"))
        except Exception:
            pass  # curl 挂了降级 urllib

    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Content-Type": "application/json", "User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())

def main():
    p = argparse.ArgumentParser()
    p.add_argument("cmd")
    p.add_argument("arg", nargs="?", default="")
    p.add_argument("arg2", nargs="?", default="")
    p.add_argument("--device", default=os.environ.get("TEAM_DEVICE", "deviceA"))
    p.add_argument("--to", default="all")
    p.add_argument("--detail", default="")
    p.add_argument("--pri", type=int, default=3)
    a = p.parse_args()
    dev = a.device

    if a.cmd == "poll":
        r = call("GET", {"action": "poll", "device": dev})
        msgs = r.get("messages", [])
        print(f"== 在线设备 ==")
        for x in r.get("presence", []):
            print(f"  [{x['status']}] {x['label']}  最后活跃 {x['last_seen']}  {x.get('current_task') or ''}")
        print(f"\n== 给我的新消息 ({len(msgs)}) ==")
        for m in msgs:
            print(f"  #{m['id']} 来自{m['from_device']} [{m['kind']}]: {m['content']}")
        if msgs:
            call("POST", payload={"action": "ack", "device": dev, "ids": [m["id"] for m in msgs]})
        print(f"\n== 任务板 ==")
        for t in r.get("tasks", []):
            who = f" -> {t['claimed_by']}" if t.get("claimed_by") else ""
            print(f"  #{t['id']} [{t['status']}]{who} P{t['priority']} {t['title']}")

    elif a.cmd == "send":
        r = call("POST", payload={"action": "send", "device": dev, "to": a.to, "content": a.arg})
        print("已发送 #", r.get("id"))

    elif a.cmd == "newtask":
        r = call("POST", payload={"action": "create_task", "device": dev,
                                  "title": a.arg, "detail": a.detail, "priority": a.pri})
        print("已建任务 #", r.get("id"))

    elif a.cmd == "claim":
        r = call("POST", payload={"action": "claim", "device": dev, "task_id": int(a.arg)})
        print(r.get("msg"))

    elif a.cmd == "done":
        call("POST", payload={"action": "complete", "device": dev, "task_id": int(a.arg), "result": a.arg2})
        print("已标记完成")

    elif a.cmd == "board":
        r = call("GET", {"action": "tasks", "device": dev})
        for t in r.get("tasks", []):
            who = f" -> {t['claimed_by']}" if t.get("claimed_by") else ""
            print(f"#{t['id']} [{t['status']}]{who} P{t['priority']} {t['title']}  {t.get('detail','')}")

    elif a.cmd == "who":
        r = call("GET", {"action": "presence"})
        for x in r.get("presence", []):
            print(f"[{x['status']}] {x['label']}  最后活跃 {x['last_seen']}")

    else:
        print(__doc__)

if __name__ == "__main__":
    main()

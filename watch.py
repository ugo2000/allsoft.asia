#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
协作总线守护进程：常驻后台，每 20 秒 poll 一次。
对面一有消息/新任务，立刻落地到 INBOX.md，本机 WorkBuddy 下一轮对话就能看到。

启动：python watch.py            （前台，Ctrl+C 停）
后台：pythonw watch.py           （Windows 无窗口）
"""
import os, sys, json, time, socket, shutil, subprocess
import urllib.request, urllib.parse, urllib.error
from datetime import datetime

# Windows 控制台默认 GBK，Python 输出中文会乱码。强制 stdout/stderr 用 UTF-8。
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
MEM = os.path.join(ROOT, ".workbuddy", "memory")
INBOX = os.path.join(MEM, "INBOX.md")
# 抓到的消息在本地留痕，避免 ack 后 INBOX 清空导致消息一闪而过
STATE = os.path.join(MEM, ".watch_state.json")
KEEP_HOURS = 24
API = os.environ.get("TEAM_API", "https://allsoft.asia/api/team")
INTERVAL = int(os.environ.get("TEAM_INTERVAL", "60"))
CURL = shutil.which("curl")
# 实测：Cloudflare 机器人防护会间歇性拦 python urllib（403），curl 完全不受影响。
# 所以有 curl 就默认走 curl，urllib 只作备胎。
USE_CURL = bool(CURL)


def device_name():
    f = os.path.join(MEM, "DEVICE")
    if os.path.exists(f):
        n = open(f, encoding="utf-8").read().strip()
        if n:
            return n
    n = socket.gethostname().replace(" ", "-").lower()
    os.makedirs(MEM, exist_ok=True)
    open(f, "w", encoding="utf-8").write(n + "\n")
    return n


UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 WorkBuddyAgent")


def _call_curl(method, url, payload):
    args = [CURL, "-s", "-A", UA, "-H", "Content-Type: application/json", "-X", method, url]
    if payload is not None:
        args += ["-d", json.dumps(payload)]
    out = subprocess.check_output(args, timeout=20)
    return json.loads(out.decode())


def _call_urllib(method, url, payload):
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Content-Type": "application/json", "User-Agent": UA, "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def call(method, params=None, payload=None):
    global USE_CURL
    url = API + ("?" + urllib.parse.urlencode(params) if params else "")
    if USE_CURL and CURL:
        return _call_curl(method, url, payload)
    try:
        return _call_urllib(method, url, payload)
    except urllib.error.HTTPError as e:
        # 被 Cloudflare 拦（403），永久切 curl 重试一次
        if e.code == 403 and CURL:
            USE_CURL = True
            return _call_curl(method, url, payload)
        raise


def load_state():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {"messages": []}


def save_state(st):
    try:
        json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    except Exception:
        pass


def merge_messages(st, new_msgs):
    """新消息并入本地留痕，按 id 去重，只保留最近 KEEP_HOURS 小时。"""
    seen = {m["id"] for m in st["messages"]}
    for m in new_msgs:
        if m["id"] not in seen:
            st["messages"].append(m)
    cutoff = time.time() - KEEP_HOURS * 3600
    kept = []
    for m in st["messages"]:
        try:
            ts = datetime.strptime(m["created_at"], "%Y-%m-%d %H:%M:%S").timestamp()
        except Exception:
            ts = time.time()
        if ts >= cutoff:
            kept.append(m)
    st["messages"] = sorted(kept, key=lambda x: x["id"])[-50:]
    return st


def write_inbox(dev, all_msgs, open_tasks, peers):
    lines = [f"# 协作收件箱 · {dev}",
             f"_更新于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}，由 watch.py 自动维护_",
             f"_消息保留最近 {KEEP_HOURS} 小时，读过也不会消失_", ""]
    if peers:
        lines.append("## 对面在线")
        for p in peers:
            lines.append(f"- **{p['label']}** [{p['status']}] 最后活跃 {p['last_seen']}"
                         + (f" · 正在做：{p['current_task']}" if p.get("current_task") else ""))
        lines.append("")
    if all_msgs:
        lines.append(f"## 收到的消息（{len(all_msgs)} 条）")
        for m in all_msgs[-20:]:
            lines.append(f"- `#{m['id']}` 来自 **{m['from_device']}**：{m['content']}  <sub>{m['created_at']}</sub>")
        lines.append("")
    if open_tasks:
        lines.append("## 可抢任务（先 claim 再动手）")
        for t in open_tasks:
            lines.append(f"- `#{t['id']}` P{t['priority']} **{t['title']}** {t.get('detail') or ''}")
        lines.append("")
    if not (all_msgs or open_tasks):
        lines.append("_当前无消息、无可抢任务。_")
    open(INBOX, "w", encoding="utf-8").write("\n".join(lines) + "\n")


def main():
    dev = device_name()
    ch = "curl" if USE_CURL else "urllib"
    print(f"[watch] device {dev} connected to {API} via {ch}, polling every {INTERVAL}s. Ctrl+C to stop.", flush=True)
    st = load_state()
    fails = 0
    while True:
        try:
            r = call("GET", {"action": "poll", "device": dev})
            msgs = r.get("messages", [])
            tasks = r.get("tasks", [])
            peers = [p for p in r.get("presence", []) if p["device"] != dev]
            open_tasks = [t for t in tasks if t["status"] == "open"]
            if msgs:
                st = merge_messages(st, msgs)
                save_state(st)
                for m in msgs:
                    print(f"[{datetime.now():%H:%M:%S}] recv from {m['from_device']} ({len(m['content'])} chars)", flush=True)
                call("POST", payload={"action": "ack", "device": dev,
                                      "ids": [m["id"] for m in msgs]})
            write_inbox(dev, st["messages"], open_tasks, peers)
            fails = 0
        except KeyboardInterrupt:
            print("\n[watch] stopped.")
            return
        except Exception as e:
            fails += 1
            print(f"[watch] failed {fails} times: {e}")
            if fails > 20:
                print("[watch] too many failures, exiting.")
                return
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()

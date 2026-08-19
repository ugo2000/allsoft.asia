// 多端 WorkBuddy 协作总线
// GET  /api/team?action=poll&device=X          拉取发给我的消息 + 开放任务 + 在线状态
// GET  /api/team?action=tasks&status=open       看任务板
// GET  /api/team?action=messages&device=X       看消息
// POST /api/team  { action, ... }               发消息 / 建任务 / 认领 / 完成 / 心跳 / 加锁 / 解锁

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const db = env.VISITORS_DB;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "poll";
  const device = url.searchParams.get("device") || "unknown";

  try {
    if (action === "poll") {
      // 心跳：顺手更新自己在线
      await db.prepare(
        `INSERT INTO agent_presence (device,label,status,last_seen)
         VALUES (?1,?1,'online',datetime('now'))
         ON CONFLICT(device) DO UPDATE SET status='online', last_seen=datetime('now')`
      ).bind(device).run();

      const msgs = await db.prepare(
        `SELECT * FROM agent_messages
         WHERE (to_device=?1 OR to_device='all') AND from_device<>?1 AND read_at IS NULL
         ORDER BY created_at ASC LIMIT 50`
      ).bind(device).all();

      const tasks = await db.prepare(
        `SELECT * FROM agent_tasks WHERE status IN ('open','claimed','doing')
         ORDER BY priority ASC, created_at ASC LIMIT 50`
      ).all();

      const presence = await db.prepare(
        `SELECT * FROM agent_presence ORDER BY last_seen DESC`
      ).all();

      return json({
        ok: true, now: new Date().toISOString(),
        messages: msgs.results || [],
        tasks: tasks.results || [],
        presence: presence.results || [],
      });
    }

    if (action === "tasks") {
      const status = url.searchParams.get("status");
      const q = status
        ? db.prepare(`SELECT * FROM agent_tasks WHERE status=?1 ORDER BY priority,created_at`).bind(status)
        : db.prepare(`SELECT * FROM agent_tasks ORDER BY priority,created_at`);
      const r = await q.all();
      return json({ ok: true, tasks: r.results || [] });
    }

    if (action === "messages") {
      const r = await db.prepare(
        `SELECT * FROM agent_messages
         WHERE to_device=?1 OR to_device='all' OR from_device=?1
         ORDER BY created_at DESC LIMIT 100`
      ).bind(device).all();
      return json({ ok: true, messages: r.results || [] });
    }

    if (action === "presence") {
      const r = await db.prepare(`SELECT * FROM agent_presence ORDER BY last_seen DESC`).all();
      return json({ ok: true, presence: r.results || [] });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const db = env.VISITORS_DB;
  let body = {};
  try { body = await request.json(); } catch {}
  const { action, device } = body;

  try {
    // 发消息
    if (action === "send") {
      const { to = "all", kind = "note", content = "", ref_task = null } = body;
      const r = await db.prepare(
        `INSERT INTO agent_messages (from_device,to_device,kind,content,ref_task)
         VALUES (?1,?2,?3,?4,?5)`
      ).bind(device, to, kind, content, ref_task).run();
      return json({ ok: true, id: r.meta.last_row_id });
    }

    // 标记消息已读
    if (action === "ack") {
      const { ids = [] } = body;
      if (ids.length) {
        const ph = ids.map((_, i) => `?${i + 1}`).join(",");
        await db.prepare(`UPDATE agent_messages SET read_at=datetime('now') WHERE id IN (${ph})`)
          .bind(...ids).run();
      }
      return json({ ok: true });
    }

    // 建任务
    if (action === "create_task") {
      const { title, detail = "", priority = 3 } = body;
      if (!title) return json({ ok: false, error: "title required" }, 400);
      const r = await db.prepare(
        `INSERT INTO agent_tasks (title,detail,priority,created_by) VALUES (?1,?2,?3,?4)`
      ).bind(title, detail, priority, device).run();
      return json({ ok: true, id: r.meta.last_row_id });
    }

    // 认领任务：原子操作，只有 status='open' 才能抢到
    if (action === "claim") {
      const { task_id } = body;
      const r = await db.prepare(
        `UPDATE agent_tasks SET status='doing', claimed_by=?1, claimed_at=datetime('now'), updated_at=datetime('now')
         WHERE id=?2 AND status='open'`
      ).bind(device, task_id).run();
      const got = r.meta.changes > 0;
      return json({ ok: true, claimed: got, msg: got ? "抢到了" : "已被别人认领或不存在" });
    }

    // 完成任务
    if (action === "complete") {
      const { task_id, result = "" } = body;
      await db.prepare(
        `UPDATE agent_tasks SET status='done', result=?1, done_at=datetime('now'), updated_at=datetime('now')
         WHERE id=?2`
      ).bind(result, task_id).run();
      return json({ ok: true });
    }

    // 释放任务回开放池
    if (action === "release") {
      const { task_id } = body;
      await db.prepare(
        `UPDATE agent_tasks SET status='open', claimed_by=NULL, updated_at=datetime('now') WHERE id=?1`
      ).bind(task_id).run();
      return json({ ok: true });
    }

    // 心跳 / 状态
    if (action === "heartbeat") {
      const { label = device, status = "online", current_task = null } = body;
      await db.prepare(
        `INSERT INTO agent_presence (device,label,status,current_task,last_seen)
         VALUES (?1,?2,?3,?4,datetime('now'))
         ON CONFLICT(device) DO UPDATE SET label=?2, status=?3, current_task=?4, last_seen=datetime('now')`
      ).bind(device, label, status, current_task).run();
      return json({ ok: true });
    }

    // 加文件锁：抢不到说明别人在改
    if (action === "lock") {
      const { path, reason = "", ttl = 600 } = body;
      // 先清过期锁
      await db.prepare(`DELETE FROM agent_locks WHERE expires_at < datetime('now')`).run();
      try {
        await db.prepare(
          `INSERT INTO agent_locks (path,device,reason,expires_at)
           VALUES (?1,?2,?3,datetime('now',?4))`
        ).bind(path, device, reason, `+${ttl} seconds`).run();
        return json({ ok: true, locked: true });
      } catch {
        const cur = await db.prepare(`SELECT * FROM agent_locks WHERE path=?1`).bind(path).first();
        return json({ ok: true, locked: false, held_by: cur ? cur.device : "?" });
      }
    }

    // 解锁
    if (action === "unlock") {
      const { path } = body;
      await db.prepare(`DELETE FROM agent_locks WHERE path=?1 AND device=?2`).bind(path, device).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

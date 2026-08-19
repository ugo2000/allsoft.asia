-- 多端 WorkBuddy 并发协作 schema
-- 设计原则：所有写入都是 INSERT 或带条件的原子 UPDATE，两端同时写也不会互相覆盖

-- 1. 消息总线：两端互发消息，纯 INSERT，永不冲突
CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_device TEXT NOT NULL,
  to_device   TEXT NOT NULL DEFAULT 'all',
  kind        TEXT NOT NULL DEFAULT 'note',
  content     TEXT NOT NULL,
  ref_task    INTEGER,
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_to   ON agent_messages(to_device, read_at);
CREATE INDEX IF NOT EXISTS idx_msg_time ON agent_messages(created_at DESC);

-- 2. 任务看板：认领靠 WHERE status='open' 的原子更新，抢不到就是抢不到
CREATE TABLE IF NOT EXISTS agent_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  priority    INTEGER NOT NULL DEFAULT 3,
  created_by  TEXT NOT NULL,
  claimed_by  TEXT,
  claimed_at  TEXT,
  done_at     TEXT,
  result      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_status ON agent_tasks(status, priority);

-- 3. 在线状态：每端一行，各自 UPSERT 自己那行，互不干扰
CREATE TABLE IF NOT EXISTS agent_presence (
  device       TEXT PRIMARY KEY,
  label        TEXT,
  status       TEXT NOT NULL DEFAULT 'idle',
  current_task TEXT,
  last_seen    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. 文件锁：谁在改哪个文件，避免两端同时改同一个文件打架
CREATE TABLE IF NOT EXISTS agent_locks (
  path       TEXT PRIMARY KEY,
  device     TEXT NOT NULL,
  reason     TEXT,
  locked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

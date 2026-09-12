-- Agnes AI Chat · Cloudflare D1 表结构
-- 部署时由 GitHub Actions 自动执行，也可手动：
--   npx wrangler d1 execute agnes-chat-db --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,          -- nanoid / uuid
  email         TEXT NOT NULL UNIQUE,      -- 登录邮箱（小写存储）
  password_hash TEXT NOT NULL,             -- bcrypt 哈希，绝不明文
  role          TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at    INTEGER NOT NULL           -- 毫秒时间戳
);

-- 登录时按邮箱反查 userId
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- 管理员页面按角色筛选
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- 自增计数器：users_count 用于原子判定「第一个注册用户 = 管理员」
-- 用 UPDATE ... RETURNING 保证并发下只有一个请求拿到 1
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- 聊天记录（存 D1）
--
-- 为什么不放 KV：KV 单值上限 25 MiB，且没有索引，要「列出某用户的所有会话」
-- 只能靠前缀列举再逐个读（N+1 次读，又慢又费额度）。
-- D1 可以按 user_id 建索引直接查，还能按时间排序、统计条数。
-- ---------------------------------------------------------------------------

-- 会话（每个用户多条）
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,        -- 会话 id（前端生成）
  user_id     TEXT NOT NULL,           -- 所属用户
  title       TEXT DEFAULT '',         -- 会话标题（取首条消息）
  model       TEXT DEFAULT '',         -- 使用的模型
  created_at  INTEGER NOT NULL,        -- 毫秒时间戳
  updated_at  INTEGER NOT NULL         -- 毫秒时间戳，用于排序
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC);

-- 消息（每条会话下的逐条消息，content 为 JSON 文本以兼容多模态片段）
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,       -- 'user' | 'assistant' | 'system'
  content         TEXT NOT NULL,       -- 纯文本 或 JSON 数组（图片等多模态片段）
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id);

-- 站点级配置（管理员在 /admin 面板设置，全站生效）
CREATE TABLE IF NOT EXISTS site_settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

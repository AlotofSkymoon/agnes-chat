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

import { Redis } from "@upstash/redis";

/**
 * Upstash Redis 客户端（惰性单例）。
 *
 * 注意：
 * 1. 本文件只允许在 Server Component / API Route / Server Action 中导入，
 *    绝对不能被 "use client" 的组件引用 —— 否则 TOKEN 会被打进浏览器包。
 * 2. 惰性创建，保证 `next build` 时即使环境变量缺失也不会直接崩。
 */

let client: Redis | null = null;

export function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "缺少 Upstash Redis 配置：请在 .env.local 中设置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN",
    );
  }

  client = new Redis({ url, token, automaticDeserialization: true });
  return client;
}

/* -------------------------------------------------------------------------- */
/*                                  Key 规范                                   */
/* -------------------------------------------------------------------------- */

export const KEYS = {
  usersCount: "users:count",
  user: (userId: string) => `user:${userId}`,
  userEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  session: (sessionId: string) => `session:${sessionId}`,
  /** 某用户当前所有 sessionId，便于删除用户 / 清空登录态 */
  userSessions: (userId: string) => `user:sessions:${userId}`,
  /** 云端聊天记录：chat:{userId}:{conversationId} */
  chat: (userId: string, conversationId: string) => `chat:${userId}:${conversationId}`,
  /** 某用户的会话索引（Set，存 conversationId） */
  chatIndex: (userId: string) => `chat:index:${userId}`,
  /** 登录限流 */
  loginRateLimit: (ip: string) => `ratelimit:login:${ip}`,
} as const;

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

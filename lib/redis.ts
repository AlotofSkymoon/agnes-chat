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
  /** 导航站自定义数据（管理员维护） */
  navData: "nav:data",
  /** 域名后缀缓存 */
  tlds: "tlds:list",
  /** 站点公告 */
  announcement: "site:announcement",
  /** 站点统计：累计对话数 */
  statMessages: "stat:messages",
} as const;

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

/**
 * hgetall 的宽松封装。
 * Upstash 的 hgetall<TData extends Record<string, unknown>> 要求 TData 带索引签名，
 * 而我们的 interface（如 UserRecord）没有，直接传泛型会编译报错。这里统一处理。
 */
export async function hgetAll<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.hgetall<Record<string, unknown>>(key);
  return (raw as unknown as T | null) ?? null;
}

/** get 的类型安全封装 */
export async function getValue<T = string>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.get<unknown>(key);
  return (raw as T | null) ?? null;
}

/** smembers 的类型安全封装（Upstash 的 smembers<TData extends unknown[]> 约束会导致 string 报错） */
export async function setMembers(key: string): Promise<string[]> {
  const redis = getRedis();
  const raw = await redis.smembers<unknown[]>(key);
  return ((raw ?? []) as unknown as string[]) ?? [];
}

/** keys 的类型安全封装 */
export async function listKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  const raw = await redis.keys(pattern);
  return ((raw ?? []) as unknown as string[]) ?? [];
}

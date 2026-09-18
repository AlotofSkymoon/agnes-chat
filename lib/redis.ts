/**
 * 兼容层：历史上这里直接连 Upstash Redis。
 *
 * 现在存储已抽象成 @/lib/storage，会根据部署平台自动选择后端：
 *   - Cloudflare Workers → KV + D1（无需 Redis）
 *   - Vercel / 本地      → Upstash Redis
 *
 * 本文件保留原导出名，让上层业务代码无需改动即可双平台工作。
 * 新代码请直接使用 @/lib/storage。
 */

import {
  backendKind,
  getCloudflareEnv,
  getStore,
  hasStore as hasStoreBackend,
} from "@/lib/storage";
import { detectPlatform } from "@/lib/platform";
import type { Store, UserRecord } from "@/lib/storage/types";

export const KEYS = {
  usersCount: "users:count",
  user: (userId: string) => `user:${userId}`,
  userEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  session: (sessionId: string) => `session:${sessionId}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,
  chat: (userId: string, conversationId: string) => `chat:${userId}:${conversationId}`,
  chatIndex: (userId: string) => `chat:index:${userId}`,
  loginRateLimit: (ip: string) => `ratelimit:login:${ip}`,
  ratelimitUpload: (ip: string) => `ratelimit:upload:${ip}`,
  navData: "nav:data",
  tlds: "tlds:list",
  announcement: "site:announcement",
  siteSettings: "site:settings",
  /** 用户个人设置（含自带 API Key，服务端加密后存储） */
  userSettings: (userId: string) => `user:${userId}:settings`,
  statMessages: "stat:messages",
} as const;

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

/** 是否配置了任意可用的存储后端 */
export function hasRedisConfig(): boolean {
  return hasStoreBackend();
}

/**
 * 存储不可用时的提示文案。
 *
 * Upstash 是跨平台统一存储（Vercel / Cloudflare Workers 都用它），
 * 所以两边主提示一致；只有在 Workers 上明确检测到 KV/D1 绑定、
 * 且完全没配 Upstash 时，才给出 KV/D1 的排查方向。
 */
export function storageErrorMessage(): string {
  const cfBindings = Boolean(getCloudflareEnv());
  if (!cfBindings) {
    return "服务端未配置 Upstash Redis，无法完成此操作。请检查环境变量 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN。";
  }
  return detectPlatform() === "cloudflare"
    ? "未检测到可用存储。请配置 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（推荐，可与 Vercel 部署共用数据）；或检查 wrangler.jsonc 里的 kv_namespaces 与 d1_databases，ID 需填真实值（不能留 __KV_ID__ / __D1_ID__ 占位符）。"
    : "服务端未配置 Upstash Redis，无法完成此操作。请检查环境变量 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN。";
}

/** 当前生效的后端名称，用于 /admin 展示与排障 */
export function storageBackend(): string {
  return backendKind();
}

/**
 * 获取存储实例。
 * 命名保留 getRedis 以兼容既有调用点，实际可能是 KV/D1 实现。
 */
export function getRedis(): Store {
  return getStore();
}

/** Hash 全量读取（封装泛型，避免各后端签名差异） */
export async function hgetAll<T>(key: string): Promise<T | null> {
  return getStore().hgetall<T>(key);
}

/** 读取字符串/JSON 值 */
export async function getValue<T = string>(key: string): Promise<T | null> {
  return getStore().get<T>(key);
}

/** 读取 Set 成员 */
export async function setMembers(key: string): Promise<string[]> {
  return getStore().smembers(key);
}

/** 按 pattern 列 key */
export async function listKeys(pattern: string): Promise<string[]> {
  return getStore().keys(pattern);
}

export { hasUpstashConfig } from "@/lib/storage";
export type { Store, UserRecord };

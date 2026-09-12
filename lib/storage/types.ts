/**
 * 统一存储接口（Redis 风格子集）。
 *
 * 为什么要抽象：
 * - 部署在 Vercel 时用 Upstash Redis（HTTP REST）
 * - 部署在 Cloudflare Workers 时用 KV + D1（无需 Redis，免费额度更大）
 * 上层业务代码只认这个接口，切换后端不用改调用点。
 */

export interface SetOptions {
  /** 过期秒数 */
  ex?: number;
}

export interface Pipeline {
  set(key: string, value: unknown, opts?: SetOptions): Pipeline;
  del(...keys: string[]): Pipeline;
  sadd(key: string, ...members: string[]): Pipeline;
  /** 从 Set 移除成员 */
  srem(key: string, ...members: string[]): Pipeline;
  hset(key: string, obj: Record<string, unknown>): Pipeline;
  exec(): Promise<unknown[]>;
}

export interface Store {
  /** 读取。KV 里存的是 JSON，会自动反序列化 */
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: SetOptions): Promise<void>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  /** 原子自增，返回自增后的值 */
  incr(key: string): Promise<number>;
  hset(key: string, obj: Record<string, unknown>): Promise<number>;
  hgetall<T = Record<string, unknown>>(key: string): Promise<T | null>;
  /** 支持 "prefix:*" 形式的通配 */
  keys(pattern: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  pipeline(): Pipeline;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: number | string;
}

/** 后端类型，用于日志与调试（不打印任何敏感值） */
export type BackendKind = "upstash" | "cloudflare" | "none";

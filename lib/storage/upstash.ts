import { Redis } from "@upstash/redis";

import type { Pipeline, SetOptions, Store } from "@/lib/storage/types";

/** Upstash Redis 后端（Vercel / 本地开发用） */
export class UpstashStore implements Store {
  constructor(private redis: Redis) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.redis.get<unknown>(key);
    return (raw as T) ?? null;
  }

  async set(key: string, value: unknown, opts?: SetOptions): Promise<void> {
    if (opts?.ex) {
      // 统一以 JSON 存储，保证跨后端行为一致
      await this.redis.set(key, JSON.stringify(value), { ex: opts.ex });
      return;
    }
    await this.redis.set(key, JSON.stringify(value));
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async hset(key: string, obj: Record<string, unknown>): Promise<number> {
    return this.redis.hset(key, obj);
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const raw = await this.redis.hgetall<Record<string, unknown>>(key);
    return (raw as unknown as T) ?? null;
  }

  async keys(pattern: string): Promise<string[]> {
    const raw = await this.redis.keys(pattern);
    return (raw as string[]) ?? [];
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.redis.sadd(key, ...(members as [string, ...string[]]));
  }

  async smembers(key: string): Promise<string[]> {
    const raw = await this.redis.smembers<unknown[]>(key);
    return ((raw ?? []) as unknown as string[]) ?? [];
  }

  pipeline(): Pipeline {
    const p = this.redis.pipeline();
    const pipe: Pipeline = {
      set(key: string, value: unknown, opts?: SetOptions) {
        if (opts?.ex) p.set(key, JSON.stringify(value), { ex: opts.ex });
        else p.set(key, JSON.stringify(value));
        return pipe;
      },
      del(...keys: string[]) {
        p.del(...keys);
        return pipe;
      },
      sadd(key: string, ...members: string[]) {
        if (members.length) p.sadd(key, ...(members as [string, ...string[]]));
        return pipe;
      },
      srem(key: string, ...members: string[]) {
        if (members.length) p.srem(key, ...(members as [string, ...string[]]));
        return pipe;
      },
      hset(key: string, obj: Record<string, unknown>) {
        p.hset(key, obj);
        return pipe;
      },
      async exec() {
        const res = await p.exec();
        return Array.isArray(res) ? res : [];
      },
    };
    return pipe;
  }
}

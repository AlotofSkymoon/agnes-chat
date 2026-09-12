import { Redis } from "@upstash/redis";

import { CloudflareStore, type CloudflareEnv } from "@/lib/storage/cloudflare";
import type { BackendKind, Store } from "@/lib/storage/types";
import { UpstashStore } from "@/lib/storage/upstash";

/**
 * 后端选择：
 * 1. 有 Cloudflare KV/D1 绑定 → 用 KV + D1（Cloudflare Workers 部署）
 * 2. 否则有 Upstash 配置 → 用 Redis（Vercel 部署 / 本地开发）
 * 3. 都没有 → 无存储（仍可聊天，只是不能注册登录）
 */

let cfEnvOverride: CloudflareEnv | null = null;
let upstashClient: Redis | null = null;
let storeSingleton: Store | null = null;

/** 供应用启动时显式注入（例如从 OpenNext 的 getCloudflareContext() 拿到 env） */
export function setCloudflareEnv(env: CloudflareEnv | null): void {
  cfEnvOverride = env;
  storeSingleton = null; // 让下次 getStore() 重新解析
}

/**
 * 从全局探测 Cloudflare bindings。
 * 不同运行时注入位置不同，这里按常见位置依次尝试，全部失败返回 null。
 */
export function probeCloudflareEnv(): CloudflareEnv | null {
  const g = globalThis as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    g.__env__,
    g.__cloudflare_env__,
    g.__cloudflareContext__,
    g.__cf_env__,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const candidate = c as Record<string, unknown>;
    // OpenNext 的 context 形如 { env: {...}, ctx, cf }
    const inner = (candidate.env ?? candidate) as Record<string, unknown>;
    if (inner && typeof inner === "object" && (inner.KV || inner.DB)) {
      return inner as CloudflareEnv;
    }
  }
  return null;
}

export function getCloudflareEnv(): CloudflareEnv | null {
  return cfEnvOverride ?? probeCloudflareEnv();
}

export function hasUpstashConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getUpstash(): Redis {
  if (upstashClient) return upstashClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("缺少 Upstash Redis 配置：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }
  upstashClient = new Redis({ url, token, automaticDeserialization: true });
  return upstashClient;
}

export function backendKind(): BackendKind {
  if (getCloudflareEnv()) return "cloudflare";
  if (hasUpstashConfig()) return "upstash";
  return "none";
}

/** 获取存储实例（惰性单例） */
export function getStore(): Store {
  if (storeSingleton) return storeSingleton;

  const cf = getCloudflareEnv();
  if (cf && (cf.KV || cf.DB)) {
    storeSingleton = new CloudflareStore(cf);
    return storeSingleton;
  }

  if (hasUpstashConfig()) {
    storeSingleton = new UpstashStore(getUpstash());
    return storeSingleton;
  }

  throw new Error(
    "未配置任何存储后端：Cloudflare 部署请绑定 KV + D1；Vercel 部署请设置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN",
  );
}

export function hasStore(): boolean {
  return backendKind() !== "none";
}

export type { Store, UserRecord, Pipeline, SetOptions, BackendKind } from "@/lib/storage/types";

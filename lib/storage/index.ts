import { Redis } from "@upstash/redis";

import { CloudflareStore, type CloudflareEnv } from "@/lib/storage/cloudflare";
import type { BackendKind, Store } from "@/lib/storage/types";
import { UpstashStore } from "@/lib/storage/upstash";

/**
 * 后端选择：按**部署平台**各用各的原生存储，不强行统一。
 *
 * 1. Cloudflare Workers（检测到 KV / D1 binding）→ **KV + D1 三件套**
 *    - D1：用户账号 + 聊天记录（关系型，可索引、可聚合查询）
 *    - KV ：登录态 session、限流计数、缓存（纯 KV 场景，读极快）
 *    - R2 ：图片 / 视频等文件
 * 2. Vercel / 本地 → Upstash Redis
 * 3. 都没有 → 无存储（仍可聊天，只是不能注册登录）
 *
 * 为什么不再强行统一到 Upstash：
 * Cloudflare 上走 Upstash 等于让边缘请求跨洋回源到一个外部 Redis，
 * 既多一跳延迟，又凭空多一个外部依赖和故障点。Workers 原生三件套
 * 就在同一个区域里，免费额度也更大（D1 每天 500 万次读、KV 每天 10 万次读）。
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
/** 判断某个对象是否像 Cloudflare bindings（含 KV 或 D1） */
function looksLikeBindings(value: unknown): CloudflareEnv | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  // OpenNext 的 context 形如 { env: {...}, ctx, cf }，先剥一层
  const inner = (obj.env ?? obj) as Record<string, unknown>;
  if (!inner || typeof inner !== "object") return null;
  if (inner.KV || inner.DB) return inner as unknown as CloudflareEnv;
  return null;
}

export function probeCloudflareEnv(): CloudflareEnv | null {
  const g = globalThis as unknown as Record<string, unknown>;

  // 1) 先试已知命名（OpenNext 各版本注入位置不统一）
  const known: unknown[] = [
    g.__env__,
    g.__cloudflare_env__,
    g.__cloudflareContext__,
    g.__cf_env__,
    g.__NEXT_DATA__,
  ];
  for (const c of known) {
    const hit = looksLikeBindings(c);
    if (hit) return hit;
  }

  // 2) 兜底：扫 globalThis 上所有属性，找含 KV / DB 的对象。
  //    不同版本 OpenNext / workerd 注入的全局名可能变化，
  //    与其猜名字，不如按"是否含我们要的 binding"来认。
  //    只扫一层、跳过常见巨型对象，开销可忽略。
  try {
    for (const key of Object.getOwnPropertyNames(g)) {
      if (key === "globalThis" || key === "global" || key === "window" || key === "self") continue;
      let value: unknown;
      try {
        value = (g as Record<string, unknown>)[key];
      } catch {
        continue; // 某些 getter 会抛
      }
      const hit = looksLikeBindings(value);
      if (hit) return hit;
    }
  } catch {
    /* 忽略 */
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

/**
 * 统一后端开关。
 *
 * 之前是"各平台用各平台的原生存储"，结果同一个账号在
 * Vercel 站和 Cloudflare 站是两套互不相通的数据 —— 换个域名就丢了聊天记录。
 *
 * 设 STORAGE_BACKEND=unified 后，**所有平台都连同一个 Upstash**，
 * 账号 / 聊天记录 / 站点配置天然共享，不需要自己做双写同步
 * （双写要处理冲突、重试、乱序，是这类需求里最容易埋雷的做法）。
 *
 * 代价：Cloudflare 上要跨网络回源到 Upstash，比原生 KV 略慢。
 * 如果你只部署一个平台，用 auto 就好。
 *
 * 取值：
 *   auto     —— 默认，平台原生优先（Cloudflare 用 KV+D1，其余用 Upstash）
 *   unified  —— 全平台统一走 Upstash（多平台共用数据，推荐）
 *   cloudflare —— 强制 KV + D1
 *   upstash  —— 强制 Upstash
 */
export type StorageBackendMode = "auto" | "unified" | "cloudflare" | "upstash";

export function storageMode(): StorageBackendMode {
  const raw = (process.env.STORAGE_BACKEND ?? "auto").trim().toLowerCase();
  if (raw === "unified" || raw === "shared") return "unified";
  if (raw === "cloudflare" || raw === "cf") return "cloudflare";
  if (raw === "upstash") return "upstash";
  return "auto";
}

export function backendKind(): BackendKind {
  const mode = storageMode();

  // 统一模式：无视平台，一律 Upstash（这才是"多平台同步"的关键）
  if (mode === "unified") return hasUpstashConfig() ? "upstash" : "none";
  if (mode === "upstash") return hasUpstashConfig() ? "upstash" : "none";

  if (mode === "cloudflare") {
    const cfOnly = getCloudflareEnv();
    return cfOnly && (cfOnly.KV || cfOnly.DB) ? "cloudflare" : "none";
  }

  // auto：Cloudflare Workers 优先用平台原生的 KV + D1
  const cf = getCloudflareEnv();
  if (cf && (cf.KV || cf.DB)) return "cloudflare";
  if (hasUpstashConfig()) return "upstash";
  return "none";
}

/** 获取存储实例（惰性单例） */
export function getStore(): Store {
  if (storeSingleton) return storeSingleton;

  const mode = storageMode();

  // 统一 / 强制 Upstash：所有平台共用同一份数据
  if (mode === "unified" || mode === "upstash") {
    if (hasUpstashConfig()) {
      storeSingleton = new UpstashStore(getUpstash());
      return storeSingleton;
    }
    // 配了 unified 却没填 Upstash → 直接抛错，比悄悄退回本地存储好排查
    throw new Error(
      "STORAGE_BACKEND=unified 需要配置 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN",
    );
  }

  // 1) Cloudflare Workers → KV + D1
  const cf = getCloudflareEnv();
  if (cf && (cf.KV || cf.DB)) {
    storeSingleton = new CloudflareStore(cf);
    return storeSingleton;
  }

  // 2) Vercel / 本地 → Upstash Redis
  if (hasUpstashConfig()) {
    storeSingleton = new UpstashStore(getUpstash());
    return storeSingleton;
  }

  throw new Error(
    "未配置任何存储后端：Cloudflare Workers 请绑定 KV + D1（见 wrangler.jsonc）；Vercel 请设置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN",
  );
}

export function hasStore(): boolean {
  return backendKind() !== "none";
}

export type { Store, UserRecord, Pipeline, SetOptions, BackendKind } from "@/lib/storage/types";

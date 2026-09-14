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
import { hasBinding, pickBinding, scanBindingsSync } from "./binding";
import { configSource, configValue } from "@/lib/runtime-config";

export { pickBinding, hasBinding };

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
  /**
   * binding 名**大小写不敏感**。
   *
   * 原因：在 Cloudflare 后台手动绑定时，不同教程写的名字不一样 ——
   * 我们的文档写 KV / DB / R2，而 cloud-mail 那类项目用的是小写 kv / db / r2。
   * 用户照着任一教程填都可能，写死大写会导致"明明绑了却检测不到"。
   */
  if (pickBinding(inner, "kv") || pickBinding(inner, "db") || pickBinding(inner, "r2")) {
    return inner as unknown as CloudflareEnv;
  }
  return null;
}

export function probeCloudflareEnv(): CloudflareEnv | null {
  /**
   * 优先用 binding.ts 的统一扫描。
   *
   * 它比下面的字符串名兜底多一层关键能力：读
   * globalThis[Symbol.for("__cloudflare-context__")] ——
   * OpenNext 1.x 正是存在这个 **Symbol 键**上，而 Object.keys 枚举不到，
   * 少了这一步就会把 Workers 环境误判成"没有 binding"。
   */
  const unified = scanBindingsSync();
  if (unified) return unified as unknown as CloudflareEnv;

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

  // 2) 兜底：扫 globalThis 上所有属性，找含 KV / DB / R2 的对象。
  //    不同版本 OpenNext / workerd 注入的全局名可能变化，
  //    与其猜名字，不如按"是否含我们要的 binding"来认。
  try {
    for (const key of Object.getOwnPropertyNames(g)) {
      if (key === "globalThis" || key === "global" || key === "window" || key === "self") continue;
      let value: unknown;
      try {
        value = g[key];
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

/**
 * 是否已绑定 R2 桶。
 * 绑定了就**不需要任何 Access Key / Secret Key** ——
 * 桶是站长自己的，Worker 通过 binding 天然拥有读写权。
 */
export function hasR2Binding(): boolean {
  const env = getCloudflareEnv();
  return hasBinding(env as unknown as Record<string, unknown> | null, "r2");
}

/**
 * 是否已配置 Upstash。
 *
 * ⚠️ 必须走 runtime-config 而不是直接读 process.env ——
 * 在 Workers 上 secret 是 binding，process.env 读不到。
 * 读不到的后果是：Cloudflare 退回 KV+D1、Vercel 用 Upstash，
 * 两边明明配了同一个库却数据不通（聊天记录不互通）。
 */
export function upstashUrl(): string {
  return configValue("UPSTASH_REDIS_REST_URL", "UPSTASH_REST_URL");
}

export function upstashToken(): string {
  return configValue("UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REST_TOKEN", "UPSTASH_TOKEN");
}

export function hasUpstashConfig(): boolean {
  return Boolean(upstashUrl() && upstashToken());
}

/**
 * Upstash 配置来源（排查用）。
 * 返回 from = "process.env"（Vercel / 构建期内联）或 "cf-binding"（Workers 后台机密）。
 * 两边都查不到就是 null —— 那意味着这个平台根本没拿到 Upstash 配置。
 */
export function upstashSource(): { from: string; key: string } | null {
  const url = configSource("UPSTASH_REDIS_REST_URL", "UPSTASH_REST_URL");
  if (url) return { from: url.from, key: url.key };
  const token = configSource(
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REST_TOKEN",
    "UPSTASH_TOKEN",
  );
  return token ? { from: token.from, key: token.key } : null;
}

export function getUpstash(): Redis {
  if (upstashClient) return upstashClient;
  const url = upstashUrl();
  const token = upstashToken();
  if (!url || !token) {
    throw new Error("缺少 Upstash Redis 配置：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }
  upstashClient = new Redis({ url, token, automaticDeserialization: true });
  return upstashClient;
}

/**
 * 存储后端选择。
 *
 * ⚠️ 默认就是**统一 Upstash**：只要配了 Upstash，无论部署在
 * Vercel / Netlify / Cloudflare，都连同一个库，账号、聊天记录、站点配置全部互通。
 *
 * 这是用户的硬性要求 —— 早期版本是"各平台用各平台原生存储"，
 * 结果同一个账号在 Vercel 站和 Cloudflare 站是两套数据，换个域名记录就没了。
 *
 * 为什么统一后端而不是双写同步：双写要处理冲突、重试、乱序到达、部分失败，
 * 是这类需求里最容易埋雷的做法。统一后端所有平台读写同一份数据，天然一致。
 *
 * 取值：
 *   auto（默认）—— **有 Upstash 就用 Upstash（统一）**；没配才退回平台原生
 *   unified     —— 强制 Upstash，缺配置直接报错（不会静默退回）
 *   cloudflare  —— 强制 KV + D1（单平台部署、不想跨网络回源时用）
 *   upstash     —— 强制 Upstash，同 unified 但不校验
 */
export type StorageBackendMode = "auto" | "unified" | "cloudflare" | "upstash";

export function storageMode(): StorageBackendMode {
  const raw = configValue("STORAGE_BACKEND").trim().toLowerCase() || "auto";
  if (raw === "unified" || raw === "shared") return "unified";
  if (raw === "cloudflare" || raw === "cf") return "cloudflare";
  if (raw === "upstash") return "upstash";
  return "auto";
}

export function backendKind(): BackendKind {
  const mode = storageMode();

  // 统一 / 强制 Upstash：无视平台，一律同一个库
  if (mode === "unified") return hasUpstashConfig() ? "upstash" : "none";
  if (mode === "upstash") return hasUpstashConfig() ? "upstash" : "none";

  if (mode === "cloudflare") {
    const cfOnly = getCloudflareEnv();
    return cfOnly && (pickBinding(cfOnly as unknown as Record<string, unknown>, "kv") ||
      pickBinding(cfOnly as unknown as Record<string, unknown>, "db"))
      ? "cloudflare"
      : "none";
  }

  // auto（默认）：**Upstash 优先** —— 配了就全平台共用，保证数据互通
  if (hasUpstashConfig()) return "upstash";

  // 没配 Upstash 才用 Cloudflare 原生的 KV + D1
  const cf = getCloudflareEnv();
  if (
    cf &&
    (pickBinding(cf as unknown as Record<string, unknown>, "kv") ||
      pickBinding(cf as unknown as Record<string, unknown>, "db"))
  ) return "cloudflare";
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

  // auto 模式：Upstash 优先（默认就跨平台统一）
  if (mode === "auto" && hasUpstashConfig()) {
    storeSingleton = new UpstashStore(getUpstash());
    return storeSingleton;
  }

  // Cloudflare Workers → KV + D1（仅在没有 Upstash 时）
  const cf = getCloudflareEnv();
  if (
    cf &&
    (pickBinding(cf as unknown as Record<string, unknown>, "kv") ||
      pickBinding(cf as unknown as Record<string, unknown>, "db"))
  ) {
    storeSingleton = new CloudflareStore(cf);
    return storeSingleton;
  }

  // 兜底 → Upstash Redis
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

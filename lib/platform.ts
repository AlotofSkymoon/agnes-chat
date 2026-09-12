/**
 * 部署平台检测。
 *
 * 用于决定：对象存储可选范围、是否启用 Workers 专属能力等。
 * 判定顺序：Cloudflare bindings → Cloudflare 环境变量 → Vercel → 本地
 */

export type Platform = "cloudflare" | "vercel" | "local";

export function detectPlatform(): Platform {
  // 1) 有 KV / D1 / R2 binding，一定是 Cloudflare
  try {
    // 延迟 require，避免客户端打包时拉入服务端模块
    const g = globalThis as unknown as Record<string, unknown>;
    const candidates: unknown[] = [
      g.__env__,
      g.__cloudflare_env__,
      (g.__cloudflareContext__ as Record<string, unknown> | undefined)?.env,
    ];
    for (const c of candidates) {
      if (c && typeof c === "object") {
        const env = c as Record<string, unknown>;
        if (env.KV || env.DB || env.R2) return "cloudflare";
      }
    }
  } catch {
    /* 忽略 */
  }

  // 2) Cloudflare 注入的环境变量
  if (process.env.CF_ACCOUNT_ID || process.env.CF_PAGES || process.env.WORKERS_CI) {
    return "cloudflare";
  }

  // 3) Vercel
  if (process.env.VERCEL || process.env.VERCEL_ENV) return "vercel";

  return "local";
}

/** 该平台允许的对象存储 preset id 列表 */
export function allowedStoragePresets(platform: Platform): string[] | "all" {
  if (platform === "cloudflare") return ["r2"];
  if (platform === "vercel") return ["b2"];
  return "all"; // 本地开发不过滤，方便测试
}

export function platformLabel(platform: Platform): string {
  if (platform === "cloudflare") return "Cloudflare Workers";
  if (platform === "vercel") return "Vercel";
  return "本地 / 其他";
}

/**
 * 部署平台检测。
 *
 * 用于决定：对象存储可选范围、是否启用 Workers 专属能力等。
 * 判定顺序：Cloudflare bindings → Cloudflare 环境变量 → Vercel → 本地
 */

import { pickBinding } from "@/lib/storage/binding";

export type Platform = "cloudflare" | "vercel" | "local";

export function detectPlatform(): Platform {
  /**
   * ⚠️ 判定顺序很重要：**先认 Vercel，再认 Cloudflare**。
   *
   * 反过来会踩坑：Vercel 上部署的站点如果要用 R2 存图片，
   * 也会配 CLOUDFLARE_ACCOUNT_ID / R2_BUCKET_NAME 这类变量。
   * 先判 Cloudflare 就会把 Vercel 站误判成 Workers，
   * 进而把「只能用 R2」的限制套到本可以选 B2 的站点上。
   */

  // 1) Vercel 独有环境变量（最可靠，先判）
  if (process.env.VERCEL || process.env.VERCEL_ENV) return "vercel";

  // 2) 部署时显式声明（Actions 脚本 / dashboard 配置写入，100% 可靠）
  const declared = (process.env.CF_PLATFORM ?? "").trim().toLowerCase();
  if (declared === "cloudflare" || declared === "workers") return "cloudflare";

  // 3) 有 KV / D1 / R2 binding 对象
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
        if (pickBinding(env, "kv") || pickBinding(env, "db") || pickBinding(env, "r2"))
          return "cloudflare";
      }
    }
  } catch {
    /* 忽略 */
  }

  // 4) Cloudflare Pages / CI 注入的变量
  if (process.env.CF_ACCOUNT_ID || process.env.CF_PAGES || process.env.WORKERS_CI) {
    return "cloudflare";
  }

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

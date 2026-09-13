import { NextResponse } from "next/server";

import { detectPlatform, platformLabel } from "@/lib/platform";
import { getSiteS3Info } from "@/lib/s3-server";
import { backendKind, hasUpstashConfig } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health —— 部署自检。
 *
 * 只返回"是否连上"这类状态，绝不下发任何密钥、邮箱、session。
 * 部署完打不开 / 注册不了时，先看这个接口定位问题。
 */
export async function GET() {
  const platform = detectPlatform();
  const backend = backendKind();

  // 试着真正读写一次，确认不只是"配置了"而是"能连上"
  let storeOk = false;
  let storeError = "";
  /**
   * 跨库指纹：写个随机值再读回，用来验证两个平台的部署
   * 是否真的指向**同一个**存储。
   *
   * 判据很简单：Vercel 站和 Cloudflare 站各访问一次 /api/health，
   * 两边的 `storageFingerprint` 相同 → 同一份数据，账号和聊天记录互通；
   * 不同 → 各存各的，换个域名记录就没了。
   */
  let storageFingerprint: string | null = null;
  try {
    if (backend !== "none") {
      const { getStore } = await import("@/lib/storage");
      const store = getStore();
      await store.get("__healthcheck__");

      const existing = await store.get<string>("__sync_probe__");
      if (existing) {
        storageFingerprint = existing;
      } else {
        // 首次访问时种下一个随机串；同库的其他平台会直接读到它
        const fresh = Math.random().toString(36).slice(2, 12);
        await store.set("__sync_probe__", fresh);
        storageFingerprint = fresh;
      }
      storeOk = true;
    }
  } catch (err) {
    storeError = err instanceof Error ? err.message : String(err);
  }

  const s3 = getSiteS3Info();

  const problems: string[] = [];
  if (backend === "none") {
    problems.push(
      platform === "cloudflare"
        ? "未检测到可用存储：推荐设置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN（可与 Vercel 部署共用同一份账号数据）；或检查 wrangler.jsonc 里的 kv_namespaces 与 d1_databases，以及 Actions 的 KV_NAMESPACE_ID / D1_DATABASE_ID 是否正确"
        : "未配置存储：Vercel 需设置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN",
    );
  }
  if (backend !== "none" && !storeOk) problems.push(`存储读写失败：${storeError}`);
  if (!process.env.PRESET_AGNES_API_KEY?.trim()) {
    problems.push("未设置 PRESET_AGNES_API_KEY：未填自己 Key 的访客将无法聊天");
  }
  if (!process.env.SESSION_SECRET?.trim()) {
    problems.push("未设置 SESSION_SECRET：当前使用不安全的默认值");
  }

  return NextResponse.json({
    ok: problems.length === 0,
    platform,
    platformLabel: platformLabel(platform),
    storage: {
      backend,
      reachable: storeOk,
      error: storeError || null,
      upstashConfigured: hasUpstashConfig(),
      // 用 Upstash 时，Vercel 与 Cloudflare 部署指向同一个库即可共用账号数据
      sharedAcrossPlatforms: backend === "upstash",
      /**
       * 两个平台各访问一次本接口，比对这个值：
       * 相同 → 同一份数据（账号、聊天记录、站点配置互通）
       * 不同 → 各存各的
       */
      storageFingerprint,
      // 聊天记录 key 不含平台标识，因此同库即跨端可见
      chatKeyPattern: "chat:{userId}:{conversationId}",
    },
    objectStorage: {
      kind: s3.kind,
      siteManaged: s3.siteManaged,
      bucket: s3.bucket || null,
    },
    env: {
      presetKey: Boolean(process.env.PRESET_AGNES_API_KEY?.trim()),
      sessionSecret: Boolean(process.env.SESSION_SECRET?.trim()),
    },
    problems,
  });
}

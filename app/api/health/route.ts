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

  // 试着真正读一次，确认不只是"配置了"而是"能连上"
  let storeOk = false;
  let storeError = "";
  try {
    if (backend !== "none") {
      const { getStore } = await import("@/lib/storage");
      await getStore().get("__healthcheck__");
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

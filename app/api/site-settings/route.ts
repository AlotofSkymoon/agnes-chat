import { NextResponse } from "next/server";

import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/types";
import { getValue, hasRedisConfig, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/site-settings —— 公开读取站点级配置。
 *
 * 只返回非敏感字段（Base URL / 默认模型 / 云端保存默认开关），
 * 不含任何密钥。未配置存储时回落默认值，站点照常可用。
 */
export async function GET() {
  if (!hasRedisConfig()) {
    return NextResponse.json({ settings: DEFAULT_SITE_SETTINGS });
  }

  try {
    const raw = await getValue<Partial<SiteSettings>>(KEYS.siteSettings);
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      ...(raw ?? {}),
    };
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: DEFAULT_SITE_SETTINGS });
  }
}

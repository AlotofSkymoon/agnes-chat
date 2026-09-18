import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getRedis, getValue, hasRedisConfig, KEYS, storageErrorMessage } from "@/lib/redis";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET：管理员读取当前站点配置 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });

  if (!hasRedisConfig()) {
    return NextResponse.json({ settings: DEFAULT_SITE_SETTINGS, storage: false });
  }

  const raw = await getValue<Partial<SiteSettings>>(KEYS.siteSettings);
  return NextResponse.json({
    settings: { ...DEFAULT_SITE_SETTINGS, ...(raw ?? {}) },
    storage: true,
  });
}

/** POST：管理员更新站点配置（全站生效） */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });

  if (!hasRedisConfig()) {
    return NextResponse.json({ error: storageErrorMessage() }, { status: 500 });
  }

  let body: Partial<SiteSettings>;
  try {
    body = (await request.json()) as Partial<SiteSettings>;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const current = (await getValue<Partial<SiteSettings>>(KEYS.siteSettings)) ?? {};
  const next: SiteSettings = {
    defaultBaseUrl: String(body.defaultBaseUrl ?? current.defaultBaseUrl ?? "").trim(),
    defaultModel: String(body.defaultModel ?? current.defaultModel ?? "").trim(),
    cloudSaveDefault:
      typeof body.cloudSaveDefault === "boolean"
        ? body.cloudSaveDefault
        : Boolean(current.cloudSaveDefault),
    /* 页脚 / 备案：管理员在面板里填 */
    icpText: String(body.icpText ?? current.icpText ?? "").trim(),
    icpUrl: String(body.icpUrl ?? current.icpUrl ?? "").trim(),
    icpIconUrl: String(body.icpIconUrl ?? current.icpIconUrl ?? "").trim(),
    footerExtra: String(body.footerExtra ?? current.footerExtra ?? "").trim().slice(0, 300),
  };

  // Base URL 做基本校验，避免管理员手滑写坏全站
  if (next.defaultBaseUrl && !/^https?:\/\//i.test(next.defaultBaseUrl)) {
    return NextResponse.json({ error: "Base URL 必须以 http:// 或 https:// 开头" }, { status: 400 });
  }

  await getRedis().set(KEYS.siteSettings, JSON.stringify(next));
  return NextResponse.json({ ok: true, settings: next });
}

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { hasRedisConfig, storageErrorMessage } from "@/lib/redis";
import { readSiteSettings, writeSiteSettings } from "@/lib/site-settings-store";
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

  return NextResponse.json({
    settings: await readSiteSettings(),
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

  const current = await readSiteSettings();
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

  await writeSiteSettings(next);

  /**
   * 写回后立即读一次并一起返回。
   *
   * 之前这里直接返回内存里的 next，所以"看起来保存成功"，
   * 实际根本没写进去（或读回来是默认值）也无法发现。
   * 现在前端可以把回读值直接填进表单，存没存进去一眼能看出来。
   */
  const saved = await readSiteSettings();
  return NextResponse.json({ ok: true, settings: saved, verified: saved.cloudSaveDefault === next.cloudSaveDefault });
}

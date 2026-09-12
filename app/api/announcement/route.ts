import { NextResponse } from "next/server";

import { getRedis, hasRedisConfig,
  storageErrorMessage, KEYS, getValue } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface Announcement {
  text: string;
  enabled: boolean;
  updatedAt: number;
}

/** GET /api/announcement —— 公开读取站点公告（首页展示） */
export async function GET() {
  try {
    if (hasRedisConfig()) {
      const data = await getValue<Announcement>(KEYS.announcement);
      if (data && data.enabled && data.text) {
        return NextResponse.json({ announcement: data });
      }
    }
  } catch {
    /* 忽略 */
  }
  return NextResponse.json({ announcement: null });
}

/** POST /api/announcement —— 设置公告（仅管理员） */
export async function POST(request: Request) {
  try {
    const { requireAdmin } = await import("@/lib/auth");
    await requireAdmin();
    if (!hasRedisConfig()) return NextResponse.json({ error: storageErrorMessage() }, { status: 500 });

    const body = (await request.json()) as { text?: string; enabled?: boolean };
    const payload: Announcement = {
      text: (body.text ?? "").slice(0, 200),
      enabled: Boolean(body.enabled),
      updatedAt: Date.now(),
    };
    const redis = getRedis();
    await redis.set(KEYS.announcement, JSON.stringify(payload));
    return NextResponse.json({ ok: true, announcement: payload });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (status === 403) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

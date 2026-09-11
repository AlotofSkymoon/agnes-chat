import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/preset-key
 * 只有 role=admin 能拿到站点内置 Key 的完整值；其余情况一律 403。
 */
export async function GET() {
  try {
    await requireAdmin();
    const key = process.env.PRESET_AGNES_API_KEY?.trim() ?? "";
    return NextResponse.json({
      configured: Boolean(key),
      apiKey: key,
      masked: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : "",
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (status === 403) return NextResponse.json({ error: "仅管理员可查看" }, { status: 403 });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

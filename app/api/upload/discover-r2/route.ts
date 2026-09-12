import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { discoverR2Bucket } from "@/lib/s3-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload/discover-r2 —— 只填桶名，自动定位 R2 桶。
 *
 * 用 Cloudflare API 列出账户下所有桶并匹配名字，
 * 自动返回 endpoint 与公开域名，免去手抄 32 位账户 ID。
 * 仅管理员可用（会用到账户级 API 令牌）。
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });

  let body: { bucket?: string };
  try {
    body = (await request.json()) as { bucket?: string };
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const result = await discoverR2Bucket(body.bucket ?? "");
  return NextResponse.json(result, { status: result.found ? 200 : 404 });
}

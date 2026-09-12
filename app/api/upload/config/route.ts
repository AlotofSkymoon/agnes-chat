import { NextResponse } from "next/server";

import { detectPlatform } from "@/lib/platform";
import { getSiteS3Info } from "@/lib/s3-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/upload/config
 * 告诉前端：站点托管了哪种对象存储、当前部署平台。
 * 只返回桶名/端点等公开信息，绝不返回任何密钥。
 */
export async function GET() {
  return NextResponse.json({
    ...getSiteS3Info(),
    platform: detectPlatform(),
  });
}

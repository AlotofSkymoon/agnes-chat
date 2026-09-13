import { NextResponse } from "next/server";

import { getCloudflareEnv } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/r2/[...key] —— 用 binding 读取 R2 对象。
 *
 * 存在的意义：桶没开"公开读"时，外部访问不了 r2.dev 域名，
 * 但 Worker 通过 binding 照样能读到。所以让读取也走一遍 Worker ——
 * **不需要把桶设成公开，也不需要任何密钥**。
 *
 * 如果配了 S3_ACCESS_HOST 自定义域，前端会直接用那个域名，不走这里。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const env = getCloudflareEnv();
  const bucket = env?.R2;

  if (!bucket) {
    return NextResponse.json({ error: "当前环境没有 R2 绑定" }, { status: 503 });
  }

  const { key } = await params;
  if (!key) return NextResponse.json({ error: "缺少对象 key" }, { status: 400 });

  // 防目录穿越：key 里不允许出现 ..
  if (key.includes("..")) {
    return NextResponse.json({ error: "非法路径" }, { status: 400 });
  }

  try {
    const obj = (await bucket.get(key)) as {
      body?: ReadableStream;
      httpMetadata?: { contentType?: string };
      size?: number;
    } | null;

    if (!obj?.body) {
      return NextResponse.json({ error: "对象不存在" }, { status: 404 });
    }

    return new NextResponse(obj.body as ReadableStream, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `读取失败：${err instanceof Error ? err.message : "未知错误"}` },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { getCloudflareEnv } from "@/lib/storage";
import { r2PublicHost } from "@/lib/s3-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload/direct —— 通过 R2 binding 直传，**不需要 AK/SK**。
 *
 * 为什么要有这条路：
 * Worker 一旦在 wrangler.jsonc 里绑定了 R2，权限就来自 binding 本身 ——
 * 桶是用户自己的，Worker 天然拥有读写权，再要一对 Access Key 纯属多余。
 *
 * 比预签名上传更好的地方：
 *   - 不用配任何密钥
 *   - 不把 endpoint / 桶名暴露给浏览器
 *   - 文件经 Worker 落 R2，便于统一做体积与类型校验
 *
 * ⚠️ 代价：文件要经过 Worker，受请求体上限约束（免费版 100MB）。
 *    超大文件仍应走 /api/upload/presign 的预签名直传。
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-80);
  return cleaned || "file";
}

export async function POST(request: Request) {
  const env = getCloudflareEnv();
  const bucket = env?.R2;

  if (!bucket) {
    return bad(
      "当前环境没有 R2 绑定，无法直传。请检查 wrangler.jsonc 的 r2_buckets，或改用 S3 预签名上传。",
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("请求格式错误，应为 multipart/form-data");
  }

  const file = form.get("file");
  const rawName = String(form.get("filename") ?? "");
  const prefix = String(form.get("prefix") ?? "agnes-chat").trim() || "agnes-chat";

  if (!(file instanceof File)) return bad("缺少文件");

  const contentType = file.type || "application/octet-stream";
  // 同一文件名会互相覆盖，加时间戳 + 随机串区分
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `${prefix}/${stamp}-${rand}-${safeName(rawName || file.name)}`;

  try {
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType },
    });
  } catch (err) {
    return bad(
      `写入 R2 失败：${err instanceof Error ? err.message : "未知错误"}`,
      500,
    );
  }

  /**
   * 公开 URL 的拼法：
   * 1. 配了 S3_ACCESS_HOST / R2_PUBLIC_BASE_URL 自定义域 → 直接用
   * 2. 否则给出相对路径，走同源的 /api/r2/[...key] 代理读取
   *    （桶没开公开读时也能正常访问，因为读取同样走 binding）
   */
  const host = r2PublicHost().replace(/\/+$/, "");
  const publicUrl = host ? `${host}/${key}` : `/api/r2/${key}`;

  return NextResponse.json({
    ok: true,
    key,
    url: publicUrl,
    size: file.size,
    contentType,
    via: "r2-binding",
  });
}

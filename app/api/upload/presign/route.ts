import { NextResponse } from "next/server";

import { presignS3Put } from "@/lib/s3-sign";
import { UPLOAD_LIMITS, type S3Config } from "@/lib/s3-presets";
import { getRedis, hasRedisConfig, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PresignBody {
  filename?: string;
  contentType?: string;
  size?: number;
  config?: S3Config;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 文件名清洗：只留安全字符，避免 object key 注入 */
function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-80);
  return cleaned || "file";
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i === -1) return "";
  const ext = name.slice(i + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function classify(contentType: string, filename: string): "image" | "video" | "other" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  const ext = extOf(filename);
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext)) return "video";
  return "other";
}

export async function POST(request: Request) {
  let body: PresignBody;
  try {
    body = (await request.json()) as PresignBody;
  } catch {
    return bad("请求格式错误");
  }

  const { filename = "", contentType = "application/octet-stream", size = 0, config } = body;

  if (!config?.enabled) return bad("未启用对象存储");
  if (!config.endpoint?.trim()) return bad("缺少 Endpoint");
  if (!config.bucket?.trim()) return bad("缺少 Bucket");
  if (!config.accessKeyId?.trim()) return bad("缺少 Access Key ID");
  if (!config.secretAccessKey?.trim()) return bad("缺少 Secret Access Key");
  if (!config.region?.trim()) return bad("缺少 Region");

  // endpoint 必须是 https，防止凭证泄露到明文通道
  let endpoint = config.endpoint.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(endpoint)) endpoint = `https://${endpoint}`;
  if (!endpoint.startsWith("https://") && !endpoint.includes("localhost")) {
    return bad("Endpoint 必须使用 HTTPS");
  }

  const kind = classify(contentType, filename);
  const limit =
    kind === "image" ? UPLOAD_LIMITS.image : kind === "video" ? UPLOAD_LIMITS.video : UPLOAD_LIMITS.other;
  if (size > limit) {
    return bad(`文件过大，${kind === "video" ? "视频" : kind === "image" ? "图片" : "文件"}最大 ${Math.round(limit / 1024 / 1024)}MB`, 413);
  }

  // 简单限流：同 IP 1 分钟 30 次（有 Redis 时才生效）
  if (hasRedisConfig()) {
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const redis = getRedis();
      const rlKey = KEYS.ratelimitUpload(ip);
      const hits = await redis.incr(rlKey);
      if (hits === 1) await redis.expire(rlKey, 60);
      if (hits > 30) return bad("上传过于频繁，请稍后再试", 429);
    } catch {
      /* 限流失败不阻塞 */
    }
  }

  // object key：前缀 / 年 / 月 / uuid.扩展名
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = extOf(filename) || (kind === "video" ? "mp4" : kind === "image" ? "png" : "bin");
  const prefix = (config.prefix?.trim() || "agnes-chat").replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

  try {
    const uploadUrl = await presignS3Put({
      endpoint,
      bucket: config.bucket.trim(),
      key,
      region: config.region.trim(),
      accessKeyId: config.accessKeyId.trim(),
      secretAccessKey: config.secretAccessKey.trim(),
      expiresIn: 900,
    });

    const publicBase = config.publicBaseUrl?.trim().replace(/\/+$/, "");
    const publicUrl = publicBase
      ? `${publicBase}/${key}`
      : `${endpoint}/${config.bucket.trim()}/${key}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      safeName: safeName(filename),
      kind,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "签名失败";
    return bad(`生成上传链接失败：${msg}`, 500);
  }
}

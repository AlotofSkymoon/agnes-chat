import { detectPlatform } from "@/lib/platform";
import type { S3Config } from "@/lib/s3-presets";

/**
 * 服务端托管的对象存储配置（仅服务端导入，密钥绝不下发浏览器）。
 *
 * 管理员把凭证配成环境变量后，普通用户在设置里点「使用站点配置」即可上传。
 * 按平台自动读取对应变量：
 *   - Cloudflare Workers → R2_*（零出站流量费，10GB 免费）
 *   - Vercel             → B2_*（10GB 免费存储）
 *
 * Cloudflare Workers：
 *   R2_ACCOUNT_ID         Cloudflare 账户 ID（32 位十六进制）
 *   R2_ACCESS_KEY_ID      R2 API 令牌 Access Key ID
 *   R2_SECRET_ACCESS_KEY  R2 API 令牌 Secret Access Key
 *   R2_BUCKET             桶名
 *   R2_PUBLIC_BASE_URL    可选，公开访问域名（r2.dev 或自定义域）
 *
 * Vercel：
 *   B2_REGION             如 us-west-004
 *   B2_ACCESS_KEY_ID      B2 的 keyID
 *   B2_SECRET_ACCESS_KEY  B2 的 applicationKey
 *   B2_BUCKET             桶名
 *   B2_PUBLIC_BASE_URL    可选，公开访问域名
 */

export interface SiteS3Info {
  /** 站点是否已托管对象存储 */
  siteManaged: boolean;
  /** 当前平台期望的存储类型 */
  kind: "r2" | "b2" | "none";
  endpoint: string;
  bucket: string;
  publicBaseUrl: string;
  /** 站点是否内置了 Agnes Key（给前端提示用，不含密钥本身） */
  hasPresetKey: boolean;
}

function fromR2(): S3Config | null {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;

  return {
    enabled: true,
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    region: "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() || "",
    prefix: "agnes-chat",
  };
}

function fromB2(): S3Config | null {
  const region = process.env.B2_REGION?.trim();
  const accessKeyId = process.env.B2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.B2_BUCKET?.trim();
  if (!region || !accessKeyId || !secretAccessKey || !bucket) return null;

  return {
    enabled: true,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.B2_PUBLIC_BASE_URL?.trim() || "",
    prefix: "agnes-chat",
  };
}

/** 读取完整配置（含密钥），只在 API Route 里用 */
export function getSiteS3Config(): S3Config | null {
  const platform = detectPlatform();

  // Workers 上优先 R2；本地开发两者都试
  if (platform === "cloudflare") return fromR2();
  if (platform === "vercel") return fromB2();
  return fromR2() ?? fromB2();
}

/** 给前端的脱敏信息（不含任何密钥） */
export function getSiteS3Info(): SiteS3Info {
  const cfg = getSiteS3Config();
  const platform = detectPlatform();
  const kind: SiteS3Info["kind"] = platform === "cloudflare" ? "r2" : platform === "vercel" ? "b2" : "none";

  return {
    siteManaged: Boolean(cfg),
    kind,
    endpoint: cfg?.endpoint ?? "",
    bucket: cfg?.bucket ?? "",
    publicBaseUrl: cfg?.publicBaseUrl ?? "",
    hasPresetKey: Boolean(process.env.PRESET_AGNES_API_KEY?.trim()),
  };
}

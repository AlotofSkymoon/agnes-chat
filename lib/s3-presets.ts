/**
 * 对象存储：按部署平台锁定唯一方案，避免选错导致上传失败。
 *
 * - Cloudflare Workers → 只能用 Cloudflare R2
 *     零出站流量费、10GB 免费存储、S3 完全兼容、自带 r2.dev 公开域名
 * - Vercel             → 只能用 Backblaze B2
 *     Vercel Serverless 不在 Cloudflare 网络内，R2 的出站优势无从发挥，
 *     且 B2 提供 10GB 免费存储；注意其 S3 兼容层只覆盖部分操作
 *
 * 两个方案都走标准 AWS SigV4 预签名，签名逻辑共用 lib/s3-sign.ts。
 */

export interface S3Preset {
  id: string;
  label: string;
  /** 端点示例（用户需替换尖括号部分） */
  endpointHint: string;
  regionHint: string;
  note: string;
  docs: string;
  recommended?: boolean;
  /** 该预设只在哪个平台出现 */
  platform?: "cloudflare" | "vercel";
  /** S3 兼容性有限，UI 会提示 */
  limited?: boolean;
}

export const S3_PRESETS: S3Preset[] = [
  {
    id: "r2",
    label: "Cloudflare R2",
    endpointHint: "https://<accountid>.r2.cloudflarestorage.com",
    regionHint: "auto",
    note: "零出站流量费，10GB 免费存储，S3 完全兼容",
    docs: "https://dash.cloudflare.com/",
    recommended: true,
    platform: "cloudflare",
  },
  {
    id: "b2",
    label: "Backblaze B2",
    endpointHint: "https://s3.<region>.backblazeb2.com",
    regionHint: "us-west-004",
    note: "10GB 免费存储，出站前 1GB/天免费；S3 兼容层仅覆盖部分操作",
    docs: "https://www.backblaze.com/b2/",
    recommended: true,
    platform: "vercel",
    limited: true,
  },
];

/** 按平台筛选可用预设；本地开发返回全部以便调试 */
export function presetsForPlatform(platform: "cloudflare" | "vercel" | "local"): S3Preset[] {
  if (platform === "local") return S3_PRESETS;
  return S3_PRESETS.filter((p) => p.platform === platform);
}

/** S3 配置（保存在浏览器本地，随上传请求一起发到服务端代理） */
export interface S3Config {
  enabled: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 自定义公开访问域名，留空则用 r2.dev 或 endpoint 拼 */
  publicBaseUrl?: string;
  /** 存储中的目录前缀 */
  prefix?: string;
  /**
   * 使用站点托管的 R2（管理员已在服务端配好凭证）。
   * 为 true 时 accessKeyId / secretAccessKey 留空，由服务端补全，密钥不下发浏览器。
   */
  useSiteConfig?: boolean;
}

export const DEFAULT_S3_CONFIG: S3Config = {
  enabled: false,
  endpoint: "",
  region: "auto",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  publicBaseUrl: "",
  prefix: "agnes-chat",
};

/** 上传体积上限 */
export const UPLOAD_LIMITS = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 100 * 1024 * 1024, // 100 MB
  other: 20 * 1024 * 1024, // 20 MB
} as const;

/** 允许的文件扩展名（白名单，防止把存储桶当网盘） */
export const ALLOWED_UPLOAD_EXT = [
  // 图片
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg", "ico", "heic",
  // 视频
  "mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv",
] as const;

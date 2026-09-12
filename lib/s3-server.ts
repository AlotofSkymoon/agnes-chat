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

/**
 * R2 账户 ID：优先 R2_ACCOUNT_ID，回退 Cloudflare 通用变量。
 * 这样只配了 CF_ACCOUNT_ID 的部署也能自动拼出 endpoint。
 */
function r2AccountId(): string {
  return (
    process.env.R2_ACCOUNT_ID?.trim() ||
    process.env.CF_ACCOUNT_ID?.trim() ||
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    ""
  );
}

/**
 * 按桶名自动定位 R2 桶。
 *
 * 用户只填桶名就够了 —— 用 Cloudflare API 列出账户下所有桶，
 * 找到同名桶并自动拼出 endpoint，免去手抄 32 位账户 ID 的麻烦。
 *
 * 需要 CLOUDFLARE_API_TOKEN（或 R2_API_TOKEN）+ 账户 ID。
 */
export async function discoverR2Bucket(
  bucketName: string,
): Promise<{ found: boolean; endpoint: string; publicBaseUrl: string; error?: string }> {
  const bucket = bucketName.trim();
  if (!bucket) return { found: false, endpoint: "", publicBaseUrl: "", error: "请填写桶名" };

  const token = (process.env.CLOUDFLARE_API_TOKEN ?? process.env.R2_API_TOKEN ?? "").trim();
  const account = r2AccountId();
  if (!token || !account) {
    return {
      found: false,
      endpoint: "",
      publicBaseUrl: "",
      error: "缺少 CLOUDFLARE_API_TOKEN 或账户 ID，无法自动查找",
    };
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return {
        found: false,
        endpoint: "",
        publicBaseUrl: "",
        error: `Cloudflare API 返回 ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      success?: boolean;
      result?: { name?: string }[];
    };
    const names = (data.result ?? []).map((b) => b.name ?? "");
    const hit = names.find((n) => n.toLowerCase() === bucket.toLowerCase());
    if (!hit) {
      return {
        found: false,
        endpoint: "",
        publicBaseUrl: "",
        error: `账户下没有名为「${bucket}」的桶，现有：${names.join("、") || "（空）"}`,
      };
    }

    const endpoint = `https://${account}.r2.cloudflarestorage.com`;
    return {
      found: true,
      endpoint,
      // r2.dev 公开域名（需在桶设置里开启）；用户也可填自定义域覆盖
      publicBaseUrl: `https://pub-${account}.r2.dev`,
    };
  } catch (err) {
    return {
      found: false,
      endpoint: "",
      publicBaseUrl: "",
      error: err instanceof Error ? err.message : "查找失败",
    };
  }
}

function fromR2(): S3Config | null {
  const account = r2AccountId();
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

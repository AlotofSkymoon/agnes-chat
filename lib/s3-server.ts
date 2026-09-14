import { detectPlatform } from "@/lib/platform";
import {
  cloudflareApiToken,
  cloudflareAccountId,
  r2BucketNameSource,
  r2S3Keys,
} from "@/lib/cf-credentials";
import type { S3Config } from "@/lib/s3-presets";
import { configValue } from "@/lib/runtime-config";
import { pickBinding } from "@/lib/storage/binding";

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
  /** 是否通过 Worker binding 直连 R2（有则免 AK/SK 直传） */
  r2Bound?: boolean;
}

/**
 * R2 账户 ID：优先 R2_ACCOUNT_ID，回退 Cloudflare 通用变量。
 * 这样只配了 CF_ACCOUNT_ID 的部署也能自动拼出 endpoint。
 */
function r2AccountId(): string {
  // 统一解析：同时看 process.env 与 Worker binding，兼容多种变量名
  return cloudflareAccountId()?.value ?? "";
}

/**
 * 通过 API Token 反查账户 ID。
 *
 * 用户明确要求「不要根据 ID 那些」—— 手抄 32 位十六进制账户 ID 既容易错，
 * 又没任何必要：只要有 API Token，调一次 /accounts 就能拿到。
 * 只有在 token 没权限或没配置时才要求手动填。
 */
export async function resolveAccountId(): Promise<{ id: string; error?: string }> {
  const preset = r2AccountId();
  if (preset) return { id: preset };

  const tokenSrc = cloudflareApiToken();
  const token = tokenSrc?.value ?? "";
  if (!token) {
    return {
      id: "",
      error:
        "读不到 Cloudflare API 令牌，且未配置账户 ID。" +
        "注意：填在 GitHub 仓库 Settings 里的 Secrets 只对 GitHub Actions 生效，" +
        "线上运行的站点读不到 —— 需要在 Cloudflare 后台（Workers → 设置 → 变量和机密）" +
        "或用 wrangler secret put 再写一遍。" +
        "其实更省事的做法是绑定 R2 桶：绑了就完全不需要令牌，也不用填账户 ID。",
    };
  }

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { id: "", error: `查询账户失败（HTTP ${res.status}）` };
    }
    const data = (await res.json()) as {
      success?: boolean;
      result?: { id?: string; name?: string }[];
    };
    const first = data.result?.find((a) => a.id);
    if (!first?.id) {
      return { id: "", error: "该令牌下没有可用账户" };
    }
    return { id: first.id };
  } catch (err) {
    return { id: "", error: err instanceof Error ? err.message : "查询账户失败" };
  }
}

/**
 * 桶名环境变量。
 *
 * 变量名沿用社区惯例（也是用户给的 Rin 部署指南里的写法）：**R2_BUCKET_NAME**。
 * 老的 R2_BUCKET 仍然兼容，但推荐用 R2_BUCKET_NAME。
 */
export function r2BucketName(): string {
  return r2BucketNameSource()?.value ?? "";
}

/**
 * 图片/文件的公开访问域名。
 * 对应社区惯例的 S3_ACCESS_HOST —— 绑定了自定义域时填它，
 * 没填则用 r2.dev 默认域名。
 */
export function r2PublicHost(): string {
  return (
    process.env.S3_ACCESS_HOST?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_HOST?.trim() ||
    ""
  );
}

/**
 * 本站默认的 R2 桶名候选。
 *
 * 部署时只要账户里存在其中任意一个，就能自动选中，用户不用填桶名。
 * 顺序即优先级：先找 agnes-chat，没有再找 agnes-chat-r2。
 */
export const R2_CANDIDATE_BUCKETS = ["agnes-chat", "agnes-chat-r2"] as const;

/**
 * 按桶名自动定位 R2 桶。
 *
 * 用户只填桶名就够了 —— 用 Cloudflare API 列出账户下所有桶，
 * 找到同名桶并自动拼出 endpoint，免去手抄 32 位账户 ID 的麻烦。
 *
 * 桶名为空时，会按 R2_CANDIDATE_BUCKETS 依次尝试，
 * 命中第一个存在的就用它 —— 这样"只配了 API Token"也能直接用上。
 *
 * 需要 CLOUDFLARE_API_TOKEN（或 R2_API_TOKEN）+ 账户 ID。
 */
export async function discoverR2Bucket(
  bucketName: string,
): Promise<{
  found: boolean;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  available?: string[];
  error?: string;
}> {
  const wanted = bucketName.trim();
  const token = cloudflareApiToken()?.value ?? "";

  // 账户 ID 没手填也没关系 —— 有 token 就能反查
  const resolved = await resolveAccountId();
  const account = resolved.id;

  if (!token || !account) {
    return {
      found: false,
      bucket: "",
      endpoint: "",
      publicBaseUrl: "",
      error: resolved.error ?? "缺少 Cloudflare API 令牌，无法自动查找",
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
        bucket: "",
        endpoint: "",
        publicBaseUrl: "",
        error: `Cloudflare API 返回 ${res.status}（令牌权限不足？需要「Workers R2 存储 → 编辑」）`,
      };
    }
    const data = (await res.json()) as {
      success?: boolean;
      result?: { name?: string }[];
    };
    const names = (data.result ?? []).map((b) => b.name ?? "").filter(Boolean);

    if (names.length === 0) {
      return {
        found: false,
        bucket: "",
        endpoint: "",
        publicBaseUrl: "",
        available: [],
        error: "账户下还没有任何 R2 桶，请先创建一个（例如 agnes-chat）",
      };
    }

    // 1) 指定了名字：精确匹配，其次前缀匹配（容忍 agnes-chat-2 这类变体）
    let hit = "";
    if (wanted) {
      hit =
        names.find((n) => n.toLowerCase() === wanted.toLowerCase()) ??
        names.find((n) => n.toLowerCase().startsWith(wanted.toLowerCase())) ??
        "";
    }

    // 2) 没指定 / 没匹配上：按默认候选名依次找
    if (!hit) {
      hit =
        R2_CANDIDATE_BUCKETS.find((c) =>
          names.some((n) => n.toLowerCase() === c.toLowerCase()),
        ) ?? "";
    }

    if (!hit) {
      return {
        found: false,
        bucket: "",
        endpoint: "",
        publicBaseUrl: "",
        available: names,
        error: wanted
          ? `没找到「${wanted}」，也没找到默认的 ${R2_CANDIDATE_BUCKETS.join(" / ")}。账户现有：${names.join("、")}`
          : `没找到默认的 ${R2_CANDIDATE_BUCKETS.join(" / ")}。账户现有：${names.join("、")}`,
      };
    }

    const endpoint = `https://${account}.r2.cloudflarestorage.com`;
    return {
      found: true,
      bucket: hit,
      endpoint,
      // r2.dev 公开域名（需在桶设置里开启）；用户也可填自定义域覆盖
      publicBaseUrl: `https://pub-${account}.r2.dev`,
      available: names,
    };
  } catch (err) {
    return {
      found: false,
      bucket: "",
      endpoint: "",
      publicBaseUrl: "",
      error: err instanceof Error ? err.message : "查找失败",
    };
  }
}

function fromR2(): S3Config | null {
  const account = r2AccountId();
  const { accessKeyId, secretAccessKey } = r2S3Keys();
  const bucket = r2BucketName();
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;

  return {
    enabled: true,
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    region: "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: r2PublicHost(),
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

/**
 * 异步版配置读取 —— 只在**缺账户 ID** 时才需要。
 *
 * 有了它，用户只填 `R2_BUCKET_NAME` + `CLOUDFLARE_API_TOKEN` 就够了：
 * 账户 ID 会拿 token 去查，桶按名字匹配，endpoint 自动拼。
 * 这正是用户要的「不要根据 ID 那些，根据桶名获取使用权」。
 */
export async function getSiteS3ConfigAsync(): Promise<S3Config | null> {
  const sync = getSiteS3Config();
  if (sync) return sync;

  const platform = detectPlatform();
  if (platform === "vercel") return null;

  const { accessKeyId, secretAccessKey } = r2S3Keys();
  if (!accessKeyId || !secretAccessKey) return null;

  const resolved = await resolveAccountId();
  if (!resolved.id) return null;

  const bucket =
    r2BucketName() ||
    (await (async () => {
      // 没指定桶名就按候选顺序找第一个存在的
      for (const name of R2_CANDIDATE_BUCKETS) {
        const hit = await discoverR2Bucket(name);
        if (hit.found) return hit.bucket;
      }
      return "";
    })());

  if (!bucket) return null;

  return {
    enabled: true,
    endpoint: `https://${resolved.id}.r2.cloudflarestorage.com`,
    region: "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: r2PublicHost() || `https://pub-${resolved.id}.r2.dev`,
    prefix: "agnes-chat",
  };
}

/** 给前端的脱敏信息（不含任何密钥） */
export function getSiteS3Info(): SiteS3Info {
  const cfg = getSiteS3Config();
  const platform = detectPlatform();
  const kind: SiteS3Info["kind"] = platform === "cloudflare" ? "r2" : platform === "vercel" ? "b2" : "none";

  /**
   * R2 binding 是否可用。
   *
   * 有 binding 就等于开通了对象存储 —— 不需要 AK/SK，
   * 桶是用户自己的，权限来自 binding 本身。
   */
  const bound = hasR2Binding();

  return {
    // 有 binding 时即使没填任何 S3 变量也算已托管
    siteManaged: Boolean(cfg) || bound,
    kind,
    endpoint: cfg?.endpoint ?? "",
    bucket: cfg?.bucket ?? "",
    publicBaseUrl: cfg?.publicBaseUrl ?? "",
    hasPresetKey: Boolean(configValue("PRESET_AGNES_API_KEY")),
    /** 有 binding → 前端走 /api/upload/direct，不用预签名 */
    r2Bound: bound,
  };
}

/**
 * 检测 R2 binding。
 * 这里不能 import cloudflare.ts（会造成循环依赖），直接探测全局对象。
 */
export function hasR2Binding(): boolean {
  const g = globalThis as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    g.__env__,
    g.__cloudflare_env__,
    g.__cloudflareContext__,
    g.__cf_env__,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const inner = ((c as Record<string, unknown>).env ?? c) as Record<string, unknown>;
    /**
     * ⚠️ 必须走 pickBinding 做大小写不敏感匹配。
     *
     * 这里曾经写死 `(inner as { R2?: unknown }).R2`（只认大写），
     * 而配置里的 binding 名已经改成小写 `r2` ——
     * 结果是：桶明明绑好了，却检测不到，设置面板一直显示
     * 完整的 Endpoint / AK / SK 手填表单，还引导用户去生成 Access Key。
     * 这正是"cloudflare 能 binding 为什么还要我填这些"的根源。
     */
    if (inner && typeof inner === "object" && pickBinding(inner, "r2")) return true;
  }
  return false;
}

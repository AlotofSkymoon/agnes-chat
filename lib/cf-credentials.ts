/**
 * Cloudflare 凭证统一解析。
 *
 * 为什么要单独抽一个模块：
 * `CLOUDFLARE_API_TOKEN` 在真实部署里「识别不到」的原因不止一个，
 * 散落在各处各读一次 process.env 就会各有各的漏法，而且报出来的错都一样
 * （"缺少 CLOUDFLARE_API_TOKEN"），根本没法排查。
 *
 * 这里集中处理四种常见失效场景：
 *
 * 1. **Workers 上 process.env 拿不到密钥**
 *    用 `wrangler secret put` 写入的是 **binding**，不是 process.env。
 *    OpenNext 各版本对 process.env 的垫片行为不一致，
 *    只写 process.env.CLOUDFLARE_API_TOKEN 的话，Workers 上经常是 undefined。
 *    → 所以必须**同时**去 Cloudflare 的 env 对象里找。
 *
 * 2. **变量名不统一**
 *    不同人习惯用 CF_API_TOKEN / R2_API_TOKEN / CLOUDFLARE_TOKEN…
 *    → 全部按优先级依次尝试。
 *
 * 3. **粘贴带了空白或换行**
 *    从终端复制时极易混入尾部换行，导致 Authorization 头变成
 *    `Bearer xxx\n`，Cloudflare 直接 401。
 *    → 统一 trim，并顺手去掉可能被一起复制的引号。
 *
 * 4. **填成了 Global API Key**
 *    Global Key 是 37 位，API Token 是 40 位。两者用法不同
 *    （Global Key 要配 X-Auth-Email 头，单靠它鉴不了）。
 *    → 检测长度并给出明确提示，别让人对着 401 干瞪眼。
 */

/** 令牌类变量名，按优先级排列 */
const TOKEN_KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CF_API_TOKEN",
  "R2_API_TOKEN",
  "CLOUDFLARE_TOKEN",
  "CF_TOKEN",
] as const;

/** 账户 ID 变量名 */
const ACCOUNT_KEYS = [
  "R2_ACCOUNT_ID",
  "CF_ACCOUNT_ID",
  "CLOUDFLARE_ACCOUNT_ID",
  "ACCOUNT_ID",
] as const;

/** 桶名变量名 */
/**
 * 桶名变量名。
 *
 * 兼容各种写法：GitHub Secrets 里通常写 R2_BUCKET_NAME，
 * 但某些平台 / 导入流程会把变量名转成小写（r2_bucket），
 * 只认大写就会"明明填了却读不到"。这里大小写一视同仁。
 */
const BUCKET_KEYS = [
  "R2_BUCKET_NAME",
  "r2_bucket",
  "r2_bucket_name",
  "R2_BUCKET",
  "CF_R2_BUCKET",
  "BUCKET_NAME",
] as const;

/** 清洗：去空白、去误粘的引号 */
function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^["']+|["']+$/g, "").trim();
}

/**
 * 取 Cloudflare 的 env 对象。
 *
 * 不能直接 import cloudflare.ts（会造成循环依赖），
 * 这里做一次轻量探测，只读属性不触发任何副作用。
 */
function cfEnvObject(): Record<string, unknown> | null {
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
    if (inner && typeof inner === "object") return inner;
  }
  return null;
}

export interface CredentialSource {
  /** 找到的值（令牌本身永远不会被返回，见 maskToken） */
  value: string;
  /** 从哪个来源找到的：进程环境变量 或 Worker binding */
  from: "process.env" | "cf-binding";
  /** 实际命中的变量名 */
  key: string;
}

/** 依次尝试 process.env 与 Worker binding，返回第一个非空值 */
function lookup(keys: readonly string[]): CredentialSource | null {
  const envObj = cfEnvObject();

  for (const key of keys) {
    const fromProcess = clean(process.env[key]);
    if (fromProcess) return { value: fromProcess, from: "process.env", key };
  }
  if (envObj) {
    for (const key of keys) {
      const fromBinding = clean(envObj[key]);
      if (fromBinding) return { value: fromBinding, from: "cf-binding", key };
    }
  }
  return null;
}

/** API Token（用于调用 Cloudflare REST API） */
export function cloudflareApiToken(): CredentialSource | null {
  return lookup(TOKEN_KEYS);
}

/** 账户 ID（32 位十六进制） */
export function cloudflareAccountId(): CredentialSource | null {
  return lookup(ACCOUNT_KEYS);
}

/** R2 桶名 */
export function r2BucketNameSource(): CredentialSource | null {
  return lookup(BUCKET_KEYS);
}

/** R2 的 S3 访问密钥（用 S3 兼容 API 时才需要） */
export function r2S3Keys(): { accessKeyId: string; secretAccessKey: string } {
  const envObj = cfEnvObject() ?? {};
  const pick = (keys: string[]): string => {
    for (const k of keys) {
      const a = clean(process.env[k]);
      if (a) return a;
      const b = clean(envObj[k]);
      if (b) return b;
    }
    return "";
  };
  return {
    accessKeyId: pick(["R2_ACCESS_KEY_ID"]),
    secretAccessKey: pick(["R2_SECRET_ACCESS_KEY"]),
  };
}

/**
 * 令牌脱敏，仅用于日志与诊断展示。
 * 只保留前 4 位，其余打码 —— 足以确认"读到了哪一个"，又不会泄露。
 */
export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}${"*".repeat(Math.min(12, token.length - 8))}${token.slice(-4)}`;
}

/**
 * 令牌形态检查。
 *
 * - API Token：40 位
 * - Global API Key：37 位（不能单独用于 Bearer 鉴权，需配邮箱）
 * 长度对不上不代表一定错了，但值得提示一声。
 */
export function inspectToken(token: string): { ok: boolean; hint: string } {
  const n = token.length;
  if (n === 0) return { ok: false, hint: "令牌为空" };
  if (n === 37) {
    return {
      ok: false,
      hint:
        "这看起来是 Global API Key（37 位），不是 API Token（40 位）。" +
        "Global Key 不能单独用于 Bearer 鉴权，请在 Cloudflare 后台创建 API 令牌。",
    };
  }
  if (n < 20) {
    return { ok: false, hint: `令牌长度只有 ${n} 位，疑似粘贴不完整` };
  }
  if (/\s/.test(token)) {
    return { ok: false, hint: "令牌中含有空白字符，请检查是否粘贴时混入了换行或空格" };
  }
  return { ok: true, hint: "" };
}

/** 给诊断接口用的凭证状态（不含任何密钥明文） */
export function credentialStatus() {
  const token = cloudflareApiToken();
  const account = cloudflareAccountId();
  const bucket = r2BucketNameSource();
  const { accessKeyId, secretAccessKey } = r2S3Keys();

  return {
    token: {
      present: Boolean(token),
      key: token?.key ?? null,
      from: token?.from ?? null,
      masked: token ? maskToken(token.value) : null,
      ...(token ? inspectToken(token.value) : {}),
    },
    accountId: {
      present: Boolean(account),
      key: account?.key ?? null,
      from: account?.from ?? null,
      // 账户 ID 不算机密，但仍只给前 6 位
      masked: account ? `${account.value.slice(0, 6)}…(${account.value.length}位)` : null,
    },
    bucket: {
      present: Boolean(bucket),
      key: bucket?.key ?? null,
      value: bucket?.value ?? null,
    },
    s3Keys: {
      accessKeyId: accessKeyId ? `${accessKeyId.slice(0, 4)}…` : null,
      secretAccessKey: secretAccessKey ? "已配置" : null,
    },
  };
}

/**
 * 运行时配置读取 —— **同时查 process.env 和 Worker binding**。
 *
 * 为什么必须两个都查：
 *
 * 在 Cloudflare Workers 上，通过 `wrangler secret put` 或后台「变量和机密」
 * 写入的值是 **binding**，不是 process.env。OpenNext 各版本对 process.env
 * 的垫片行为不一致，只写 `process.env.X` 的话，Workers 上经常是 undefined。
 *
 * 这个坑在 `cf-credentials.ts` 里已经踩过一次（API 令牌），
 * 但 Upstash 配置却还在只读 process.env —— 后果很严重：
 *
 *   Cloudflare 上读不到 UPSTASH_* → 退回 KV + D1
 *   Vercel 上读得到             → 用 Upstash
 *   ⇒ 明明是同一个 Redis，聊天记录却不互通。
 *
 * 所以所有运行时配置统一收口到这里。
 */

/** 去掉首尾空白与误粘贴的引号 */
function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  let v = value.trim();
  // 复制时经常混入首尾引号
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}

/** 取 Cloudflare binding 对象（可能是 OpenNext 注入的 context） */
function cfEnvObject(): Record<string, unknown> | null {
  const g = globalThis as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    g.__env__,
    g.__cloudflare_env__,
    g.__cloudflareContext__,
    g.__cf_env__,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      const inner = (obj.env ?? obj) as Record<string, unknown>;
      if (inner && typeof inner === "object") return inner;
    }
  }
  return null;
}

export interface ConfigSource {
  value: string;
  /** 从哪读到的，便于排查 */
  from: "process.env" | "cf-binding";
  /** 实际命中的变量名 */
  key: string;
}

/** 依次尝试 process.env 与 Worker binding，返回第一个非空值 */
export function lookup(keys: readonly string[]): ConfigSource | null {
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

/** 取单个值（找不到返回空串） */
export function configValue(...keys: string[]): string {
  return lookup(keys)?.value ?? "";
}

/** 布尔值：只有显式写 false/0/no 才算关 */
export function configBool(...keys: string[]): boolean {
  const raw = configValue(...keys).toLowerCase();
  if (!raw) return false;
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}

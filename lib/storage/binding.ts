/**
 * Cloudflare binding 名解析（大小写不敏感）。
 *
 * 单独放一个文件，避免 cloudflare.ts ↔ index.ts 互相 import 形成循环依赖。
 *
 * 为什么必须兼容大小写：
 * 在 Cloudflare 后台手动绑定时，不同教程给的 binding 名不一样 ——
 * 本项目文档写 KV / DB / R2，而 cloud-mail 那类项目用小写 kv / db / r2。
 * 用户照着任一教程填都可能，写死大写会导致"明明绑了却检测不到"。
 */
export function pickBinding(env: Record<string, unknown>, name: string): unknown {
  if (!env || typeof env !== "object") return undefined;

  const upper = name.toUpperCase();
  const lower = name.toLowerCase();

  const direct = env[upper] ?? env[lower];
  if (direct !== undefined) {
    // 归一化：把值也挂到大写键上，后续代码只需认 KV / DB / R2
    if (env[upper] === undefined) {
      try {
        env[upper] = direct;
      } catch {
        /* 只读对象，忽略 */
      }
    }
    return direct;
  }
  return undefined;
}

/** 是否绑定了 R2 桶（不需要任何 Access Key） */
export function hasBinding(env: Record<string, unknown> | null, name: string): boolean {
  if (!env) return false;
  return pickBinding(env, name) !== undefined;
}

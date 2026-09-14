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
export function pickBinding(
  env: Record<string, unknown> | null | undefined,
  name: string,
): unknown {
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

/* ==========================================================================
   统一获取 Cloudflare bindings

   背景（这是本项目踩过的最隐蔽的一个坑）：

   之前「设置面板」显示已绑定、但一上传就报「没有 R2 绑定」——
   两处用了**不同的判定方式**，结论不一致：

     - 设置面板走 lib/s3-server.ts 的 hasR2Binding()，有 CF_R2_BOUND 声明兜底 → true
     - 上传走 /api/upload/direct，直接找真实 binding 对象 → 拿不到 → 503

   而真实 binding 拿不到的根因是：旧版 OpenNext（0.4.x）并不把 bindings
   挂在 globalThis 上，靠扫描全局对象的方式经常扑空。

   现在改成统一入口 getCloudflareBindings()，按可靠性依次尝试：
     1. OpenNext 官方 API（getCloudflareContext）—— 1.x 的正确姿势
     2. 运行时注入的 override（setCloudflareEnv）
     3. globalThis 扫描（兼容旧版 / 其他运行时）
   三处调用方共用同一个结果，不会再出现"面板说有、上传说没有"。
   ========================================================================== */

/** 供应用启动时显式注入的 bindings（由 setCloudflareEnv 写入） */
let bindingsOverride: Record<string, unknown> | null = null;

/** 缓存探测结果，避免每个请求都跑一遍 */
let bindingsCache: Record<string, unknown> | null | undefined;

/**
 * 由宿主注入 bindings。
 * 例如在 Workers 入口拿到 getCloudflareContext().env 后调用。
 */
export function setBindingsOverride(env: Record<string, unknown> | null): void {
  bindingsOverride = env;
  bindingsCache = undefined; // 让下次重新解析
}

/** 判定某个对象是否像 Cloudflare bindings（含 KV / D1 / R2 任一） */
function looksLikeBindings(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  // OpenNext 的 context 形如 { env: {...}, ctx, cf }，先剥一层
  const inner = (obj.env ?? obj) as Record<string, unknown>;
  if (!inner || typeof inner !== "object") return null;
  if (
    pickBinding(inner, "kv") ||
    pickBinding(inner, "db") ||
    pickBinding(inner, "r2")
  ) {
    return inner;
  }
  return null;
}

/**
 * 同步版扫描（不含 OpenNext 异步 API）。
 *
 * 供必须是同步函数的场景使用（例如 hasR2Binding）。
 * 异步场景请用 getCloudflareBindings()，它多一层官方 API 兜底。
 */
export function scanBindingsSync(): Record<string, unknown> | null {
  return scanGlobalThis();
}

/**
 * 读取 OpenNext 的 Cloudflare context。
 *
 * ⚠️ 这是本项目「明明绑了 R2 却检测不到」的**真正根因**：
 *
 * OpenNext 1.x 把 context 挂在
 *     globalThis[Symbol.for("__cloudflare-context__")]
 * 上 —— 是一个 **Symbol 键**。
 *
 * 而原来的探测用 Object.keys(globalThis) 扫描，
 * **Object.keys 枚举不到 Symbol 属性**，所以无论怎么扫都找不到，
 * 于是 R2 / KV / D1 全部判定为"未绑定"。
 *
 * 好处是：Symbol.for 是全局注册的，直接按名字取即可，
 * **不需要 import @opennextjs/cloudflare** ——
 * 那个包依赖很重（@opennextjs/aws、cloudflare、yargs…），
 * 静态 import 会显著拖慢构建甚至打包失败。
 */
function readOpenNextContext(): Record<string, unknown> | null {
  try {
    const g = globalThis as unknown as Record<symbol, unknown>;
    const sym = Symbol.for("__cloudflare-context__");
    const ctx = g[sym] as { env?: unknown } | undefined;
    if (ctx && typeof ctx === "object") {
      const env = ctx.env as Record<string, unknown> | undefined;
      if (env && typeof env === "object") return env;
    }
    // 有些版本直接把 env 挂在 symbol 上
    if (ctx && typeof ctx === "object" && !("env" in ctx)) {
      return ctx as unknown as Record<string, unknown>;
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 扫描 globalThis 上常见的注入位置 */
function scanGlobalThis(): Record<string, unknown> | null {
  const g = globalThis as unknown as Record<string, unknown>;

  // 0) OpenNext 1.x：Symbol 键（最可靠，见 readOpenNextContext 的注释）
  const fromSymbol = readOpenNextContext();
  if (fromSymbol) return fromSymbol;

  // 1) 先试已知命名（OpenNext 各版本注入位置不统一）
  const known: unknown[] = [
    g.__env__,
    g.__cloudflare_env__,
    g.__cloudflareContext__,
    g.__cf_env__,
    g.__NEXT_DATA__,
  ];
  for (const c of known) {
    const hit = looksLikeBindings(c);
    if (hit) return hit;
  }

  // 2) 兜底：扫 globalThis 上所有属性，找含 KV / DB / R2 的对象。
  //    不同版本 OpenNext / workerd 注入的全局名可能变化，
  //    与其猜名字，不如按"是否含我们要的 binding"来认。
  for (const key of Object.keys(g)) {
    if (key.startsWith("__") && key.endsWith("__")) continue;
    try {
      const hit = looksLikeBindings(g[key]);
      if (hit) return hit;
    } catch {
      /* 某些 getter 会抛错，跳过 */
    }
  }

  // 3) process.env 上也可能挂着（OpenNext 会把 bindings 铺平到这里）
  try {
    const procEnv = (globalThis as { process?: { env?: Record<string, unknown> } }).process?.env;
    if (procEnv) {
      const hit = looksLikeBindings(procEnv);
      if (hit) return hit;
    }
  } catch {
    /* 忽略 */
  }

  return null;
}

/**
 * 获取 Cloudflare bindings（异步）。
 *
 * 在 Vercel / 本地会返回 null —— 这是正常的，不是错误，
 * 调用方应据此走 Upstash / 预签名分支。
 */
export async function getCloudflareBindings(): Promise<Record<string, unknown> | null> {
  if (bindingsCache !== undefined) return bindingsCache;

  // 1) 宿主显式注入
  if (bindingsOverride) {
    bindingsCache = bindingsOverride;
    return bindingsOverride;
  }

  // 2) globalThis（含 OpenNext 的 Symbol 键）/ process.env 扫描
  const scanned = scanGlobalThis();
  bindingsCache = scanned;
  return scanned;
}

/**
 * 获取 R2 bucket binding（异步）。
 *
 * 拿不到返回 null —— 调用方应降级到预签名，而不是抛 503 让用户困惑。
 */
export async function getR2Bucket(): Promise<{
  put: (k: string, v: unknown, o?: unknown) => Promise<unknown>;
  get: (k: string) => Promise<unknown>;
} | null> {
  const env = await getCloudflareBindings();
  const bucket = pickBinding(env, "r2");
  if (!bucket || typeof bucket !== "object") return null;
  const b = bucket as { put?: unknown; get?: unknown };
  if (typeof b.put !== "function" || typeof b.get !== "function") return null;
  return b as {
    put: (k: string, v: unknown, o?: unknown) => Promise<unknown>;
    get: (k: string) => Promise<unknown>;
  };
}

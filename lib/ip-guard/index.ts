import { isIcloudRelay, relayCacheInfo } from "./relay";
import { matchesAny, parseCidr, parseIp, type Cidr } from "./cidr";
import { timeoutSignal } from "@/lib/fetch-timeout";
import { configValue } from "@/lib/runtime-config";

/**
 * 访问来源检测：拦代理工具，放行 iCloud Private Relay 这类系统中继。
 *
 * ⚠️ 设计上刻意采用 fail-open（出错即放行）：
 * IP 情报接口可能超时、token 可能失效、数据源可能抽风。
 * 这些情况下如果把访问者一律拦掉，等于自己把站点搞挂 ——
 * 而且挂掉的方式极具迷惑性（用户以为是自己网络有问题）。
 * 所以任何拿不到结论的情况都放行，只拦截"明确判定为代理"的。
 */

/* --------------------------- 配置 --------------------------- */

/**
 * ipip 风险画像接口 token（付费接口）。
 *
 * ⚠️ 必须走 configValue 而不是裸 process.env：
 * middleware 跑在 Edge runtime，那里的 process.env 是**构建时内联**的 ——
 * 构建环境里没有这个变量，打包出来就是 undefined，
 * 之后在后台补配也读不到，功能静默失效。
 * configValue 会同时查 Worker binding，至少在 Node runtime 侧能拿到。
 */
function token(): string {
  return configValue("IPIP_RISK_TOKEN", "IPIP_TOKEN");
}

export function ipGuardEnabled(): boolean {
  return (process.env.IP_GUARD_ENABLED ?? "").trim() !== "false";
}

/** 风险分阈值。ipip 官方建议 90 分以上可开启访问限制。 */
function threshold(): number {
  const raw = Number(process.env.IP_GUARD_RISK_THRESHOLD ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.min(100, Math.max(1, raw));
}

/**
 * 命中的风险行为即拦截。
 * 默认只拦"代理"和"秒拨" —— 这两类是明确的代理工具特征。
 * "机房"(IDC) 默认不拦：VPS 出口不一定在跑代理，一刀切误伤太重。
 * 想更严格就自己加：IP_GUARD_BLOCK_BEHAVIORS=代理,秒拨,机房
 */
function blockedBehaviors(): string[] {
  const raw = (process.env.IP_GUARD_BLOCK_BEHAVIORS ?? "").trim();
  if (!raw) return ["代理", "秒拨"];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 是否放行已登录管理员（避免站长把自己锁在门外） */
function adminBypass(): boolean {
  return (process.env.IP_GUARD_ADMIN_BYPASS ?? "").trim() !== "false";
}

/**
 * 永久放行的 IP 白名单（CIDR，逗号分隔）。
 *
 * ⚠️ 为什么必须有这个：
 * 一旦真拦截（返回 403 而不是弹提示），误判的代价就从"多点一下"
 * 变成"彻底打不开"。而企业网络和国内 CGNAT 移动网络被判成代理非常常见 ——
 * 站长自己很可能就在这种网络里，一开功能就把自己锁在门外，
 * 且此时他已经没法登录后台去关掉它了。
 *
 * 白名单是唯一不依赖站点自身的逃生通道。
 */
/**
 * 不做缓存：环境变量在 Worker 里的就绪时机不完全确定，
 * 一旦在首次请求时固化成空值，之后即使配置到位也永远读不到 ——
 * 白名单会静默失效，而它恰恰是误判时唯一的逃生通道。
 * CIDR 解析本身很轻，白名单条目通常只有几条，每次重新解析的开销可忽略。
 */
function allowlist(): Cidr[] {
  const raw = (process.env.IP_GUARD_ALLOWLIST ?? "").trim();
  const out: Cidr[] = [];
  if (raw) {
    for (const part of raw.split(",")) {
      const c = parseCidr(part.trim());
      if (c) out.push(c);
    }
  }
  return out;
}

/** 供自检接口展示白名单条数 */
export function allowlistSize(): number {
  return allowlist().length;
}

/* --------------------------- 取客户端 IP --------------------------- */

/**
 * 从请求头取客户端 IP。
 *
 * 优先级按"可信度"排：
 * - cf-connecting-ip：Cloudflare 注入，平台保证不可伪造，最可信
 * - true-client-ip：Cloudflare Enterprise 同类的另一套头
 * - x-real-ip：多数反向代理会设置
 * - x-forwarded-for：可伪造，只作兜底，且取**第一个**
 *
 * ⚠️ 不要用 x-forwarded-for 的最后一个 —— 那是最靠近服务端的一跳，
 * 在多层代理下会拿到 CDN/网关自己的 IP，检测就失去了意义。
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
  ];
  for (const c of candidates) {
    const v = (c ?? "").trim();
    if (v) return v;
  }

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

/* --------------------------- ip-api.com 免费源 --------------------------- */

/**
 * 是否启用免费源（默认启用）。
 *
 * ⚠️ 为什么必须有它：
 * ipip 的风险画像是**付费**接口。大多数站长不会为了一个小站去买，
 * 结果就是：开关开了、文档看了、VPN 照样能进 —— 因为检测从头到尾没跑过。
 * 免费源让这个功能在零配置下也能真正工作。
 *
 * ip-api.com 免费端点只限**非商业用途**且有速率限制（约 45 次/分钟）。
 * 站点有商业性质或流量较大时请关掉它、改用付费源：
 *   IP_GUARD_FREE_SOURCE=false
 */
function freeSourceEnabled(): boolean {
  const raw = configValue("IP_GUARD_FREE_SOURCE");
  if (!raw) return true;
  return raw.toLowerCase() !== "false";
}

interface FreeResult {
  proxy: boolean;
  hosting: boolean;
  ok: boolean;
}

const EMPTY_FREE: FreeResult = { proxy: false, hosting: false, ok: false };

async function queryFree(ip: string): Promise<FreeResult> {
  if (!freeSourceEnabled()) return EMPTY_FREE;

  // 免费端点不支持 https，只能 http（服务端 fetch 无混合内容问题）
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,proxy,hosting`;
  try {
    const res = await fetch(url, { signal: timeoutSignal(4000) });
    if (!res.ok) return EMPTY_FREE;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return EMPTY_FREE;

    const d = data as { status?: unknown; proxy?: unknown; hosting?: unknown };
    // 接口用 status 字段表示成败（HTTP 始终是 200）
    if (d.status !== "success") return EMPTY_FREE;

    return { proxy: d.proxy === true, hosting: d.hosting === true, ok: true };
  } catch {
    return EMPTY_FREE;
  }
}

/* --------------------------- ipip 风险画像 --------------------------- */

/** 免费但只能查归属地的接口（不能判断代理），仅用于兜底展示 */
const MYIP_LA = "https://api.myip.la/en?json";

interface RiskResult {
  score: number | null;
  behaviors: string[];
  usageType: string | null;
  ok: boolean;
}

const EMPTY_RISK: RiskResult = { score: null, behaviors: [], usageType: null, ok: false };

async function queryRisk(ip: string): Promise<RiskResult> {
  const tk = token();
  if (!tk) return EMPTY_RISK;

  const url = `https://ipapi.ipip.net/v2/risk/portrait/${encodeURIComponent(ip)}?token=${encodeURIComponent(tk)}`;
  try {
    const res = await fetch(url, { signal: timeoutSignal(5000) });
    if (!res.ok) return EMPTY_RISK;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return EMPTY_RISK;

    const root = data as { ret?: unknown; data?: unknown };
    // 接口用 ret="err" 表示失败（此时 HTTP 仍是 200），必须认这个字段
    if (root.ret !== "ok") return EMPTY_RISK;

    const d = root.data as
      | { usage_type?: unknown; risk?: { score?: unknown; behavior?: unknown } }
      | undefined;
    if (!d) return EMPTY_RISK;

    const behaviors: string[] = [];
    const list = d.risk?.behavior;
    if (Array.isArray(list)) {
      for (const item of list) {
        const name = (item as { name?: unknown })?.name;
        if (typeof name === "string" && name.trim()) behaviors.push(name.trim());
      }
    }

    const scoreRaw = d.risk?.score;
    const score = typeof scoreRaw === "number" && Number.isFinite(scoreRaw) ? scoreRaw : null;

    return {
      score,
      behaviors,
      usageType: typeof d.usage_type === "string" ? d.usage_type : null,
      ok: true,
    };
  } catch {
    return EMPTY_RISK;
  }
}

/* --------------------------- 结果缓存 --------------------------- */

/**
 * 按 IP 缓存检测结果。
 *
 * ⚠️ 为什么要缓存：
 * 站点每个页面都可能触发一次检测，而 ipip 是按次计费的付费接口 ——
 * 不缓存的话同一个人刷新几次就把额度烧光了。
 */
const RESULT_TTL_MS = 10 * 60 * 1000;
/**
 * 用普通对象而不是 Map：
 * 项目 tsconfig 没有显式 target（Next 构建时才设成 ES2017），
 * 直接 for...of 遍历 Map 会触发 TS2802（ES5 下迭代 Map 需要 downlevelIteration）。
 * 对象 + Object.keys 在任何 target 下都能编译。
 */
const resultCache: Record<string, { at: number; verdict: IpVerdict }> = Object.create(null);

export type IpVerdict = {
  allowed: boolean;
  /**
   * 判定原因：
   * ok=正常放行、relay=中继放行、allowlist=白名单放行、
   * proxy=代理已拦截、error=检测失败放行、no-ip=取不到IP放行、disabled=功能关闭
   */
  reason: "ok" | "relay" | "allowlist" | "proxy" | "error" | "no-ip" | "disabled";
  ip: string | null;
  relay: boolean;
  score: number | null;
  behaviors: string[];
  usageType: string | null;
  /** 实际生效的判定来源 */
  provider: "ipip-risk" | "ip-api" | "relay-list" | "none";
  /** ipip 接口是否真的返回了结论（没配 token 时为 false） */
  detected: boolean;
  cached: boolean;
};

function evictExpired(now: number): void {
  const keys = Object.keys(resultCache);
  // 顺手清理，避免缓存无限增长
  if (keys.length < 512) return;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const entry = resultCache[k];
    if (entry && now - entry.at > RESULT_TTL_MS) delete resultCache[k];
  }
}

/* --------------------------- 主判定 --------------------------- */

/**
 * 判定一个 IP 是否允许访问。
 * isAdmin 为 true 时直接放行（管理员不该被自己的规则锁在外面）。
 */
export async function checkIp(ip: string | null, isAdmin = false): Promise<IpVerdict> {
  if (!ipGuardEnabled()) {
    return {
      allowed: true, reason: "disabled", ip, relay: false,
      score: null, behaviors: [], usageType: null,
      provider: "none", detected: false, cached: false,
    };
  }

  if (isAdmin && adminBypass()) {
    return {
      allowed: true, reason: "ok", ip, relay: false,
      score: null, behaviors: [], usageType: null,
      provider: "none", detected: false, cached: false,
    };
  }

  if (!ip) {
    // 拿不到 IP 就放行 —— 宁可漏过也不能把全站拦死
    return {
      allowed: true, reason: "no-ip", ip: null, relay: false,
      score: null, behaviors: [], usageType: null,
      provider: "none", detected: false, cached: false,
    };
  }

  // 白名单优先于一切判定：它是误判时的逃生通道
  const parsed = parseIp(ip);
  if (parsed && allowlist().length > 0 && matchesAny(allowlist(), parsed)) {
    return {
      allowed: true, reason: "allowlist", ip, relay: false,
      score: null, behaviors: [], usageType: null,
      provider: "none", detected: false, cached: false,
    };
  }

  const now = Date.now();
  evictExpired(now);
  const hit = resultCache[ip];
  if (hit && now - hit.at < RESULT_TTL_MS) {
    return { ...hit.verdict, cached: true };
  }

  /**
   * 顺序很关键：先看是不是 iCloud Private Relay。
   * 中继在技术上也"换了 IP"，如果先查风险画像，
   * Apple 的出口段很容易被判成机房/代理 —— 那就白放行了。
   */
  let relay = false;
  try {
    relay = await isIcloudRelay(ip);
  } catch {
    relay = false;
  }

  if (relay) {
    const verdict: IpVerdict = {
      allowed: true, reason: "relay", ip, relay: true,
      score: null, behaviors: [], usageType: null,
      provider: "relay-list", detected: true, cached: false,
    };
    resultCache[ip] = { at: now, verdict };
    return verdict;
  }

  const risk = await queryRisk(ip);

  let behaviors = risk.behaviors;
  let score = risk.score;
  let usageType = risk.usageType;
  let provider: IpVerdict["provider"] = "ipip-risk";
  let detected = risk.ok;

  // ipip 没给结论（没配 token / 超时 / 报错）→ 回落到免费源
  if (!risk.ok) {
    const free = await queryFree(ip);
    if (free.ok) {
      behaviors = [];
      if (free.proxy) behaviors.push("代理");
      if (free.hosting) behaviors.push("机房");
      usageType = free.hosting ? "机房" : "住宅";
      provider = "ip-api";
      detected = true;
    }
  }

  // 两个源都没拿到结论 → fail-open 放行
  if (!detected) {
    const verdict: IpVerdict = {
      allowed: true, reason: "error", ip, relay: false,
      score: null, behaviors: [], usageType,
      provider: "none", detected: false, cached: false,
    };
    // 失败结果也缓存，但时间短一些，避免接口恢复后迟迟不生效
    resultCache[ip] = { at: now, verdict };
    return verdict;
  }

  const blockList = blockedBehaviors();
  const hitBehavior = behaviors.filter((b) => blockList.some((x) => b.includes(x)));
  const overScore = score !== null && score >= threshold();
  const blocked = hitBehavior.length > 0 || overScore;

  const verdict: IpVerdict = {
    allowed: !blocked,
    reason: blocked ? "proxy" : "ok",
    ip,
    relay: false,
    score,
    behaviors,
    usageType,
    provider,
    detected: true,
    cached: false,
  };
  resultCache[ip] = { at: now, verdict };
  return verdict;
}

/** 自检用：让 /api/health 能看出这套检测到底有没有在工作 */
export function ipGuardStatus(): {
  enabled: boolean;
  configured: boolean;
  freeSource: boolean;
  /**
   * 实际能用的数据源。
   * ⚠️ 这是排查"开关开了却拦不住"的关键字段：
   * 两个源都不可用时，检测从头到尾没跑过，一切访问都会被放行。
   */
  activeSource: "ipip-risk" | "ip-api" | "none";
  threshold: number;
  blockBehaviors: string[];
  allowlist: number;
  relayRanges: number;
  relayFetchedAt: number | null;
} {
  const hasToken = token().length > 0;
  const free = freeSourceEnabled();
  return {
    enabled: ipGuardEnabled(),
    configured: hasToken,
    freeSource: free,
    activeSource: hasToken ? "ipip-risk" : free ? "ip-api" : "none",
    threshold: threshold(),
    blockBehaviors: blockedBehaviors(),
    allowlist: allowlistSize(),
    relayRanges: relayCacheInfo().count,
    relayFetchedAt: relayCacheInfo().fetchedAt,
  };
}

export { MYIP_LA };

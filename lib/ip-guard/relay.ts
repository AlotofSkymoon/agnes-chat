import { parseCidr, parseIp, matchesAny, type Cidr } from "./cidr";

/**
 * iCloud Private Relay 出口 IP 段。
 *
 * ⚠️ 为什么单独处理中继：
 * Private Relay 在技术上确实"换了 IP"，但它不是用户主动搭的代理工具 ——
 * 它是 Apple 系统级的隐私功能，很多用户根本不知道自己开着。
 * 一律拦截等于把大批正常使用 iPhone/Mac 的人挡在门外，
 * 而且他们完全不知道自己做错了什么、该怎么修。
 *
 * 数据源用 Apple 官方发布的出口段清单（权威、免费、无需 token）：
 *   https://mask-api.icloud.com/egress-ip-ranges.csv
 * 每行形如：172.224.0.0/24,US,US-CA,San Francisco
 */

const EGRESS_URL = "https://mask-api.icloud.com/egress-ip-ranges.csv";

/** 清单刷新间隔：24 小时。Apple 会不定期调整段，但不会每天大变。 */
const REFRESH_MS = 24 * 60 * 60 * 1000;
/** 拉取超时：清单约几百 KB，但不能让页面等太久 */
const FETCH_TIMEOUT_MS = 6000;

interface Cache {
  cidrs: Cidr[];
  fetchedAt: number;
}

let cache: Cache | null = null;
let inflight: Promise<Cidr[]> | null = null;

async function fetchRaw(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  try {
    const res = await fetch(EGRESS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function parseEgressCsv(csv: string): Cidr[] {
  const out: Cidr[] = [];
  for (const rawLine of csv.split("\n")) {
    const line = rawLine.trim();
    // 跳过空行和注释行
    if (!line || line.startsWith("#")) continue;
    // 只取逗号前的第一段（后面是国家/地区/城市，不需要）
    const first = line.split(",")[0]?.trim();
    if (!first) continue;
    const cidr = parseCidr(first);
    if (cidr) out.push(cidr);
  }
  return out;
}

async function load(): Promise<Cidr[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < REFRESH_MS) return cache.cidrs;

  // 并发去重：多个请求同时触发时只拉一次
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const csv = await fetchRaw();
      const cidrs = parseEgressCsv(csv);
      /**
       * 只在解析出内容时才覆盖缓存。
       * 拿到空结果（网络异常、格式变了）时保留旧数据 ——
       * 用陈旧但可用的清单，好过把中继用户全判成代理。
       */
      if (cidrs.length > 0) {
        cache = { cidrs, fetchedAt: Date.now() };
        return cidrs;
      }
      return cache?.cidrs ?? [];
    } catch {
      return cache?.cidrs ?? [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * 判断 IP 是否为 iCloud Private Relay 出口。
 *
 * 拉取失败时返回 false（保守放行交给上层 fail-open 逻辑），
 * 不会因为拿不到清单就把人拦掉。
 */
export async function isIcloudRelay(ip: string): Promise<boolean> {
  const parsed = parseIp(ip);
  if (!parsed) return false;
  const cidrs = await load();
  if (cidrs.length === 0) return false;
  return matchesAny(cidrs, parsed);
}

/** 供自检接口展示：清单加载到了多少条 */
export function relayCacheInfo(): { count: number; fetchedAt: number | null } {
  return { count: cache?.cidrs.length ?? 0, fetchedAt: cache?.fetchedAt ?? null };
}

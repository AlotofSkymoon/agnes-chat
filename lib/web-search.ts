/**
 * 联网搜索（服务端）。
 *
 * 搜索源的选择经过实测：
 *   - DuckDuckGo 的 html/lite 端点现在**稳定返回 403**（反爬），
 *     早期能用，现在无论怎么伪造 UA 都被拒，所以只能降级为备用。
 *   - Bing 的 RSS 端点是官方输出格式，返回标准 XML，
 *     不需要 API Key，解析也远比抓 HTML 可靠 —— 改用它作主源。
 *
 * 多源回退：主源失败就试备用，全失败才报错。
 * 绝不因为搜索失败就阻断对话，由调用方决定怎么提示。
 */

import { buildQueryCandidates, filterRelevant } from "@/lib/search-query";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 把 XML/HTML 实体还原成普通字符 */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 去掉标签，只留文本（先解码再剥离，顺序不能反） */
function stripTags(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从 CDATA 包裹里取出正文 */
function unwrapCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
}

function isHttpUrl(s: string): string | null {
  const t = s.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

/* ------------------------------ Bing RSS ------------------------------ */

/**
 * 解析 Bing 的 RSS 输出。
 * 结构是标准 RSS 2.0：<item><title>..</title><link>..</link><description>..</description></item>
 */
function parseBingRss(xml: string, limit: number): SearchResult[] {
  const out: SearchResult[] = [];
  const items = xml.split(/<item>/i).slice(1);

  for (const item of items) {
    if (out.length >= limit) break;

    const title = stripTags(unwrapCdata(pick(item, "title") ?? ""));
    const rawLink = stripTags(unwrapCdata(pick(item, "link") ?? ""));
    const snippet = stripTags(unwrapCdata(pick(item, "description") ?? ""));

    const url = isHttpUrl(rawLink);
    if (!title || !url) continue;
    if (out.some((r) => r.url === url)) continue;

    out.push({ title, url, snippet });
  }

  return out;
}

/** 取某个标签的内容 */
function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1] : null;
}

/* --------------------------- DuckDuckGo（备用） --------------------------- */

function unwrapDuckUrl(href: string): string {
  try {
    const u = new URL(href.startsWith("//") ? `https:${href}` : href);
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : u.toString();
  } catch {
    return href;
  }
}

function parseDuckDuckGo(html: string, limit: number): SearchResult[] {
  const out: SearchResult[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/i).slice(1);

  for (const block of blocks) {
    if (out.length >= limit) break;
    const linkMatch = block.match(
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) continue;

    const url = isHttpUrl(unwrapDuckUrl(linkMatch[1]));
    const title = stripTags(linkMatch[2]);
    if (!title || !url) continue;

    const snippetMatch =
      block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (out.some((r) => r.url === url)) continue;
    out.push({ title, url, snippet: snippetMatch ? stripTags(snippetMatch[1]) : "" });
  }

  return out;
}

/* ------------------------------ 调度 ------------------------------ */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchBing(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&count=${limit}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/xml, text/xml",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    // 跟随重定向：Bing 会先 302 一次
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Bing 返回 ${res.status}`);
  return parseBingRss(await res.text(), limit);
}

async function fetchDuck(query: string, limit: number): Promise<SearchResult[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "zh-CN,zh;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo 返回 ${res.status}`);
  return parseDuckDuckGo(await res.text(), limit);
}

export interface SearchOutcome {
  ok: boolean;
  results: SearchResult[];
  error?: string;
  /** 命中了哪个源，便于排查 */
  via?: "bing" | "duckduckgo";
}

/** 搜索结果上限放宽：想要多少给多少，靠压缩显示而非砍条数 */
export const MAX_SEARCH_RESULTS = 100;

/**
 * 执行搜索。
 *
 * 三层保障，缺一不可：
 *   1. 先把整句提问压缩成关键词（否则 Bing 会返回"写"字的字典解释）
 *   2. 多候选查询依次重试
 *   3. 结果做相关性过滤，不相关的直接丢掉
 *
 * 全部候选都不相关时返回 ok=false —— 调用方会照常用模型自身知识回答，
 * 而不是把一堆垃圾塞进上下文再让模型"基于以下内容作答"。
 */
export async function webSearch(rawQuery: string, limit = 30): Promise<SearchOutcome> {
  const raw = rawQuery.trim();
  if (!raw) return { ok: false, results: [], error: "搜索词为空" };
  if (raw.length > 500) return { ok: false, results: [], error: "搜索词过长" };

  const candidates = buildQueryCandidates(raw);
  if (candidates.length === 0) {
    return { ok: false, results: [], error: "无法从提问中提取搜索词" };
  }

  const errors: string[] = [];

  // 依次尝试候选查询词：第一个通常就够了，后面的用于兜底
  for (const q of candidates) {
    for (const [name, run] of [
      ["bing", fetchBing],
      ["duckduckgo", fetchDuck],
    ] as const) {
      let results: SearchResult[] = [];
      try {
        results = await run(q, limit);
      } catch (err) {
        errors.push(`${name}/${q}：${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      if (results.length === 0) {
        errors.push(`${name}/${q}：无结果`);
        continue;
      }

      /**
       * 相关性过滤：这是"牛头不对马嘴"的最后一道防线。
       * 搜索引擎偶尔会返回完全跑题的内容，与其让模型强行
       * "基于以下（无关的）结果回答"，不如直接判定没搜到。
       */
      const relevant = filterRelevant(results, q);

      if (relevant.length > 0) {
        return {
          ok: true,
          results: relevant.slice(0, limit),
          via: name,
        };
      }

      errors.push(`${name}/${q}：${results.length} 条结果均不相关`);
    }
  }

  return {
    ok: false,
    results: [],
    error: `未搜到相关内容（${errors.slice(0, 2).join("；")}）`,
  };
}

/**
 * 把搜索结果拼成可注入模型的上下文。
 *
 * 明确标注来源，让模型能给出引用；同时提醒它区分"检索到的"
 * 和"自己知道的"，减少把搜索结果说成事实的倾向。
 */
/**
 * 摘要压缩上限（字符）。
 *
 * 条数放宽后，全量摘要会撑爆上下文。但摘要的价值主要在开头几句，
 * 所以按条数自适应截断：结果越多，每条摘要越短。
 */
function snippetLimit(total: number): number {
  if (total <= 8) return 260;
  if (total <= 20) return 140;
  if (total <= 40) return 90;
  return 60;
}

function compress(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}

export function formatSearchContext(query: string, results: SearchResult[]): string {
  const cap = snippetLimit(results.length);

  const lines = results.map(
    (r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${compress(r.snippet || "（无摘要）", cap)}`,
  );

  return [
    `以下是联网搜索「${query}」得到的结果（共 ${results.length} 条，摘要已压缩）：`,
    "",
    ...lines,
    "",
    "要求：",
    "1. 基于以上检索结果回答，提及相关信息时标注来源编号，如 [3]。",
    "2. 结果较多时优先采信相关度高的，不要逐条罗列。",
    "3. 检索结果不足以回答就明说，不要编造。",
  ].join("\n");
}

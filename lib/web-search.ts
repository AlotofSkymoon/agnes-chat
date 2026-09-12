/**
 * 联网搜索（服务端）。
 *
 * 用 DuckDuckGo 的 HTML 端点 —— 不需要申请任何 API Key，
 * 这样站点开箱就能联网，访客不用额外配置。
 *
 * 它是 HTML 而非 JSON，所以要自己解析。解析做成"尽力而为"：
 * 拿不到就返回空数组，由调用方决定是提示用户还是照常聊天，
 * 绝不因为搜索失败就阻断对话。
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 把 HTML 实体还原成普通字符 */
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

/**
 * 去掉标签，只留文本。
 *
 * 顺序很关键：必须【先解码实体，再剥标签】。
 * 反过来的话，`&lt;b&gt;` 会被还原成真正的 `<b>` 却已错过剥离时机，
 * 导致摘要里残留 `<b>` 这种标签字面量。
 */
function stripTags(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从 DDG 的跳转链接里还原真实 URL */
function unwrapDuckUrl(href: string): string {
  try {
    // 形如 //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com
    const u = new URL(href.startsWith("//") ? `https:${href}` : href);
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return href;
  }
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/**
 * 解析 DuckDuckGo HTML 结果页。
 * 只取前 N 条，够用即可 —— 塞太多反而挤占上下文。
 */
function parseDuckDuckGo(html: string, limit: number): SearchResult[] {
  const out: SearchResult[] = [];

  // 每个结果是一个 <div class="result results_links ..."> 块
  const blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/i).slice(1);

  for (const block of blocks) {
    if (out.length >= limit) break;

    const linkMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const rawUrl = linkMatch[1];
    const title = stripTags(linkMatch[2]);
    const url = unwrapDuckUrl(rawUrl);
    if (!title || !isHttpUrl(url)) continue;

    const snippetMatch =
      block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : "";

    // 去重：同一 URL 只留一条
    if (out.some((r) => r.url === url)) continue;
    out.push({ title, url, snippet });
  }

  return out;
}

export interface SearchOutcome {
  ok: boolean;
  results: SearchResult[];
  error?: string;
}

/** 执行搜索。失败时 ok=false 并带上原因，由调用方决定怎么提示 */
export async function webSearch(query: string, limit = 5): Promise<SearchOutcome> {
  const q = query.trim();
  if (!q) return { ok: false, results: [], error: "搜索词为空" };
  if (q.length > 200) return { ok: false, results: [], error: "搜索词过长" };

  const target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(target, {
      headers: {
        // 不带 UA 的话 DDG 大概率返回空结果
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return { ok: false, results: [], error: `搜索引擎返回 ${res.status}` };
    }

    const html = await res.text();
    const results = parseDuckDuckGo(html, limit);
    if (results.length === 0) {
      return { ok: false, results: [], error: "没有搜到结果，换个说法试试" };
    }
    return { ok: true, results };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      results: [],
      error: timedOut ? "搜索超时（12 秒），请稍后重试" : `搜索失败：${msg}`,
    };
  }
}

/**
 * 把搜索结果拼成可注入模型的上下文。
 *
 * 明确标注来源，让模型能给出引用；同时提醒它区分"检索到的"
 * 和"自己知道的"，减少把搜索结果说成事实的倾向。
 */
export function formatSearchContext(query: string, results: SearchResult[]): string {
  const lines = results.map(
    (r, i) =>
      `[${i + 1}] ${r.title}\n来源：${r.url}\n摘要：${r.snippet || "（无摘要）"}`,
  );

  return [
    `以下是联网搜索「${query}」得到的结果（共 ${results.length} 条）：`,
    "",
    ...lines,
    "",
    "请基于以上检索结果回答，并在提及相关信息时标注来源编号。",
    "如果检索结果不足以回答，就明说，不要编造。",
  ].join("\n");
}

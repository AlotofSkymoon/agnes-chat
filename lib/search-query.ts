/**
 * 搜索词优化。
 *
 * 为什么需要它：搜索引擎（尤其 Bing RSS）对**整句提问**的处理很差。
 * 实测 "写一个 Python 快速排序" 返回的全是「写」字的字典解释、笔顺演示 ——
 * 它把句子当词袋，被"写"这个高频字带偏了。
 * 而 "Python 快速排序" 返回的是菜鸟教程、CSDN、知乎，完全正确。
 *
 * 所以发请求前必须先把"人话"压缩成"关键词"。
 */

/** 指令性前缀：这些都是对 AI 说的，不是搜索内容 */
const COMMAND_PREFIXES = [
  "请你",
  "请帮我",
  "请问",
  "请",
  "麻烦你",
  "麻烦",
  "帮我",
  "帮忙",
  "我想让你",
  "我想要",
  "我想",
  "我要",
  "能不能",
  "能否",
  "可以帮我",
  "可以",
  "给我",
  "给我写",
  "帮我写",
  "写一个",
  "写个",
  "写一段",
  "写一份",
  "写",
  "生成",
  "实现",
  "用",
  "来一个",
  "给我来",
  "how to",
  "please",
  "can you",
  "could you",
  "i want",
  "give me",
  "write",
];

/** 句尾的客套/限定词 */
const TAIL_NOISE = [
  "谢谢",
  "感谢",
  "麻烦了",
  "急",
  "在线等",
  "谢谢啦",
  "please",
  "thanks",
  "thank you",
];

/** 明显不是搜索内容的追问语气 */
const QUESTION_WORDS = ["怎么", "如何", "什么是", "为什么", "哪里", "哪个"];

/**
 * 判断一段文字里有没有值得保留的"实体词"。
 * 英文、数字、长度 >= 2 的中文片段都算。
 */
function hasContent(s: string): boolean {
  return /[a-zA-Z0-9]/.test(s) || s.replace(/[^\u4e00-\u9fa5]/g, "").length >= 2;
}

/**
 * 把用户提问压缩成搜索关键词。
 *
 * 步骤：
 *   1. 去掉代码块（代码不该拿去搜）
 *   2. 剥掉指令性前缀和句尾客套
 *   3. 去掉标点、压缩空白
 *   4. 太长就截到核心片段（优先保留含英文/数字的部分）
 */
export function buildSearchQuery(raw: string, maxLen = 40): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // 1) 去掉代码块 —— 拿代码去搜只会搜到一堆雷同片段
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");

  // 2) 只取第一段（后面往往是补充说明或上下文）
  const firstPara = s.split(/\n\s*\n/)[0] ?? s;
  if (firstPara.length >= 6) s = firstPara;

  // 3) 剥前缀：循环剥离，处理"请帮我写一个"这种叠加
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of COMMAND_PREFIXES) {
      if (s.length > p.length && s.toLowerCase().startsWith(p.toLowerCase())) {
        s = s.slice(p.length).trim();
        changed = true;
        break;
      }
    }
  }

  // 4) 剥句尾客套
  for (const t of TAIL_NOISE) {
    if (s.length > t.length && s.toLowerCase().endsWith(t.toLowerCase())) {
      s = s.slice(0, -t.length).trim();
      break;
    }
  }

  // 5) 清标点（保留中英文、数字、空格），压缩空白
  s = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.+#]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // 6) 剥离后若已无实质内容（比如用户只说了"帮我"），用原文兜底
  if (!hasContent(s)) {
    s = raw.replace(/```[\s\S]*?```/g, " ").replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.+#]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
  }

  // 7) 截断：优先保留前段（主谓宾通常在前面）
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).trim();
    // 避免从半个英文单词中间切断
    const lastSpace = s.lastIndexOf(" ");
    if (lastSpace > maxLen * 0.5) s = s.slice(0, lastSpace).trim();
  }

  return s;
}

/**
 * 生成候选查询词，按优先级排序。
 * 主查询失败时可以依次降级重试。
 */
export function buildQueryCandidates(raw: string): string[] {
  const primary = buildSearchQuery(raw);
  if (!primary) return [];

  const out = [primary];

  // 降级一：只保留含英文/数字的技术术语部分（"Python 快速排序 性能" → 保留）
  const techParts = primary
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w))
    .join(" ");
  if (techParts && techParts !== primary && techParts.length >= 2) out.push(techParts);

  // 降级二：如果是"XX怎么/如何YY"句式，把疑问词去掉
  let simplified = primary;
  for (const q of QUESTION_WORDS) {
    simplified = simplified.replace(q, "").trim();
  }
  if (simplified && simplified !== primary && hasContent(simplified)) out.push(simplified);

  return Array.from(new Set(out)).filter(Boolean).slice(0, 3);
}

/* ------------------------------ 相关性过滤 ------------------------------ */

/**
 * 把查询拆成关键词集合。
 * 中文按双字滑窗（"快速排序" → 快速、速排、排序），英文按空格切词。
 */
function keywords(q: string): string[] {
  const out = new Set<string>();

  // 英文/数字词
  for (const w of q.toLowerCase().match(/[a-z0-9]+#?/g) ?? []) {
    if (w.length >= 2) out.add(w);
  }

  // 中文：连续片段按 2 字滑窗
  for (const seg of q.match(/[\u4e00-\u9fa5]+/g) ?? []) {
    if (seg.length === 1) {
      out.add(seg);
      continue;
    }
    for (let i = 0; i < seg.length - 1; i++) out.add(seg.slice(i, i + 2));
    if (seg.length >= 3) out.add(seg);
  }

  return Array.from(out);
}

export interface RelevanceInput {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 给搜索结果打相关性分（0~1）。
 *
 * 分数 = 命中的关键词数 / 关键词总数。
 * 权重：标题命中算 2 分，摘要命中算 1 分 —— 标题更能代表内容。
 */
export function relevanceScore(item: RelevanceInput, query: string): number {
  const kws = keywords(query);
  if (kws.length === 0) return 1; // 没有可比对关键词时不筛

  const title = (item.title ?? "").toLowerCase();
  const text = `${item.title ?? ""} ${item.snippet ?? ""}`.toLowerCase();

  let hit = 0;
  let total = 0;
  for (const k of kws) {
    total += 2;
    if (title.includes(k)) hit += 2;
    else if (text.includes(k)) hit += 1;
  }

  return total === 0 ? 1 : Math.min(1, hit / total);
}

/** 低于这个分数的结果视为不相关，丢弃 */
export const RELEVANCE_THRESHOLD = 0.18;

/**
 * 过滤掉不相关的结果。
 *
 * 这是"牛头不对马嘴"的最后一道防线：即使搜索引擎返回了垃圾，
 * 只要它跟问题毫无关系，就不会被塞给模型。
 */
export function filterRelevant<T extends RelevanceInput>(
  items: T[],
  query: string,
  threshold = RELEVANCE_THRESHOLD,
): T[] {
  return items
    .map((it) => ({ it, score: relevanceScore(it, query) }))
    .filter((x) => x.score >= threshold)
    // 分高的排前面，让模型优先看到最相关的
    .sort((a, b) => b.score - a.score)
    .map((x) => x.it);
}

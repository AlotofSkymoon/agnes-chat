import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_MODEL,
  PROVIDERS,
  isAllowedModelWith,
  isBlockedBaseUrl,
  resolveTarget,
  sanitizeCustomProviders,
} from "@/lib/config";
import { detectPlatform } from "@/lib/platform";
import { getRedis, hasRedisConfig, KEYS } from "@/lib/redis";
import { REQUIRE_LOGIN } from "@/lib/site";
import { configValue } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel 函数最长执行时间（Hobby 60s 上限，Pro 可到 300s） */
export const maxDuration = 60;

/** OpenAI 兼容的消息内容：纯文本 或 多模态片段数组 */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

interface ChatRequestBody {
  messages?: {
    role: "user" | "assistant" | "system";
    content: string | ContentPart[];
  }[];
  model?: string;
  /** 用户自己的 Key（来自 localStorage，可选） */
  apiKey?: string;
  /** 各服务商的 Key：{ agnes?: string; deepseek?: string; "custom:x"?: string } */
  keys?: Record<string, string>;
  /**
   * 各服务商「独立」的 Base URL 覆盖值。
   * ⚠️ 必须是按供应商分开的字典，不能是单个字符串 ——
   *    否则改 DeepSeek 的地址会连带把 Agnes 也指过去。
   */
  baseUrls?: Record<string, string>;
  /** 用户自建的 OpenAI 兼容供应商 */
  customProviders?: unknown;
  /** 思考模式：让模型先输出推理过程，再给答案 */
  thinking?: boolean;
  /** 云端保存开关打开时才传 */
  conversationId?: string;
  saveToCloud?: boolean;
  /**
   * 会话标题（云端保存时用）。
   * 之前云端只存消息不存标题，拉回本地时只能显示「新对话」。
   */
  conversationTitle?: string;
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return errorResponse(400, "BAD_REQUEST", "请求格式错误");
  }

  const {
    messages,
    model = DEFAULT_MODEL,
    apiKey,
    keys,
    baseUrls,
    customProviders,
    conversationId,
    saveToCloud,
    conversationTitle,
    thinking,
  } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse(400, "BAD_REQUEST", "消息不能为空");
  }

  /**
   * 强制登录校验（服务端防线）。
   *
   * 站长设了 NEXT_PUBLIC_REQUIRE_LOGIN=true 时，没登录一律拒绝。
   * 前端也会拦一道，但那只是体验；绕过前端直接打接口的人在这里被挡住。
   */
  if (REQUIRE_LOGIN) {
    const u = await getCurrentUser();
    if (!u) {
      return NextResponse.json(
        {
          error: "本站已开启「必须登录才能对话」。请先登录或注册后再试。",
          code: "LOGIN_REQUIRED",
        },
        { status: 401 },
      );
    }
  }
  const custom = sanitizeCustomProviders(customProviders);

  if (!isAllowedModelWith(model, custom)) {
    return errorResponse(400, "BAD_MODEL", "不支持的模型");
  }

  /**
   * 单条消息体积保护。
   *
   * 阈值按平台定：Vercel Serverless 请求体硬上限 4.5MB，
   * Cloudflare Workers 宽松得多（100MB），可以放开。
   * 图片在前端已自动压缩，正常不会触发；触发时给出可操作的指引。
   */
  const MAX_MESSAGE_CHARS = detectPlatform() === "vercel" ? 3_500_000 : 20_000_000;

  // 逐条检查，顺便判断是不是图片引起的，好给针对性提示
  let oversizeIsImage = false;
  for (const m of messages) {
    const size = JSON.stringify(m.content).length;
    if (size <= MAX_MESSAGE_CHARS) continue;

    const hasImage =
      Array.isArray(m.content) &&
      m.content.some((c) => (c as { type?: string }).type === "image_url");
    if (hasImage) oversizeIsImage = true;

    return errorResponse(
      413,
      "TOO_LARGE",
      oversizeIsImage
        ? "图片内容过大。请在设置里配置对象存储（Cloudflare R2 / Backblaze B2）后重新上传，图片会以链接方式发送而非内嵌。"
        : "单条消息内容过大，请精简文本或减少附件后再试",
    );
  }

  // 解析：这个模型属于哪个供应商、该打哪个地址
  const target = resolveTarget(model, custom, baseUrls);
  if (!target) {
    return errorResponse(400, "BAD_MODEL", "找不到该模型所属的供应商");
  }

  // Key 严格按供应商取，绝不串台
  // - agnes：用户 Key 优先，回落服务端预设
  // - deepseek / 自定义：必须用用户自己的 Key
  let finalKey = "";
  if (target.providerId === "agnes") {
    const presetKey = configValue("PRESET_AGNES_API_KEY");
    finalKey = (keys?.agnes ?? apiKey ?? "").trim() || presetKey;
  } else {
    finalKey = (keys?.[target.providerId] ?? "").trim();
  }

  if (!finalKey) {
    return errorResponse(
      401,
      "NO_API_KEY",
      target.providerId === "agnes"
        ? "未配置 Agnes API Key，请在设置中填写你的 Key"
        : `使用 ${target.label} 需要填写你自己的 ${target.label} API Key（设置中填写）`,
    );
  }

  // 不支持识图的模型：把图片片段降级为占位文字，避免上游报错
  const visionOk = target.vision;
  let outbound = messages;
  if (!visionOk) {
    outbound = messages.map((m) => {
      if (typeof m.content === "string") return m;
      const textParts = m.content.filter((c) => c.type === "text");
      const imgs = m.content.filter((c) => c.type === "image_url");
      const text =
        textParts.map((c) => (c as { type: "text"; text: string }).text).join("\n") +
        (imgs.length ? `\n[已附带 ${imgs.length} 张图片，但当前模型不支持识图]` : "");
      return { ...m, content: text };
    });
  }

  const targetBase = target.baseUrl;

  /**
   * 把图片 URL 补全成绝对地址。
   *
   * 前端可能送来相对路径（例如早期版本 binding 直传返回的 `/api/r2/xxx`）。
   * 上游模型服务器不知道本站域名，相对路径它根本没法取，
   * 结果就是"图发出去了但 AI 看不见"。
   *
   * 在服务端兜底最可靠 —— 因为只有这里知道自己的 origin。
   */
  if (visionOk) {
    const origin = new URL(request.url).origin;
    outbound = outbound.map((m) => {
      if (typeof m.content === "string") return m;
      return {
        ...m,
        content: m.content.map((c) => {
          if (c.type !== "image_url") return c;
          const url = (c as { image_url: { url: string } }).image_url.url;
          if (!url || /^https?:\/\//i.test(url) || url.startsWith("data:")) return c;
          // 相对路径 → 拼上本站 origin
          return { ...c, image_url: { ...(c as { image_url: object }).image_url, url: `${origin}${url.startsWith("/") ? "" : "/"}${url}` } };
        }),
      };
    });
  }

  // SSRF 防护：内置地址一定安全，只校验用户可能改写的部分
  if (target.isCustom && isBlockedBaseUrl(targetBase)) {
    return errorResponse(400, "BLOCKED_URL", "该 Base URL 指向内网或受限地址，已被拒绝");
  }

  const upstreamUrl = `${targetBase}/chat/completions`;

  /**
   * 思考模式是否真的开启。
   * 只有「用户开了 + 目标供应商支持」才发，避免给不支持的服务带多余字段。
   */
  const thinkingOn = thinking === true && target.thinking;

  const buildUpstreamRequest = (): RequestInit => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${finalKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages: outbound.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      /**
       * Agnes 的扩展字段：开启后在 delta 里额外回传 reasoning_content。
       * 这是 OpenAI 生态里表示「思考内容」的事实标准字段
       * （DeepSeek R1 也用它），所以前端按同一字段解析即可。
       */
      ...(thinkingOn ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    }),
    signal: request.signal,
  });

  /** 读取上游建议的等待秒数，没有就给个保守值 */
  function retryAfterSeconds(res: Response): number {
    const raw = res.headers.get("retry-after");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.min(10, Math.ceil(n));
    }
    return 2;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, buildUpstreamRequest());

    // 瞬时 429 自动重试一次：免费额度常按「每分钟 N 次」计，
    // 这一秒超了、下一秒往往就空出来了，重试能救回大部分情况。
    if (upstream.status === 429) {
      const wait = retryAfterSeconds(upstream);
      await upstream.body?.cancel().catch(() => {});
      await sleep(wait * 1000);
      upstream = await fetch(upstreamUrl, buildUpstreamRequest());
    }
  } catch {
    return errorResponse(502, "NETWORK_ERROR", `无法连接 ${target.label} 服务，请检查网络与 Base URL 后重试`);
  }

  if (!upstream.ok || !upstream.body) {
    if (upstream.status === 401) {
      return errorResponse(
        401,
        "INVALID_KEY",
        `${target.label} API Key 无效，请检查后重试`,
      );
    }
    if (upstream.status === 429) {
      /**
       * 重试一次仍然是 429，说明不是偶发。
       *
       * 关键：把上游的原始说明一起带回来。
       * 「请求过快」是个筐，实际可能是按 Key 限流、按出口 IP 限流、
       * 按并发限流、甚至是账号被标记 —— 不看上游原文根本分不清。
       * Workers 的出口 IP 由大量站点共用，即便你一分钟只发一条也可能被按 IP 拒。
       */
      const wait = retryAfterSeconds(upstream);
      const raw = await upstream.text().catch(() => "");
      let upstreamMsg = "";
      try {
        const j = JSON.parse(raw) as { error?: { message?: string }; message?: string };
        upstreamMsg = j?.error?.message ?? j?.message ?? "";
      } catch {
        upstreamMsg = raw.slice(0, 200);
      }

      const plat = detectPlatform();
      const tip =
        plat === "cloudflare"
          ? "本站跑在 Cloudflare Workers 上，出口 IP 由大量站点共用，上游可能按「出口 IP」而非你的用量限流。可让访客自带 API Key，或改用 Vercel 部署。"
          : "若多个站点共用了同一个 API Key，它们会互相抢占额度，建议各站用各自的 Key。";

      return NextResponse.json(
        {
          error: `${target.label} 返回 429（已自动重试一次仍被限流）。${tip}`,
          upstreamMessage: upstreamMsg || "（上游未给出具体说明）",
          code: "RATE_LIMIT",
          retryAfter: wait,
          platform: plat,
          diagnoseUrl: "/api/diagnose",
        },
        { status: 429, headers: { "Retry-After": String(wait) } },
      );
    }
    const text = await upstream.text().catch(() => "");
    console.error("[chat] 上游返回错误", upstream.status);
    return errorResponse(upstream.status || 500, "UPSTREAM_ERROR", `上游服务错误（${upstream.status}）：${text.slice(0, 200)}`);
  }

  const user = await getCurrentUser();
  const shouldSave = Boolean(saveToCloud && conversationId && user && hasRedisConfig());

  // 统计：累计 AI 回复次数（失败不计）
  if (hasRedisConfig()) {
    try {
      await getRedis().incr(KEYS.statMessages);
    } catch {
      /* 统计失败不影响聊天 */
    }
  }

  // 透传上游 SSE，同时累积助手文本，用于「保存到云端」
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (shouldSave && assistantText) {
            try {
              const redis = getRedis();
              const payload = JSON.stringify({
                conversationId,
                model,
                title: (conversationTitle ?? "").slice(0, 60),
                messages: [
                  // 存云端时把多模态内容压成纯文本，避免图片 base64 占满 Redis
                  ...(messages ?? []).map((m) => ({
                    role: m.role,
                    content:
                      typeof m.content === "string"
                        ? m.content
                        : m.content
                            .map((c) =>
                              c.type === "text" ? c.text : "[图片]",
                            )
                            .join("\n"),
                  })),
                  { role: "assistant", content: assistantText },
                ],
                updatedAt: Date.now(),
              });
              await redis
                .pipeline()
                .set(KEYS.chat(user!.id, conversationId!), payload)
                .sadd(KEYS.chatIndex(user!.id), conversationId!)
                .exec();
            } catch {
              /* 云端保存失败不影响聊天 */
            }
          }
          controller.close();
          return;
        }
        if (value) {
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") assistantText += delta;
            } catch {
              /* SSE 被分片，忽略 */
            }
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

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
import { getRedis, hasRedisConfig, KEYS } from "@/lib/redis";

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
  /** 云端保存开关打开时才传 */
  conversationId?: string;
  saveToCloud?: boolean;
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
  } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse(400, "BAD_REQUEST", "消息不能为空");
  }
  const custom = sanitizeCustomProviders(customProviders);

  if (!isAllowedModelWith(model, custom)) {
    return errorResponse(400, "BAD_MODEL", "不支持的模型");
  }

  // 单条消息体积保护（图片 base64 容易撑爆）
  const tooBig = messages.some((m) => JSON.stringify(m.content).length > 1_500_000);
  if (tooBig) {
    return errorResponse(413, "TOO_LARGE", "单条消息内容过大，请减少附件后再试");
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
    const presetKey = process.env.PRESET_AGNES_API_KEY?.trim() ?? "";
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

  // SSRF 防护：内置地址一定安全，只校验用户可能改写的部分
  if (target.isCustom && isBlockedBaseUrl(targetBase)) {
    return errorResponse(400, "BLOCKED_URL", "该 Base URL 指向内网或受限地址，已被拒绝");
  }

  const upstreamUrl = `${targetBase}/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
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
      }),
      signal: request.signal,
    });
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
      return errorResponse(429, "RATE_LIMIT", "请求过快，请稍后再试");
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

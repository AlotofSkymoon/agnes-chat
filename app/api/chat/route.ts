import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, isAllowedModel } from "@/lib/config";
import { getRedis, hasRedisConfig, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 允许通过该代理访问的模型（防止被当成任意 OpenAI 代理滥用） */
interface ChatRequestBody {
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  model?: string;
  /** 用户自己的 Key（来自 localStorage，可选） */
  apiKey?: string;
  baseUrl?: string;
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

  const { messages, model = DEFAULT_MODEL, apiKey, baseUrl, conversationId, saveToCloud } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse(400, "BAD_REQUEST", "消息不能为空");
  }
  if (!isAllowedModel(model)) {
    return errorResponse(400, "BAD_MODEL", "不支持的模型");
  }

  // 优先级：用户自己的 Key > 服务端预设 Key（预设 Key 永不下发给浏览器）
  const presetKey = process.env.PRESET_AGNES_API_KEY?.trim();
  const finalKey = apiKey?.trim() || presetKey;

  if (!finalKey) {
    return errorResponse(401, "NO_API_KEY", "未配置 Agnes API Key，请在设置中填写你的 Key");
  }

  const targetBase = (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal: request.signal,
    });
  } catch {
    return errorResponse(502, "NETWORK_ERROR", "无法连接 Agnes 服务，请检查网络后重试");
  }

  if (!upstream.ok || !upstream.body) {
    if (upstream.status === 401) {
      return errorResponse(401, "INVALID_KEY", "Agnes API Key 无效，请检查后重试");
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
                messages: [...(messages ?? []), { role: "assistant", content: assistantText }],
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

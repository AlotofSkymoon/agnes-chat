import { NextResponse } from "next/server";

import { isBlockedBaseUrl } from "@/lib/config";
import { isTimeoutError, timeoutSignal } from "@/lib/fetch-timeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/probe-models —— 自动发现某个 OpenAI 兼容服务上有哪些模型。
 *
 * 做法就是标准的 `GET {baseUrl}/models`，OpenAI 官方定义，绝大多数
 * 中转服务（One API / New API / VoAPI / 各家官方 API）都实现了。
 *
 * 拿不到就如实告诉前端"没探测到"，由前端引导用户手填 ——
 * 有些中转站出于安全考虑会关掉这个端点，这是正常的，不该因此卡住添加流程。
 */

interface ProbeBody {
  baseUrl?: string;
  apiKey?: string;
}

/** 从 /models 的响应里抽出模型 id 列表，兼容几种常见结构 */
function extractIds(data: unknown): string[] {
  const out: string[] = [];

  // OpenAI 标准：{ data: [{ id: "gpt-4o", ... }] }
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    for (const item of (data as { data: unknown[] }).data) {
      if (item && typeof item === "object") {
        const id = (item as { id?: unknown }).id;
        if (typeof id === "string" && id.trim()) out.push(id.trim());
      }
    }
  }

  // 少数服务直接返回字符串数组
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string" && item.trim()) out.push(item.trim());
    }
  }

  return out;
}

export async function POST(request: Request) {
  let body: ProbeBody;
  try {
    body = (await request.json()) as ProbeBody;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const base = (body.baseUrl ?? "").trim().replace(/\/+$/, "");
  const key = (body.apiKey ?? "").trim();

  if (!base) return NextResponse.json({ error: "请先填写 Base URL" }, { status: 400 });
  if (!/^https?:\/\//i.test(base)) {
    return NextResponse.json({ error: "Base URL 必须以 http:// 或 https:// 开头" }, { status: 400 });
  }
  if (isBlockedBaseUrl(base)) {
    return NextResponse.json({ error: "不允许探测内网 / 本机地址" }, { status: 400 });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  // 没填 Key 也照样探测：不少中转站的 /models 是公开的
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${base}/models`, {
      headers,
      // 探测不该拖太久，超时就当探测失败
      signal: timeoutSignal(10_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: `上游返回 ${res.status}。可能该服务未开放 /models 端点，或 Key 无权限 —— 可以直接手填模型 id。`,
        },
        { status: 200 },
      );
    }

    const raw = await res.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const ids = extractIds(parsed);
    if (ids.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "连通了但没解析出模型列表，请手动填写模型 id。",
        raw: raw.slice(0, 200),
      });
    }

    // 去重 + 排序，最多给 200 个，防止列表爆炸
    const unique = Array.from(new Set(ids)).sort().slice(0, 200);
    return NextResponse.json({ ok: true, models: unique, total: unique.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 超时单独说明，比笼统的"失败"更好定位
    const timedOut = isTimeoutError(err);
    return NextResponse.json({
      ok: false,
      error: timedOut
        ? "探测超时（10 秒）。请检查 Base URL 是否可访问，或直接手填模型 id。"
        : `无法连接该服务：${msg}。请检查 Base URL，或直接手填模型 id。`,
    });
  }
}

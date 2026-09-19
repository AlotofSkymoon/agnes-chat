import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { checkIp, clientIpFromHeaders } from "@/lib/ip-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ip-guard —— 判断当前访问者是否疑似代理工具。
 *
 * 返回给前端的字段刻意做了收敛：
 * 不下发完整风险画像（那是付费数据），只给"是否放行 + 原因 + 少量判定依据"。
 * IP 本身会回显，因为用户需要知道自己被识别成了什么。
 *
 * ⚠️ 前端拿到 allowed=false 只用于展示提示，不构成真正的安全边界 ——
 * 纯前端拦截可以被绕过。要真正拦住，得在服务端渲染/接口层判定。
 */
export async function GET(request: Request) {
  const ip = clientIpFromHeaders(request.headers);

  // 管理员不拦：站长若自己开着代理，不该把自己锁在门外
  let isAdmin = false;
  try {
    const user = await getCurrentUser();
    isAdmin = user?.role === "admin";
  } catch {
    isAdmin = false;
  }

  const verdict = await checkIp(ip, isAdmin);

  return NextResponse.json(
    {
      allowed: verdict.allowed,
      reason: verdict.reason,
      ip: verdict.ip,
      relay: verdict.relay,
      score: verdict.score,
      behaviors: verdict.behaviors,
      usageType: verdict.usageType,
      provider: verdict.provider,
      detected: verdict.detected,
      cached: verdict.cached,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

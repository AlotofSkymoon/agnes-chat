import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { checkIp, clientIpFromHeaders, ipGuardStatus } from "@/lib/ip-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ip-guard —— 自检接口：报告当前访问者会被判定成什么。
 *
 * ⚠️ 它只"报告"，不拦截 —— 真正的拦截在 middleware.ts 里完成
 * （代理直接返回 403，绕过不了）。这个接口存在的意义是：
 * 被 403 拦住时人看不到原因，而这里能看出是没配 token、
 * 接口失败、还是真的被判成代理。
 *
 * 字段刻意收敛：不下发完整风险画像（付费数据），只给判定结论与少量依据。
 * IP 会回显，因为排查时需要知道被识别成了哪个地址。
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
      // 没真检测 = 没配数据源，此时一切访问都会放行
      status: ipGuardStatus(),
      detected: verdict.detected,
      cached: verdict.cached,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

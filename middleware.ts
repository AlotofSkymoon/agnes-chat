import { NextResponse, type NextRequest } from "next/server";

import { blockedJson, blockedPageHtml } from "@/lib/ip-guard/blocked-page";
import { checkIp, clientIpFromHeaders } from "@/lib/ip-guard";

/**
 * 代理访问拦截（真正的服务端拦截，不是前端提示）。
 *
 * ⚠️ 为什么是 middleware.ts 而不是 Next.js 16 新出的 proxy.ts：
 *
 *   proxy.ts 默认跑在 **Node.js runtime**，而 OpenNext（Cloudflare 适配器）
 *   明确不支持 Node.js middleware —— 构建时会直接抛
 *   "Node.js middleware is not currently supported"，整个部署失败。
 *   而 proxy.ts 又不允许指定 runtime: 'edge'（该配置项已移除）。
 *
 *   middleware.ts 虽然从 v16 起被标记 deprecated，但它仍可用且默认 Edge runtime，
 *   是 OpenNext 唯一支持的拦截方式。权衡下来只能选它。
 *
 * ⚠️ 依然保持 fail-open：
 * token 没配、接口超时、Apple 清单拉不到 —— 全都放行。
 * 真拦截的代价太高（误判 = 访客彻底打不开），出错时必须让站点照常可用。
 */

export function middleware(request: NextRequest) {
  // 只拦页面与 API；静态资源由 matcher 排除，这里再兜一层
  const { pathname } = request.nextUrl;

  const ip = clientIpFromHeaders(request.headers);
  if (!ip) return NextResponse.next();

  /**
   * middleware 不能是 async 阻塞太久，但判定本身是 await 的 ——
   * 用 NextResponse.next() 先行返回，再在背景判定是无效的（响应已发出）。
   * 所以这里必须 await，代价是首次判定会增加一点延迟（有 10 分钟缓存）。
   */
  return (async () => {
    let verdict;
    try {
      verdict = await checkIp(ip, false);
    } catch {
      // 判定逻辑自身抛错也不能影响访问
      return NextResponse.next();
    }

    if (verdict.allowed) return NextResponse.next();

    const opts = {
      reason: verdict.reason,
      ip: verdict.ip,
      behaviors: verdict.behaviors,
      usageType: verdict.usageType,
      score: verdict.score,
    };

    const isApi = pathname.startsWith("/api/");

    return new NextResponse(isApi ? blockedJson(opts) : blockedPageHtml(opts), {
      status: 403,
      headers: {
        "Content-Type": isApi ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-IP-Guard": "blocked",
      },
    });
  })();
}

/**
 * 排除静态资源与 Next 内部路径。
 * 不排除的话每个图片/CSS 请求都要跑一次判定，
 * 既浪费 IP 接口额度（按次计费）又拖慢加载。
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?|ttf|json|txt|xml)$).*)",
  ],
};

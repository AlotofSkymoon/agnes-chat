import { DEFAULT_NAV } from "@/lib/nav-data";
import { getValue, hasRedisConfig, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/nav —— 获取导航站数据。
 * 优先读 Redis（管理员自定义过的），没有则回落到内置默认数据。
 * 未配置 Redis 时也能正常显示默认导航。
 */
export async function GET() {
  try {
    if (hasRedisConfig()) {
      const redis = getRedis();
      const saved = await getValue<unknown>(KEYS.navData);
      if (saved && Array.isArray(saved) && saved.length > 0) {
        return Response.json({ categories: saved, source: "redis" });
      }
    }
  } catch {
    /* 读失败则用默认 */
  }
  return Response.json({ categories: DEFAULT_NAV, source: "default" });
}

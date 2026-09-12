import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare 配置。
 * 让 Next.js 14 App Router 跑在 Cloudflare Workers 上。
 */
export default defineCloudflareConfig({
  // 增量静态再生成缓存（用 KV）
  incrementalCache: "dummy",
  // 图片优化在 Workers 上默认走 passthrough
  imageOptimization: { remotePatterns: [] },
});

/**
 * OpenNext Cloudflare 配置 —— 仅在部署到 Cloudflare Workers 时由 `opennextjs-cloudflare` CLI 读取。
 *
 * ⚠️ 这里刻意不使用 `import { defineCloudflareConfig } from "@opennextjs/cloudflare"`：
 * 该函数在不同版本里的导出位置不一致（0.4.x 在子路径 @opennextjs/cloudflare/config，
 * 新版在主包），而本项目锁在 Next 14.2.35 + 适配器 0.4.8，
 * 用它会让 `next build`（Vercel）也去类型检查本文件并报错：
 *   Type error: Module '"@opennextjs/cloudflare"' has no exported member 'defineCloudflareConfig'
 *
 * 直接导出普通对象即可 —— defineCloudflareConfig 本身也只是原样返回入参，
 * 这样既兼容任意版本，也不影响 Vercel 构建。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const config: Record<string, any> = {
  // 增量静态再生成缓存：本站无 ISR 页面，用 dummy 关闭
  incrementalCache: "dummy",
  // 图片优化在 Workers 上走 passthrough；本站不加载外部图片，白名单置空
  imageOptimization: { remotePatterns: [] },
};

export default config;

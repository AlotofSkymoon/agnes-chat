/**
 * OpenNext Cloudflare 配置 —— 仅在部署到 Cloudflare Workers 时由 `opennextjs-cloudflare` CLI 读取。
 *
 * ⚠️ 改动前请先读完，这个文件有两个反直觉的坑：
 *
 * 1) 字段都在 `default.override` 里，不是 `default` 顶层。
 *    写错层级会报 "config.default cannot be empty" 或一大段 requirements 提示。
 *
 * 2) 刻意不使用 `import { defineCloudflareConfig } from "@opennextjs/cloudflare"`：
 *    该函数在不同版本导出位置不一致（0.4.x 在子路径 @opennextjs/cloudflare/config，
 *    新版在主包），用它会让 `next build`（Vercel）也去类型检查本文件并报
 *    "has no exported member 'defineCloudflareConfig'"。
 *    本文件已在 tsconfig.json 的 exclude 中排除，两边都不会检查。
 *
 * 结构与官方模板一致，但 incrementalCache 用 "dummy" 而非 kv-cache：
 * 本站没有 ISR 页面，不需要 NEXT_CACHE_WORKERS_KV 绑定，少配一个资源。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const config: Record<string, any> = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },

  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
    },
  },

  dangerous: {
    enableCacheInterception: false,
  },
};

export default config;

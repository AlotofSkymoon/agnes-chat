/**
 * OpenNext Cloudflare 配置 —— Next.js 15 + @opennextjs/cloudflare 1.x
 *
 * ⚠️ 1.x 与 0.4.x 的配置模型完全不同：
 *
 * 0.4.x 用的是手写对象 + `default.override`：
 *   { default: { override: { wrapper: "cloudflare-node", ... } } }
 * 直接搬到 1.x 会报 "config.default cannot be empty" 或类型校验失败。
 *
 * 1.x 改为 `defineCloudflareConfig()`：
 *   - 空配置即采用适配器默认实现（worker 入口、静态资源、缓存策略）
 *   - 需要 ISR / revalidate / on-demand 缓存时才显式传 override
 *
 * 本站没有 ISR 页面（所有 API 路由都是 force-dynamic，页面也都是动态渲染），
 * 因此不需要 incrementalCache / tagCache / queue 覆盖 ——
 * 保持空配置，少配三个资源，也少三个出错点。
 */

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();

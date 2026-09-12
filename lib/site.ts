/**
 * 站点品牌配置。
 *
 * 本站定位：**中转 API 的官方演示站**。
 * 站长（可能是 Agnes / 任意中转服务商）把自己的 Key 和 Base URL 配进环境变量，
 * 用户打开就能直接聊，不用自己申请 Key。
 *
 * 所以品牌名、上游地址、模型列表全部可配置，默认给 Agnes AI 一套。
 */

/** 站点显示名，默认 Agnes AI。改环境变量 NEXT_PUBLIC_SITE_NAME 即可换。 */
export const SITE_NAME: string =
  process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Agnes AI";

/** 站点副标题 */
export const SITE_TAGLINE: string =
  process.env.NEXT_PUBLIC_SITE_TAGLINE?.trim() || "免费聊天";

/** 完整标题，如 "Agnes AI 免费聊天" */
export const SITE_TITLE = `${SITE_NAME} ${SITE_TAGLINE}`;

/** 页面标题拼接：pageTitle("登录") → "登录 · Agnes AI 免费聊天" */
export function pageTitle(page: string): string {
  return `${page} · ${SITE_TITLE}`;
}

/** 站点简介（README / SEO / 页脚共用） */
export const SITE_DESCRIPTION: string =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
  `${SITE_NAME} 官方演示站。开箱即用的纯文本 AI 聊天，支持自带 API Key 与中转 Base URL。`;

/** 主题：fuwari（清透蓝）/ violet-rose（紫玫瑰），用户可在设置里切换 */
export type ThemePreset = "fuwari" | "violet-rose";

export const THEME_PRESETS: { id: ThemePreset; label: string; desc: string }[] = [
  { id: "fuwari", label: "Fuwari", desc: "清透蓝 · 淡雅留白" },
  { id: "violet-rose", label: "Violet Rose", desc: "紫玫瑰 · 柔光渐变" },
];

const DEFAULT_THEME: ThemePreset =
  process.env.NEXT_PUBLIC_THEME?.trim() === "violet-rose" ? "violet-rose" : "fuwari";

export const SITE_THEME: ThemePreset = DEFAULT_THEME;

/** 站长信息（页脚 / 版权处展示） */
export const AUTHOR_NAME: string =
  process.env.NEXT_PUBLIC_AUTHOR_NAME?.trim() || "wcvjk8tnz8";

/** 仓库地址（页脚链接） */
export const REPO_URL: string =
  process.env.NEXT_PUBLIC_REPO_URL?.trim() || "https://github.com/AlotofSkymoon/agnes-chat";

/**
 * 署名标识：默认 by-agnes-chat.vercel.app。
 * 页面会显式展示（页脚 + 侧边栏底部），按 LICENSE 要求不可移除。
 * 换自己的域名时改 NEXT_PUBLIC_BY_LINE 即可。
 */
export const BY_LINE: string =
  process.env.NEXT_PUBLIC_BY_LINE?.trim() || "by-agnes-chat.vercel.app";

/** 上游项目地址（迁移来源，页脚标注） */
export const UPSTREAM_URL: string =
  process.env.NEXT_PUBLIC_UPSTREAM_URL?.trim() || "https://github.com/AlotofSkymoon/agnes-chat";

/**
 * 是否允许访客自带 Key / Base URL。
 * 演示站一般开着（用户想用自己的额度也行）；
 * 想锁死成"只能用站长的"就设 NEXT_PUBLIC_ALLOW_CUSTOM_KEY=false。
 */
export const ALLOW_CUSTOM_KEY =
  process.env.NEXT_PUBLIC_ALLOW_CUSTOM_KEY?.trim() !== "false";

/** 是否允许自定义 Base URL（关掉后只能用环境变量里配置的中转地址） */
export const ALLOW_CUSTOM_BASE_URL =
  process.env.NEXT_PUBLIC_ALLOW_CUSTOM_BASE_URL?.trim() !== "false";

/**
 * 是否必须登录才能对话。
 *
 * 面向开发者的开关：
 *   NEXT_PUBLIC_REQUIRE_LOGIN=true  → 访客必须注册/登录才能聊天
 *   （默认 false，即免登录可用）
 *
 * 为什么做成 NEXT_PUBLIC_ 前缀：前端也需要知道这个值，好在发送前
 * 就拦住并引导去登录，而不是等服务端返回 401 才知道。
 *
 * ⚠️ 前端拦只是体验优化，真正的校验在服务端 /api/chat 里，
 *    两者都要有 —— 只靠前端拦是可以被绕过的。
 */
export const REQUIRE_LOGIN =
  process.env.NEXT_PUBLIC_REQUIRE_LOGIN?.trim() === "true";

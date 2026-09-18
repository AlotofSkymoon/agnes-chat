/**
 * 站点品牌配置。
 *
 * 本站定位：**免费 AI 聊天站**（独立的开源项目，不隶属于任何 API 服务商）。
 * 站长把自己的 Key 和 Base URL 配进环境变量，
 * 访客打开就能直接聊，不用自己申请 Key、也不用填 Base URL。
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
  `${SITE_NAME} 免费 AI 聊天站。开箱即用，支持自带 API Key 与自定义 Base URL。`;

/**
 * 主题预设。
 * - fuwari：静态博客主题的观感 —— 极简、卡片、大留白，色相可调
 * - violet-rose：紫粉渐变 + 白色圆角卡片（玫瑰点缀）
 * - anthropic：克制的暖色调 —— 米白底、赤陶橙点缀、细边框
 */
export type ThemePreset = "fuwari" | "violet-rose" | "anthropic";

export const THEME_PRESETS: { id: ThemePreset; label: string; desc: string }[] = [
  { id: "anthropic", label: "Anthropic", desc: "纸感排版 · 衬线思考 · Inter + Source Serif" },
  { id: "fuwari", label: "Fuwari", desc: "极简卡片 · 大留白 · 单色相驱动" },
  { id: "violet-rose", label: "Violet Rose", desc: "紫粉柔光 · 大圆角糖果 · 实心白卡" },
];

export const THEME_IDS: ThemePreset[] = ["anthropic", "fuwari", "violet-rose"];

const DEFAULT_THEME: ThemePreset = (() => {
  const t = process.env.NEXT_PUBLIC_THEME?.trim();
  return THEME_IDS.includes(t as ThemePreset) ? (t as ThemePreset) : "anthropic";
})();

export const SITE_THEME: ThemePreset = DEFAULT_THEME;

/** 站长信息（页脚 / 版权处展示） */
export const AUTHOR_NAME: string =
  process.env.NEXT_PUBLIC_AUTHOR_NAME?.trim() || "wcvjk8tnz8";

/** 仓库地址（页脚链接） */
export const REPO_URL: string =
  process.env.NEXT_PUBLIC_REPO_URL?.trim() || "https://github.com/AlotofSkymoon/agnes-chat";

/**
 * 项目主页地址。
 *
 * 对应 cloud-mail 里的 project_link 变量 —— 页脚和署名处指向项目仓库，
 * 别人看到界面想自己搭一个时，点一下就能找到源码。
 */
export const PROJECT_LINK: string =
  process.env.NEXT_PUBLIC_PROJECT_LINK?.trim() ||
  "https://github.com/wcvjk8tnz8-create/agnes-chat";

/**
 * 署名标识：默认指向项目主页。
 * 页面会显式展示（页脚 + 侧边栏底部），按 LICENSE 要求不可移除。
 * 换自己的地址时改 NEXT_PUBLIC_BY_LINE 即可。
 */
export const BY_LINE: string =
  process.env.NEXT_PUBLIC_BY_LINE?.trim() || `by ${PROJECT_LINK}`;

/** 上游项目地址（迁移来源，页脚标注） */
export const UPSTREAM_URL: string =
  process.env.NEXT_PUBLIC_UPSTREAM_URL?.trim() || "https://github.com/AlotofSkymoon/agnes-chat";

/**
 * 是否允许访客自带 Key / Base URL。
 * 免费聊天站一般开着（访客想用自己的额度也行）；
 * 想锁死成"只能用站长的"就设 NEXT_PUBLIC_ALLOW_CUSTOM_KEY=false。
 */
export const ALLOW_CUSTOM_KEY =
  process.env.NEXT_PUBLIC_ALLOW_CUSTOM_KEY?.trim() !== "false";

/** 是否允许自定义 Base URL（关掉后只能用环境变量里配置的中转地址） */
export const ALLOW_CUSTOM_BASE_URL =
  process.env.NEXT_PUBLIC_ALLOW_CUSTOM_BASE_URL?.trim() !== "false";

/**
 * 是否开放联网搜索。
 *
 * 默认开放（true）：访客都能用，不需要任何 API Key，
 * 因为走的是 DuckDuckGo 公开端点。
 *
 * 想关掉就设 NEXT_PUBLIC_ALLOW_WEB_SEARCH=false ——
 * 比如你担心额度、或部署环境不允许出站请求。
 */
export const ALLOW_WEB_SEARCH =
  process.env.NEXT_PUBLIC_ALLOW_WEB_SEARCH?.trim() !== "false";

/* ---------------------------------------------------------------------------
   赞助 / 支持
   --------------------------------------------------------------------------- */

/**
 * 是否展示赞助页面。
 * 默认开启；不想放收款码就设 NEXT_PUBLIC_SPONSOR_ENABLED=false，
 * 页面会返回 404，侧边栏入口也会隐藏。
 */
export const SPONSOR_ENABLED =
  process.env.NEXT_PUBLIC_SPONSOR_ENABLED?.trim() !== "false";

/**
 * 收款二维码图片地址。
 *
 * 默认放 public/sponsor-qr.png（把你的收款码存成这个文件名即可）。
 * 也可以直接给一个外链，例如图床地址。
 *
 * ⚠️ 不建议用会过期的临时链接 —— 二维码一旦失效，赞助入口就废了。
 */
export const SPONSOR_QR: string =
  process.env.NEXT_PUBLIC_SPONSOR_QR?.trim() || "/sponsor-qr.png";

/** 收款方式名称，展示在二维码下方 */
export const SPONSOR_METHOD: string =
  process.env.NEXT_PUBLIC_SPONSOR_METHOD?.trim() || "AlipayHK";

/** 赞助说明（支持一句话说明用途） */
export const SPONSOR_NOTE: string =
  process.env.NEXT_PUBLIC_SPONSOR_NOTE?.trim() ||
  "本项目免费开源、无广告。赞助用于支付服务器、API 额度与域名费用。";

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

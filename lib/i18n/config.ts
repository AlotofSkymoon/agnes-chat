/**
 * 界面语言。
 *
 * ⚠️ 顺序即优先级：简体 → 繁体 → 英文 → 法文。
 * 预设简体（DEFAULT_LOCALE），与站点主要受众一致。
 *
 * ⚠️ 为什么语言列表写死在代码里而不是做成可配置：
 * 翻译是随代码发布的资源，加一门语言等于改词典，
 * 靠环境变量声明一门没有词条的语言只会得到满屏漏翻，反而更糟。
 */
export const LOCALES = ["zh-CN", "zh-TW", "en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-CN";

/** 语言名用该语言自己写，避免用户看不懂自己母语的名字 */
export const LOCALE_META: Record<Locale, { label: string; short: string }> = {
  "zh-CN": { label: "简体中文", short: "简" },
  "zh-TW": { label: "繁體中文", short: "繁" },
  en: { label: "English", short: "EN" },
  fr: { label: "Français", short: "FR" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** 从存储里读出来的值可能是任意字符串，先校验再用 */
export function normalizeLocale(v: unknown): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export const LOCALE_STORAGE_KEY = "agnes.locale";

/** 给 <html lang> 用：法语要标 fr，不能拿 key 直接当 lang */
export function htmlLang(locale: Locale): string {
  return locale;
}

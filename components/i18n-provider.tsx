"use client";

import * as React from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  htmlLang,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";
import { t as translate } from "@/lib/i18n/dict";

/**
 * 界面语言。
 *
 * ⚠️ 为什么首屏不读 localStorage 直接渲染：
 * 服务端渲染时拿不到 localStorage，若在渲染期读会和 hydration 结果不一致。
 * 首屏统一用 DEFAULT_LOCALE（简体），挂载后再从存储恢复 ——
 * 这样两端输出一致，不会触发 hydration mismatch。
 *
 * ⚠️ 为什么用 state 而不是订阅 storage 事件：
 * 换语言只可能发生在当前标签页（点切换器），
 * 多标签同步不是这个场景需要的，加了反而增加复杂度。
 */
interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** vars 用于 {name} 插值，如 t("video.transcodingPlan", { i: 1, n: 3, name: "H.264" }) */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** 是否已从存储恢复：避免把"还没恢复"误当成"用户选了简体" */
  ready: boolean;
}

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = React.useState(false);

  // 挂载后恢复：这一步放在 effect 里，保证服务端/客户端首屏一致
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved) setLocaleState(normalizeLocale(saved));
    } catch {
      // 隐私模式下 localStorage 会抛错，忽略即可，用默认语言照样能跑
    }
    setReady(true);
  }, []);

  // 同步 <html lang>：屏幕阅读器和翻译工具靠它决定发音/语种
  React.useEffect(() => {
    if (!ready) return;
    try {
      document.documentElement.lang = htmlLang(locale);
    } catch {
      // 极端环境下 document 不可写，不影响功能
    }
  }, [locale, ready]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // 存不下就只对本次会话生效，不打断操作
    }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, locale, vars),
    [locale],
  );

  const value = React.useMemo<I18nValue>(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * 取语言上下文。
 *
 * ⚠️ 这个 hook 只能在客户端组件里用。
 * 服务端组件请保持静态文案，或把需要翻译的部分拆成客户端子组件。
 */
export function useI18n(): I18nValue {
  const ctx = React.useContext(I18nContext);
  if (ctx) return ctx;

  /*
   * 没有 Provider 时（比如某个页面忘了包）返回简体默认值，
   * 而不是抛错 —— 一个翻译 Provider 不该有能力让整页白屏。
   */
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(key, DEFAULT_LOCALE, vars),
    ready: false,
  };
}

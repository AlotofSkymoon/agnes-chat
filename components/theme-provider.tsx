"use client";

import * as React from "react";

import { SITE_THEME, THEME_IDS, type ThemePreset } from "@/lib/site";

type Theme = "dark" | "light";

const STORAGE_KEY = "agnes:theme";
const PRESET_KEY = "agnes:theme-preset";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** 配色预设：anthropic / fuwari / violet-rose */
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [preset, setPresetState] = React.useState<ThemePreset>(SITE_THEME);

  React.useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? null;
    /**
     * 没手动选过时跟随系统偏好。
     *
     * 原来写死 stored ?? "light" —— 系统设成深色的用户第一次打开
     * 仍然是白底，得手动点一次。现在读 prefers-color-scheme，
     * 用户一旦手动切换过就以 localStorage 为准。
     */
    const systemDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Theme = stored ?? (systemDark ? "dark" : "light");
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");

    const storedPreset = localStorage.getItem(PRESET_KEY) as ThemePreset | null;
    const initialPreset: ThemePreset = THEME_IDS.includes(storedPreset as ThemePreset)
      ? (storedPreset as ThemePreset)
      : SITE_THEME;
    setPresetState(initialPreset);
    document.documentElement.dataset.theme = initialPreset;
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setTheme]);

  const setPreset = React.useCallback((next: ThemePreset) => {
    setPresetState(next);
    localStorage.setItem(PRESET_KEY, next);
    document.documentElement.dataset.theme = next;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, preset, setPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}

/**
 * 防止刷新时闪白/闪主题：在 <head> 中同步执行。
 * 明暗用 .dark class，配色用 data-theme 属性，两者互不干扰。
 */
export const themeInitScript = `(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}');
var d=t?t==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
if(d)r.classList.add('dark');else r.classList.remove('dark');
var p=localStorage.getItem('${PRESET_KEY}');
r.dataset.theme=${JSON.stringify(THEME_IDS)}.indexOf(p)>=0?p:'${SITE_THEME}';
}catch(e){document.documentElement.classList.remove('dark');}})();`;

"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** 是否显示文字标签 */
  withLabel?: boolean;
}

/**
 * 明暗切换按钮（三态循环：亮 → 暗 → 跟随系统）。
 *
 * 点击时把**点击坐标**传给 provider，
 * 新主题会从手指/鼠标按下的那一点以圆形扩散开，而不是整屏硬切。
 */
export function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const { t } = useI18n();
  const { resolvedTheme, theme, cycleTheme, systemTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const label =
    theme === "system"
      ? `${t("theme.systemTip")}（${t("theme.current")}${
          systemTheme === "dark" ? t("theme.dark") : t("theme.light")
        }）`
      : isDark
        ? t("theme.darkTip")
        : t("theme.lightTip");

  const nextLabel =
    theme === "light" ? t("theme.toDark") : theme === "dark" ? t("theme.toSystem") : t("theme.toLight");

  return (
    <button
      type="button"
      onClick={(e) => {
        /**
         * 取点击位置作为扩散原点。
         * 用 currentTarget 的中心更稳 ——
         * 直接取 clientX/Y 在键盘触发（Enter）时是 0,0，动画会从左上角冒出来。
         */
        const rect = e.currentTarget.getBoundingClientRect();
        const origin = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        cycleTheme(origin);
      }}
      title={`${label} · ${nextLabel}`}
      aria-label={`${label} · ${nextLabel}`}
      className={cn(
        "glass group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full transition-all duration-300",
        "hover:scale-105 active:scale-95",
        withLabel ? "h-9 px-3.5 text-xs font-medium" : "h-9 w-9",
        className,
      )}
    >
      {/* 高光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-70"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/*
        图标区：三态各一个图标，当前态显示、其余缩小旋转隐藏。
        "跟随系统"用显示器图标，让用户一眼看出当前不是锁定态。
      */}
      <span className="relative block h-4 w-4">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            theme === "light"
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-50 opacity-0",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0",
          )}
        />
        <Monitor
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            theme === "system" ? "rotate-0 scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </span>

      {withLabel ? (
        <span className="relative text-fg-secondary group-hover:text-fg">
          {theme === "system" ? t("theme.shortSystem") : isDark ? t("theme.dark") : t("theme.light")}
        </span>
      ) : null}
    </button>
  );
}
